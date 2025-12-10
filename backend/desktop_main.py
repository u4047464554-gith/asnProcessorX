import sys
import os
import socket
import uvicorn
import multiprocessing
import mimetypes
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

# Setup Logging
log_dir = os.path.join(os.environ["USERPROFILE"], "AsnProcessorLogs")
if not os.path.exists(log_dir):
    try:
        os.makedirs(log_dir)
    except Exception:
        log_dir = os.getcwd()

log_file = os.path.join(log_dir, 'backend.log')

logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filemode='w'
)
logger = logging.getLogger(__name__)

# Add the current directory to sys.path to ensure we can import 'backend' if we are running from root
# But in PyInstaller, sys.path is handled differently.
# If we added '..' to pathex, we should be able to import 'backend.main'.

# Try importing backend.main
try:
    from backend.main import app
except ImportError:
    # Fallback: if we are running as a script inside the bundle where 'backend' is flattened?
    # Or if we are running from source in backend/ dir?
    try:
        from main import app
    except ImportError as e:
        # This will be caught by the logger below
        raise ImportError(f"Could not import backend.main or main: {e}")

def get_free_port():
    """Find a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
        logger.info(f"Found free port: {port}")
        return port

def setup_static_serving(dist_path: str):
    """Configure the app to serve the frontend static files."""
    logger.info(f"Setting up static serving from: {dist_path}")
    
    if not os.path.exists(dist_path):
        logger.error(f"Frontend dist not found at: {dist_path}")
        return

    # Force correct MIME types
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("image/svg+xml", ".svg")

    # Mount assets
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.exists(assets_dir):
        logger.info(f"Mounting /assets to {assets_dir}")
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    else:
        logger.warning(f"Assets directory not found at {assets_dir}")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        logger.debug(f"Serving request: /{full_path}")
        
        file_path = os.path.join(dist_path, full_path)
        if os.path.isfile(file_path):
             return FileResponse(file_path)
        
        index_path = os.path.join(dist_path, "index.html")
        if os.path.exists(index_path):
            logger.debug("Serving index.html for SPA")
            return FileResponse(index_path)
        
        logger.error(f"404 - File not found. Request: {full_path}")
        return HTMLResponse(content=f"<h1>Frontend Error</h1><p>File not found: {full_path}</p><p>Looked in: {dist_path}</p>", status_code=404)

def main():
    try:
        multiprocessing.freeze_support()
        logger.info(f"Backend started. Args: {sys.argv}")
        
        frontend_dist = None
        if len(sys.argv) > 1:
            frontend_dist = sys.argv[1]
            logger.info(f"Frontend dist path provided: {frontend_dist}")
        
        if frontend_dist:
            setup_static_serving(frontend_dist)
        else:
            logger.warning("No frontend dist path argument provided!")

        port = get_free_port()
        
        msg = f"SERVER_READY: {port}"
        print(msg, flush=True)
        logger.info(msg)
        
        logger.info("Starting Uvicorn...")
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    except Exception:
        logger.exception("Critical error in main")
        sys.exit(1)

if __name__ == "__main__":
    main()
