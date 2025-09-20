@echo off
echo Stopping all services...

REM Kill any existing Node.js processes
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% NEQ 0 echo No Node.js processes found.

REM Kill any existing Python processes
taskkill /F /IM python.exe 2>nul
if %ERRORLEVEL% NEQ 0 echo No Python processes found.

echo Waiting for processes to terminate...
timeout /t 2 /nobreak >nul

echo Starting services...
echo.

REM Start the Node.js server
start cmd /k "node server.js"

echo Waiting for server to start...
timeout /t 5 /nobreak >nul

echo Services restarted successfully!
echo.
echo You can now access the application at http://localhost:3001 (or the port shown in the server console) 