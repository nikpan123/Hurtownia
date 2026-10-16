@echo off
cd /d "%~dp0"
call npm.cmd ci --ignore-scripts --no-audit --no-fund
pause
