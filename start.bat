@echo off
TITLE Agritech Launcher
echo ===================================================
echo            Agritech Research ^& Lab System
echo ===================================================
echo.

:: Check if Node.js is installed
node -v >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found on your system!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules folder exists
if not exist node_modules (
    echo [INFO] First-time setup: Installing dependencies...
    echo This may take a minute. Please wait...
    echo.
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo Please ensure you are connected to the internet and try again.
        echo.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Agritech application...
call npm.cmd start
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application exited with an error.
    echo.
    pause
)
