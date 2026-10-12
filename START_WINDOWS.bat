@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 launcher.py
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python launcher.py
    ) else (
        echo Python 3 not found. Install Python 3.10+ from python.org and rerun.
    )
)
echo.
echo Application stopped. Check the messages above.
pause
