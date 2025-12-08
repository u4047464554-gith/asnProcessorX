@echo off
REM Simple batch file to run the ASN Processor web app
REM Double-click this file to start the application!

title ASN.1 Processor - Starting...

echo.
echo =========================================
echo   ASN.1 Processor - Web App Launcher
echo =========================================
echo.
echo Starting the web application...
echo Please wait, this may take a moment.
echo.

python scripts\run_webapp.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start the application.
    echo.
    echo Troubleshooting:
    echo   1. Make sure Python is installed
    echo   2. Make sure Node.js is installed  
    echo   3. Try running: python scripts\run_webapp.py
    echo.
    pause
)
