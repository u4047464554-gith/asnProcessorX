import sys
import os
import socket
import uvicorn
import multiprocessing
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import Request

# Import the existing FastAPI app
from backend.main import app

def get_free_port():
    """Find a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def setup_static_serving(dist_path: str):
    """Configure the app to serve the frontend static files."""
    if not os.path.exists(dist_path):
        print(f"[WARNING] Frontend dist not found at: {dist_path}")
        return

    # Mount assets and other static files
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    # Serve other root files (favicon, etc.) if needed, or just rely on catch-all?
    # Usually it's better to mount the root, but that conflicts with API routes if not careful.
    # Since API is at /api/asn and /health, we can mount static files at / if we are careful,
    # or use a catch-all route for index.html and let StaticFiles handle the rest if we mount it.
    
    # However, standard SPA pattern with FastAPI:
    # 1. API routes are already defined.
    # 2. Mount /assets.
    # 3. Catch-all route serving index.html.

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Check if file exists in dist
        file_path = os.path.join(dist_path, full_path)
        if os.path.isfile(file_path):
             return FileResponse(file_path)
        
        # Otherwise serve index.html for SPA routing
        index_path = os.path.join(dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend not found"}

def main():
    # multiprocessing.freeze_support() is needed for PyInstaller
    multiprocessing.freeze_support()
    
    # Determine frontend dist path
    # In development, it might be passed as arg or relative.
    # In production (PyInstaller), we expect it might be passed or bundled.
    # The plan says: "Pass the path to frontend/dist as an argument to the backend."
    
    frontend_dist = None
    if len(sys.argv) > 1:
        frontend_dist = sys.argv[1]
    
    if frontend_dist:
        setup_static_serving(frontend_dist)

    port = get_free_port()
    
    # Print the signal for Electron
    # We need to flush stdout so Electron receives it immediately
    print(f"SERVER_READY: {port}", flush=True)
    
    # Run Uvicorn
    # log_level="error" to keep stdout clean for the signal, although we already printed it.
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")

if __name__ == "__main__":
    main()

