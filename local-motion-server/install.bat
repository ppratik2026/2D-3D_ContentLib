@echo off
rem AI motion server — one-time install (NVIDIA GPU needed for real models)
setlocal
cd /d "%~dp0"
set PY=
where py >nul 2>nul && (py -3.11 -c "" >nul 2>nul && set "PY=py -3.11")
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (echo Python not found. Install Python 3.11 from https://www.python.org/downloads/ and tick "Add python.exe to PATH". & pause & exit /b 1)
where nvidia-smi >nul 2>nul || (echo No NVIDIA GPU found. Use the Kaggle / Colab notebook instead (free GPU). Installing anyway for the mock test... )
%PY% -m venv venv || (echo Could not create venv & pause & exit /b 1)
call venv\Scripts\activate.bat
python -m pip install --upgrade pip wheel
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124 || pip install torch torchvision
pip install "diffusers>=0.33" transformers accelerate sentencepiece ftfy imageio imageio-ffmpeg pillow || (echo Install failed & pause & exit /b 1)
echo.
echo Done. Start the server with start_ltx.bat (12-16 GB GPU) or start_wan.bat (24 GB GPU).
echo The first start downloads the model (LTX about 10 GB, Wan about 40 GB).
pause
