@echo off
echo Starting Python services...

REM Start mentor_processor.py
start "Mentor Processor" cmd /k "python mentor_processor.py"
timeout /t 5

REM Start api.py
start "API Service" cmd /k "python api.py"
timeout /t 5

REM Start algo.py
start "Algorithm Service" cmd /k "python algo.py"
timeout /t 5

echo All services started!
echo Press any key to exit...
pause 