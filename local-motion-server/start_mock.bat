@echo off
title AI motion: mock (port 7871)
cd /d "%~dp0"
if not exist venv\Scripts\activate.bat (echo Run install.bat first. & pause & exit /b 1)
call venv\Scripts\activate.bat
set LS=
if exist LatentSync\venv\Scripts\python.exe (set "LATENTSYNC_PY=%~dp0LatentSync\venv\Scripts\python.exe" & set "LS=--lipsync")
python server.py --model mock --port 7871 %LS%
pause
