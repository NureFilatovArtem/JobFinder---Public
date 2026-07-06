#!/bin/bash
# Check if Node.js is installed

echo "Checking Node.js installation..."
echo ""

if command -v node &> /dev/null; then
    echo "✅ Node.js is installed!"
    echo "Version: $(node --version)"
    echo ""
    if command -v npm &> /dev/null; then
        echo "✅ npm is installed!"
        echo "Version: $(npm --version)"
        echo ""
        echo "You can now run: npm install"
    else
        echo "❌ npm is not found (this should not happen if Node.js is installed correctly)"
    fi
else
    echo "❌ Node.js is NOT installed"
    echo ""
    echo "Please install Node.js:"
    echo "1. Go to https://nodejs.org/"
    echo "2. Download the LTS version"
    echo "3. Install the .pkg file"
    echo "4. Open a new terminal and try again"
    echo ""
    echo "Or see QUICK_START.md for detailed instructions"
fi
