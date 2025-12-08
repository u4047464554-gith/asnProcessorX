#!/usr/bin/env python3
"""
Simple script to run the ASN Processor web app locally.
No development experience required - just run this script!

This script will:
1. Check if Python and Node.js are installed
2. Create a virtual environment if needed
3. Install dependencies automatically
4. Start both backend and frontend servers
5. Open the web app in your browser
"""

import os
import sys
import subprocess
import platform
import time
import webbrowser
from pathlib import Path

# Color codes for terminal output (works on Windows 10+ and Unix)
if platform.system() == 'Windows':
    os.system('color')  # Enable ANSI colors on Windows

GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_step(message):
    """Print a step message with color."""
    print(f"\n{BLUE}▶ {message}{RESET}")

def print_success(message):
    """Print a success message with color."""
    print(f"{GREEN}✓ {message}{RESET}")

def print_warning(message):
    """Print a warning message with color."""
    print(f"{YELLOW}⚠ {message}{RESET}")

def print_error(message):
    """Print an error message with color."""
    print(f"{RED}✗ {message}{RESET}")

def check_command(command, name, install_url):
    """Check if a command exists."""
    try:
        result = subprocess.run([command, '--version'], 
                              capture_output=True, 
                              text=True,
                              timeout=5)
        if result.returncode == 0:
            version = result.stdout.split('\n')[0]
            print_success(f"{name} is installed: {version}")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError):
        pass
    
    print_error(f"{name} is not installed!")
    print(f"  Please install from: {install_url}")
    return False

def run_command(command, cwd=None, shell=True):
    """Run a command and return success status."""
    try:
        subprocess.check_call(command, cwd=cwd, shell=shell)
        return True
    except subprocess.CalledProcessError:
        return False

def main():
    """Main function to run the web app."""
    print(f"""
{BLUE}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         ASN.1 Processor - Web App Launcher               ║
║                                                           ║
║  This script will automatically set up and run the       ║
║  web application on your computer.                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝{RESET}
""")

    # Get project root directory
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir.parent
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"

    # Step 1: Check prerequisites
    print_step("Step 1/5: Checking prerequisites...")
    
    python_ok = check_command('python', 'Python', 'https://www.python.org/downloads/')
    if not python_ok:
        python_ok = check_command('python3', 'Python', 'https://www.python.org/downloads/')
    
    node_ok = check_command('node', 'Node.js', 'https://nodejs.org/')
    npm_ok = check_command('npm', 'npm', 'https://nodejs.org/')
    
    if not (python_ok and node_ok and npm_ok):
        print_error("\nMissing prerequisites! Please install the required software and try again.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    # Step 2: Setup backend
    print_step("Step 2/5: Setting up backend...")
    
    venv_path = backend_dir / ".venv"
    venv_python = venv_path / "Scripts" / "python.exe" if platform.system() == 'Windows' else venv_path / "bin" / "python"
    
    if not venv_path.exists():
        print("  Creating virtual environment...")
        if not run_command(f'python -m venv .venv', cwd=backend_dir):
            print_error("Failed to create virtual environment!")
            input("\nPress Enter to exit...")
            sys.exit(1)
        print_success("Virtual environment created")
    else:
        print_success("Virtual environment already exists")
    
    # Install backend dependencies
    print("  Installing backend dependencies (this may take a minute)...")
    pip_cmd = f'"{venv_python}" -m pip install -q -r requirements.txt'
    if not run_command(pip_cmd, cwd=backend_dir):
        print_error("Failed to install backend dependencies!")
        input("\nPress Enter to exit...")
        sys.exit(1)
    print_success("Backend dependencies installed")

    # Step 3: Setup frontend
    print_step("Step 3/5: Setting up frontend...")
    
    node_modules = frontend_dir / "node_modules"
    if not node_modules.exists():
        print("  Installing frontend dependencies (this may take 2-3 minutes)...")
        if not run_command('npm install --silent', cwd=frontend_dir):
            print_error("Failed to install frontend dependencies!")
            input("\nPress Enter to exit...")
            sys.exit(1)
        print_success("Frontend dependencies installed")
    else:
        print_success("Frontend dependencies already installed")

    # Step 4: Start servers
    print_step("Step 4/5: Starting servers...")
    
    print("  Starting backend server on http://localhost:8000...")
    backend_process = subprocess.Popen(
        f'"{venv_python}" run_server.py',
        cwd=backend_dir,
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    time.sleep(3)  # Give backend time to start
    print_success("Backend server started")
    
    print("  Starting frontend dev server on http://localhost:5173...")
    frontend_process = subprocess.Popen(
        'npm run dev',
        cwd=frontend_dir,
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    time.sleep(5)  # Give frontend time to compile
    print_success("Frontend dev server started")

    # Step 5: Open browser
    print_step("Step 5/5: Opening web browser...")
    time.sleep(2)
    
    try:
        webbrowser.open('http://localhost:5173')
        print_success("Browser opened!")
    except:
        print_warning("Could not open browser automatically")
        print("  Please open http://localhost:5173 manually")

    # Success message
    print(f"""
{GREEN}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🎉 Web App is Running! 🎉                   ║
║                                                           ║
║  Frontend: http://localhost:5173                         ║
║  Backend:  http://localhost:8000                         ║
║  API Docs: http://localhost:8000/docs                    ║
║                                                           ║
║  Press Ctrl+C to stop the servers                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝{RESET}
""")

    try:
        # Keep script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Shutting down servers...{RESET}")
        backend_process.terminate()
        frontend_process.terminate()
        print_success("Servers stopped. Goodbye!")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"An error occurred: {e}")
        input("\nPress Enter to exit...")
        sys.exit(1)
