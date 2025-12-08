#!/bin/bash
# Simple shell script to run the ASN Processor web app  
# Make executable: chmod +x RUN_WEBAPP.sh
# Then run: ./RUN_WEBAPP.sh

echo ""
echo "========================================="
echo "  ASN.1 Processor - Web App Launcher"
echo "========================================="
echo ""
echo "Starting the web application..."
echo "Please wait, this may take a moment."
echo ""

python3 scripts/run_webapp.py

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to start the application."
    echo ""
    echo "Troubleshooting:"
    echo "  1. Make sure Python 3 is installed"
    echo "  2. Make sure Node.js is installed"
    echo "  3. Make this script executable: chmod +x RUN_WEBAPP.sh"
    echo "  4. Try running: python3 scripts/run_webapp.py"
    echo ""
    read -p "Press Enter to exit..."
fi
