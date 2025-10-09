@echo off
REM Social Media Backend Startup Script for Windows

echo 🚀 Starting Social Media Backend Server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    echo    Visit: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo.
    echo 📦 Virtual environment not found. Creating one...
    python -m venv venv
    echo ✓ Virtual environment created
)

REM Activate virtual environment
echo.
echo 🔌 Activating virtual environment...
call venv\Scripts\activate

REM Install dependencies
echo.
echo 📚 Installing dependencies...
pip install -r requirements.txt --quiet

REM Start the server
echo.
echo ✨ Starting FastAPI server...
echo    API: http://localhost:8000
echo    Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python main.py

