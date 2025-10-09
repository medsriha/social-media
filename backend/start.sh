#!/bin/bash

# Social Media Backend Startup Script

echo "🚀 Starting Social Media Backend Server..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    echo "   Visit: https://www.python.org/downloads/"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✓ Python $PYTHON_VERSION found"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 Virtual environment not found. Creating one..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo ""
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo ""
echo "📚 Installing dependencies..."
pip install -r requirements.txt --quiet

# Start the server
echo ""
echo "✨ Starting FastAPI server..."
echo "   API: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python main.py

