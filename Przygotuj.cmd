@echo off
cd /d "%~dp0"
node api-tests/setup.mjs
if errorlevel 1 exit /b 1
call npm.cmd ci --ignore-scripts --no-audit --no-fund
pause
