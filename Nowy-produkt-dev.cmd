@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:18767/#create-product"
node dashboard/server.mjs
pause
