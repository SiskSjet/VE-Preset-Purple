@echo off

set mod_dir=%~dp0Mod
for %%* in (.) do set mod_name=%%~nx*
set se_mods_dir=%appdata%\SpaceEngineers\Mods
set se_mod_namespace=Sisk
set se_mod_path=%se_mods_dir%\%mod_name%
set se_mod_scripts=%se_mod_path%\Data\Scripts\%se_mod_namespace%

if not exist "%se_mods_dir%" goto NO_SE_MODS_DIR
if not exist "%mod_dir%\" goto NO_MOD_DIR

if exist "%se_mod_path%\" rmdir /s /q "%se_mod_path%\"

echo copy files from 'Mod'
xcopy "%mod_dir%\*" "%se_mod_path%\" /s /e /q /exclude:exclude.txt

rem create exclude list for findstr
(for /f "tokens=*" %%L in ('FINDSTR "^\\.*" "exclude.txt"') do echo %%~nxL) > "%tmp%\exclude.txt"

rem for /D %%G in (*) do (
for /F %%G in ('dir /ad /b ^| findstr /l /i /x /v /g:"%tmp%\exclude.txt"') do (
	if not %%~nxG == Mod (
		if not %%~nxG == Scripts (
			echo copy files from '%%G'
			xcopy "%~dp0%%G\*" "%se_mod_scripts%\%%G\" /s /e /q /exclude:exclude.txt
		)
	)
)

del "%tmp%\exclude.txt"

goto EXIT

:NO_SE_MODS_DIR
echo Space Engineers Mods folder not found
goto EXIT

:NO_MOD_DIR
echo No 'Mod' directory found
goto EXIT

:EXIT
pause