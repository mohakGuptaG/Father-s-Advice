@echo off
setlocal enabledelayedexpansion

:: Set colors for Windows
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "NC=[0m"

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%Python is not installed. Please install Python 3.8 or higher.%NC%
    exit /b 1
)

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%Node.js is not installed. Please install Node.js 14 or higher.%NC%
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo %RED%npm is not installed. Please install npm.%NC%
    exit /b 1
)

:: Create logs directory if it doesn't exist
if not exist logs mkdir logs

:: Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo %RED%Failed to install Python dependencies.%NC%
    exit /b 1
)

:: Install Node.js dependencies
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo %RED%Failed to install Node.js dependencies.%NC%
    exit /b 1
)

:: Start Python services
echo Starting Python services...
start /B python run_services.py > logs\python_services.log 2>&1

:: Start mentor processor
echo Starting mentor processor...
start /B python mentor_processor.py > logs\mentor_processor.log 2>&1

:: Wait for Python services to initialize
echo Waiting for Python services to initialize...
timeout /t 5 /nobreak > nul

:: Start Node.js server
echo Starting Node.js server...
start /B node server.js > logs\node_server.log 2>&1

:: Wait for Node.js server to initialize
echo Waiting for Node.js server to initialize...
timeout /t 5 /nobreak > nul

:: Check if services are running
echo Checking services...
python -c "import requests; requests.get('http://localhost:5001/health')" >nul 2>&1
if errorlevel 1 (
    echo %RED%Python services failed to start.%NC%
    type logs\python_services.log
    exit /b 1
)

node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" >nul 2>&1
if errorlevel 1 (
    echo %RED%Node.js server failed to start.%NC%
    type logs\node_server.log
    exit /b 1
)

echo %GREEN%All services are running successfully!%NC%
echo.
echo Python services:
echo - Mentor Processor: http://localhost:5003
echo - API Service: http://localhost:5001
echo - Workflow Service: http://localhost:5002
echo - Algorithm Service: http://localhost:5000
echo.
echo Node.js server: http://localhost:3000
echo.
echo Press Ctrl+C to stop all services.
echo Logs are available in the 'logs' directory.

:: Keep the script running and handle Ctrl+C
:loop
timeout /t 1 /nobreak > nul
goto loop 