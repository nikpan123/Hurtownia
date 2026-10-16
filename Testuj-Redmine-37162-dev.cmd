@echo off
cd /d "%~dp0"
node api-tests/redmine-37162-run.mjs
pause
