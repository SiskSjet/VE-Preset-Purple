param(
    [string]$env = ""
)

function ConvertTo-PascalCase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [string]$String
    )

    # Split the input string by whitespace and underscores
    $words = $String -split '\s|_'

    # Convert each word to PascalCase
    $pascalWords = $words | ForEach-Object {
        if ($_ -match '^[A-Z][a-z]*$') {
            # The word is already in PascalCase
            $_
        }
        else {
            # Convert the word to PascalCase
            $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
        }
    }

    # Join the words back together
    $pascalString = $pascalWords -join ''

    return $pascalString
}

function ConvertTo-Acronym {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [string]$String
    )

    $pascalCase = ConvertTo-PascalCase -String $String
    $acronym = [string]::Empty

    for ($i = 0; $i -lt $pascalCase.Length; $i++) {
        $char = $pascalCase[$i]
        if ([char]::IsUpper($char)) {
            $acronym += $char
        }
    }

    $acronym
}

# Set current working directory to the directory of the script
Set-Location $PSScriptRoot

# Set default values for variables
$modDirectory = Join-Path $PSScriptRoot "Mod"
$scriptsDirectory = Join-Path $PSScriptRoot "Scripts"
$artifactDirectory = Join-Path $PSScriptRoot "bin"
$modName = (Get-Item $PSScriptRoot).Name

# Append "_DEV" or "(BETA)" to mod name if env is defined
if ($env -eq "dev") {
    $modName = ConvertTo-Acronym $modName
    $modName += "_DEV"
}
elseif ($env -eq "beta") {
    $modName += "(BETA)"
}

# Set SpaceEngineers Mods directory and mod namespace
$seModsDirectory = Join-Path $env:APPDATA "SpaceEngineers\Mods"
$seModNamespace = $modName

# Check if $seModsDirectory is set
if ([string]::IsNullOrWhiteSpace($seModsDirectory)) {
    Write-Host "Space Engineers Mods folder not found"
    return
}

# Check if $modDirectory is set
if ([string]::IsNullOrWhiteSpace($modDirectory)) {
    Write-Host "No 'Mod' directory found"
    return
}

# Check if $modDirectory is set
if ([string]::IsNullOrWhiteSpace($scriptsDirectory)) {
    Write-Host "No 'Scripts' directory found"
    return
}

# Set SE mod path and scripts path
$seModPath = Join-Path $seModsDirectory $modName
$seModScripts = Join-Path $seModPath "Data\Scripts\$seModNamespace"

# Check if exclude.txt exists
$excludeFile = Join-Path $PSScriptRoot "exclude.txt"
if (-not (Test-Path $excludeFile)) {
    Write-Host "exclude.txt not found"
    return
}

# Read exclude.txt and generate /XD and /XF arguments for robocopy
$excludeList = Get-Content $excludeFile | ForEach-Object {
    # Ignore empty lines and comments
    if (-not ([string]::IsNullOrWhiteSpace($_)) -and $_.TrimStart()[0] -ne "#") {
        # Convert the rule to a format that can be used with /XD or /XF
        $rule = $_.Trim()
        if ($rule.EndsWith("\") -or $rule.EndsWith("/")) {
            "/XD $($rule.TrimEnd("/\"))"
        }
        else {
            "/XF $rule"
        }
    }
} | Out-String
$excludeList = $excludeList.TrimEnd()

$xdList = ($excludeList -split "`r`n" | Where-Object {$_ -match "/XD"}) -replace "/XD ",""
$xfList = ($excludeList -split "`r`n" | Where-Object {$_ -match "/XF"}) -replace "/XF ",""

# Call robocopy to mirror the Mod directory to the SE mod path, excluding files and folders listed in exclude.txt
& robocopy $modDirectory $seModPath /MIR /Z /MT:8 /XJD /FFT /XD $xdList /XF $xfList /NC /NDL /NFL /NP /NS

if ($env -eq "dev" -or $env -eq "beta") {
    # Delete modinfo.sbmi file if it exists
    $modinfoFile = Join-Path $seModPath "modinfo.sbmi"
    if (Test-Path $modinfoFile) {
        Remove-Item $modinfoFile
    }
    
    # Copy dev or beta subfolder to SE mod path
    $devBetaPath = Join-Path $modDirectory $env
    if (Test-Path $devBetaPath) {
        Copy-Item $devBetaPath\* $seModPath -Recurse -Force
    }
}

# Call robocopy to copy Scripts directory to SE mod Scripts directory
if (Test-Path $scriptsDirectory) {
    & robocopy $scriptsDirectory $seModScripts /MIR /Z /MT:8 /XJD /FFT /XD $xdList /XF $xfList /NC /NDL /NFL /NP /NS

    # Set path to Scripts.csproj
    $csprojPath = Join-Path $scriptsDirectory "Scripts.csproj"

    # Load XML from Scripts.csproj
    $xml = [xml](Get-Content $csprojPath)

    # Get list of linked files
    $linkedFiles = $xml.Project.ItemGroup | Where-Object { $_.Compile } | ForEach-Object { $_.Compile | Where-Object { $_.Link } }

    # Loop through each linked file and copy it to the SE mod Scripts directory
    foreach ($file in $linkedFiles) {
        # Get source path
        $sourcePath = Join-Path $scriptsDirectory $file.Include

        # Get destination path
        $destinationPath = Join-Path $seModScripts $file.Link

        # Copy file to destination path
        Copy-Item $sourcePath $destinationPath -Force
    }

    # Get list of project references
    $projectReferences = $xml.Project.ItemGroup.ProjectReference

    # Loop through each project reference
    foreach ($reference in $projectReferences) {
        # Get project path
        $projectPath = Join-Path $scriptsDirectory $reference.Include

        if ($projectPath -eq (Join-Path $scriptsDirectory "\")) {
            continue
        }

        $includeParts = $reference.Include.Split('\')
        $baseFolder = $includeParts[1]

        # Copy all files from project directory to SE mod Scripts directory
        $projectDirectory = Split-Path $projectPath
        $destinationDirectory = Join-Path $seModScripts $baseFolder $reference.Name
        Write-Host "Copying $projectDirectory to $destinationDirectory"
        # Copy-Item "$projectDirectory\*" $destinationDirectory -Recurse -Force -Exclude "obj","bin"
        & robocopy $projectDirectory $destinationDirectory /MIR /Z /MT:8 /XJD /FFT /XD $xdList /XF $xfList /NC /NDL /NFL /NP /NS
    }
}

if (Test-Path $artifactDirectory -PathType Container) {
    # Update zip file
    $artifact = Get-ChildItem -Path $artifactDirectory -Filter *.zip | Select-Object -First 1

    if ($artifact) {
        Write-Host "Updating artifact $($artifact.FullName)"

        # Check if 7-Zip is installed
        if (Get-Command 7z -ErrorAction SilentlyContinue) {
            # Update the zip file using 7-Zip
            & 7z u -up0q0r2x2y2z1w2 "$artifact" "$seModPath"
        }
        else {
            Write-Error "7-Zip is not installed"
        }
    }
    else {
        Write-Warning "No zip files found in $artifactDirectory"
    }

    # # Generate version number using GitVersion
    # $gitVersion = & GitVersion /output buildserver /showvariable SemVer

    # # Check if GitVersion was successful
    # if ($LASTEXITCODE -ne 0) {
    #     Write-Error "GitVersion failed"
    #     return
    # }

    # # Rename artifact file with version number
    # $newName = "$modName.$gitVersion.zip"
    # $newPath = Join-Path $artifactDirectory $newName
    # Rename-Item $artifact.FullName $newPath -Force
}
else {
    Write-Warning "Artifact directory $artifactDirectory does not exist"
}