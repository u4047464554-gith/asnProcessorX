import os
import sys
import time
import subprocess
import threading
import signal

def run_tests_against_release():
    print("=== Testing Release Backend ===")
    
    # 1. Find the executable
    # It should be in frontend/release/win-unpacked/resources/asn_backend.exe
    # Or if we want to test just the backend build: backend/dist/asn_backend.exe
    # Let's test the one in the release folder to be sure it's what the user gets.
    
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    exe_path = os.path.join(root_dir, "frontend", "release", "win-unpacked", "resources", "asn_backend.exe")
    dist_path = os.path.join(root_dir, "frontend", "release", "win-unpacked", "resources", "dist")
    
    if not os.path.exists(exe_path):
        print(f"Executable not found at: {exe_path}")
        print("Please run 'python scripts/build_desktop.py' first.")
        sys.exit(1)
        
    print(f"Executable found: {exe_path}")
    
    # 2. Start the backend
    # We need to capture stdout to find the port
    print("Starting backend process...")
    process = subprocess.Popen(
        [exe_path, dist_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=os.path.dirname(exe_path)
    )
    
    port = None
    
    try:
        # Read stdout line by line until we find SERVER_READY
        # We use a thread to read stdout so we don't block
        def read_stdout():
            nonlocal port
            for line in process.stdout:
                print(f"[BACKEND] {line.strip()}")
                if "SERVER_READY:" in line:
                    parts = line.split(":")
                    if len(parts) > 1:
                        port = parts[1].strip()
                        
        t = threading.Thread(target=read_stdout)
        t.daemon = True
        t.start()
        
        # Wait for port
        print("Waiting for backend to initialize...")
        start_time = time.time()
        while port is None:
            if time.time() - start_time > 10:
                print("Timeout waiting for backend to start.")
                break
            time.sleep(0.1)
            
        if not port:
            print("Failed to get port from backend.")
            sys.exit(1)
            
        print(f"Backend is ready on port {port}")
        
        # 3. Run pytest against this URL
        api_url = f"http://127.0.0.1:{port}"
        print(f"Running tests against {api_url}...")
        
        env = os.environ.copy()
        env["TEST_API_URL"] = api_url
        
        # Run pytest on all tests in backend/tests
        # We exclude test_config.py if it depends on file system writes that might conflict
        # but generally it should be fine as it uses a temp config or mocks. 
        # Actually, let's just run all of them.
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "backend/tests", "-v"],
            env=env,
            cwd=root_dir
        )
        
        if result.returncode == 0:
            print("\nSUCCESS: All tests passed against the release executable!")
        else:
            print("\nFAILURE: Tests failed.")
            sys.exit(result.returncode)
            
    finally:
        # 4. Cleanup
        print("Terminating backend...")
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
        print("Done.")

if __name__ == "__main__":
    run_tests_against_release()

