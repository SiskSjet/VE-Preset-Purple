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

function Run-Robocopy {
    param (
        [string]$SourceDirectory,
        [string]$DestinationDirectory,
        $xdList,
        $xfList
    )

    # Run Robocopy command and capture exit code
    & robocopy $SourceDirectory $DestinationDirectory /MIR /Z /MT:8 /XJD /FFT /XD $xdList /XF $xfList /NDL /NFL /NJH /NJS /NS /NC /NP 2>&1 > $null

    $exitCode = $LASTEXITCODE

    # Check exit code and display status
    switch ($exitCode) {
        0 { Write-Warning "No files were copied, no failure occurred." }
        1 { Write-Host "All files were copied successfully." }
        2 { Write-Warning "Some extra files or directories were detected. No files were copied or the files were skipped." }
        3 { Write-Warning "Some files were copied. Additional files were present, but not copied due to failure to verify." }
        4 { Write-Error "Some files or directories were not copied due to an error." }
        5 { Write-Error "Retry limit exceeded or some files were skipped due to security settings." }
        default { Write-Error "Robocopy failed with exit code $exitCode." }
    }
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
} elseif ($env -eq "beta") {
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

Write-Host "=============================================================="
Write-Host " Name  : $modName"
Write-Host " Source: $PSScriptRoot"
Write-Host " Dest  : $seModPath"
Write-Host "=============================================================="

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
        } else {
            "/XF $rule"
        }
    }
} | Out-String
$excludeList = $excludeList.TrimEnd()

$xdList = ($excludeList -split "`r`n" | Where-Object {$_ -match "/XD"}) -replace "/XD ",""
$xfList = ($excludeList -split "`r`n" | Where-Object {$_ -match "/XF"}) -replace "/XF ",""

# Call robocopy to mirror the Mod directory to the SE mod path, excluding files and folders listed in exclude.txt
Write-Host "Copying mod files"
Run-Robocopy -SourceDirectory $modDirectory -DestinationDirectory $seModPath -xdList $xdList -xfList $xfList

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
    Write-Host "Copying scripts"
    Run-Robocopy -SourceDirectory $scriptsDirectory -DestinationDirectory $seModScripts -xdList $xdList -xfList $xfList

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
        $destinationFolder = Split-Path $destinationPath -Parent

        # Create the artifact directory if it doesn't exist
        if (!(Test-Path $destinationFolder -PathType Container)) {
            New-Item -ItemType Directory -Path $destinationFolder | Out-Null
        }

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

        $name = ""
        # check if $reference.Name is ProjectReference
        if ($reference.Name -eq "ProjectReference") {
            # get name from $reference.Include file name without extension
            $name = (Get-Item (Join-Path $scriptsDirectory $reference.Include)).BaseName
        } else {
            $name = $reference.Name
        }

        $destinationDirectory = Join-Path $seModScripts $baseFolder $name
        Write-Host ""
        Write-Host "Copying $projectDirectory to $destinationDirectory"
        # Copy-Item "$projectDirectory\*" $destinationDirectory -Recurse -Force -Exclude "obj","bin"
        Write-Host "Copying $projectDirectory\*"
        Run-Robocopy -SourceDirectory $projectDirectory -DestinationDirectory $destinationDirectory -xdList $xdList -xfList $xfList
    }
}

function Update-ZipFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$ArtifactDirectory,
        [Parameter(Mandatory=$true)]
        [string]$SeModPath,
        [Parameter(Mandatory=$true)]
        [string]$ModName
    )

    try {
        # Create the artifact directory if it doesn't exist
        if (!(Test-Path $ArtifactDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $ArtifactDirectory | Out-Null
        }

        $artifact = Get-ChildItem -Path $ArtifactDirectory -Filter *.zip | Select-Object -First 1
        if ($artifact) {
            Write-Host ""
            Write-Host "Updating artifact $($artifact.FullName)"

            # Check if 7-Zip is installed
            if (Get-Command 7z -ErrorAction SilentlyContinue) {
                # Update the zip file using 7-Zip
                & 7z u -up0q0r2x2y2z1w2 "$artifact" "$SeModPath"
            } else {
                # Use Compress-Archive to update the zip file
                Compress-Archive -Path $SeModPath -Update -DestinationPath $artifact -CompressionLevel Optimal
            }
        } else {
            # Create a new zip file using 7-Zip if it's available, otherwise use Compress-Archive
            $zipFileName = "$ModName.zip"
            $artifact = Join-Path $ArtifactDirectory $zipFileName

            Write-Host ""
            Write-Host "Creating new artifact $ModName.zip"

            if (Get-Command 7z -ErrorAction SilentlyContinue) {
                # Use 7-Zip to create the zip file
                & 7z a -tzip "$artifact" "$SeModPath"
            } else {
                # Use Compress-Archive to create the zip file
                Compress-Archive -Path $SeModPath -DestinationPath $artifact -CompressionLevel Optimal
            }
        }

        if (Get-Command gitversion -ErrorAction SilentlyContinue){
            $semver = & gitversion /showvariable SemVer
            Rename-Item $artifact "$ModName.$semver.zip"
        }
    }
    catch {
        Write-Error $_.Exception.Message
    }
}

Update-ZipFile -ArtifactDirectory $artifactDirectory -SeModPath $seModPath -ModName $modName