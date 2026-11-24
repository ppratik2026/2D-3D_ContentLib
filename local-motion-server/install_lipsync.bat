@echo off
rem Optional: LatentSync lip-sync (needs git + an NVIDIA GPU with 8 GB+). Own venv so its versions do not clash.
setlocal
cd /d "%~dp0"
where git >nul 2>nul || (echo git not found. Install it from https://git-scm.com/download/win & pause & exit /b 1)
set PY=
where py >nul 2>nul && (py -3.10 -c "" >nul 2>nul && set "PY=py -3.10")
if not defined PY (where py >nul 2>nul && (py -3.11 -c "" >nul 2>nul && set "PY=py -3.11"))
if not defined PY (set "PY=python")
if not exist LatentSync git clone https://github.com/bytedance/LatentSync.git
cd LatentSync
%PY% -m venv venv || (echo Could not create venv & pause & exit /b 1)
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo LatentSync install failed & pause & exit /b 1)
pip install huggingface_hub
huggingface-cli download ByteDance/LatentSync-1.5 --local-dir checkpoints --exclude "*.git*" "README.md"
echo.
echo Lip-sync installed. start_ltx.bat / start_wan.bat use it by themselves.
pause
