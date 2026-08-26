@echo off
cd /d "%~dp0"
start "fun-games-hub-server (닫으면 미리보기 꺼짐)" /min node scripts\serve.js
timeout /t 2 /nobreak >nul
start http://localhost:8844/index.html
