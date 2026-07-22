@echo off
echo ==========================================
echo    LAN CHAT - Starting Server...
echo ==========================================

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please download from https://nodejs.org
    pause
    exit /b
)

:: Go to the folder where this .bat file is
cd /d "%~dp0"

:: Install packages if node_modules missing
if not exist "node_modules" (
    echo Installing packages...
    call npm install ws uuid
)

:: Open firewall port silently
netsh advfirewall firewall delete rule name="LAN Chat" >nul 2>nul
netsh advfirewall firewall add rule name="LAN Chat" dir=in action=allow protocol=TCP localport=8765 >nul 2>nul

echo.
echo Starting server...
echo.
node server.js
pause
