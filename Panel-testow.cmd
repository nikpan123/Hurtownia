@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:18767"
call npm.cmd run ui
pause
