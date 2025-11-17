@echo off
echo ======================================
echo QuiverDM Whisper Setup
echo ======================================
echo.

echo Checking Python installation...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.10 or higher from python.org
    pause
    exit /b 1
)
echo.

echo Installing Python dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo Checking CUDA availability...
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda if torch.cuda.is_available() else 'N/A')"
echo.

echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo To test transcription, run:
echo   npm run test:transcribe
echo.
pause
