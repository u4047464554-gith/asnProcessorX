#!/usr/bin/env python
"""
Backend server launcher with port conflict detection.
Prevents multiple servers from binding to the same port.
"""
import socket
import sys
import subprocess

HOST = "127.0.0.1"
PORT = 8000


def is_port_in_use(host: str, port: int) -> bool:
    """Check if a port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return False
        except OSError:
            return True


def main():
    if is_port_in_use(HOST, PORT):
        print(f"\n[ERROR] Port {PORT} is already in use!")
        print(f"   Another server may be running on {HOST}:{PORT}")
        print("\n   To fix this, either:")
        print(f"   1. Kill the existing process: netstat -ano | findstr :{PORT}")
        print("      Then: taskkill /PID <pid> /F")
        print("   2. Or use a different port by editing this script")
        print()
        sys.exit(1)
    
    print(f"[OK] Port {PORT} is available. Starting server...")
    print(f"   URL: http://{HOST}:{PORT}")
    print(f"   Docs: http://{HOST}:{PORT}/docs")
    print()
    
    # Start uvicorn with reload
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--reload",
        "--host", HOST,
        "--port", str(PORT)
    ])


if __name__ == "__main__":
    main()

