import os
import subprocess
import shutil
import sys

def run_command(command, cwd=None, shell=True):
    """Run a shell command."""
    print(f"Running: {command} in {cwd or '.'}")
    try:
        subprocess.check_call(command, cwd=cwd, shell=shell)
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        sys.exit(1)

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    frontend_dir = os.path.join(root_dir, "frontend")
    backend_dir = os.path.join(root_dir, "backend")

    print("=== Building Desktop Application ===")

    # 1. Build Frontend (Vite)
    print("\n--- Step 1: Building Frontend ---")
    run_command("npm run build", cwd=frontend_dir)

    # 2. Build Backend (PyInstaller)
    print("\n--- Step 2: Building Backend Executable ---")
    # Ensure PyInstaller is installed
    # run_command("pip install -r requirements.txt", cwd=backend_dir) # Optional: ensure deps
    
    # Clean previous build
    dist_dir = os.path.join(backend_dir, "dist")
    build_dir = os.path.join(backend_dir, "build")
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)

    # Run PyInstaller
    # We use sys.executable to ensure we use the current python interpreter
    run_command(f'"{sys.executable}" -m PyInstaller desktop.spec', cwd=backend_dir)

    # Verify artifact
    exe_name = "asn_backend.exe" if os.name == 'nt' else "asn_backend"
    exe_path = os.path.join(backend_dir, "dist", exe_name)
    if not os.path.exists(exe_path):
        print(f"Error: Backend executable not found at {exe_path}")
        sys.exit(1)
    print(f"Backend executable created at: {exe_path}")

    # 3. Build Electron App
    print("\n--- Step 3: Packaging Electron App ---")
    # npm run electron:build runs "tsc -b && vite build && electron-builder"
    # We already ran vite build, but electron-builder needs to run.
    # Our script 'electron:build' does everything.
    # However, electron-builder needs to find the backend exe.
    # We configured extraResources to look at ../backend/dist/asn_backend.exe
    # So it should be fine.
    
    run_command("npm run electron:build", cwd=frontend_dir)

    print("\n=== Build Complete ===")
    release_dir = os.path.join(frontend_dir, "release")
    print(f"Installers available in: {release_dir}")

if __name__ == "__main__":
    main()





