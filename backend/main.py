from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.routers import asn, config, files, messages, scratchpad, sessions
from backend.core.manager import manager
from backend.version import __version__

# New import for MSC router
from backend.routers.msc import router as msc_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load protocols on startup
    manager.load_protocols()
    yield
    # Clean up if needed

app = FastAPI(title="ASN.1 Processor API", version=__version__)

# Allow CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing routers
app.include_router(asn.router, prefix="/api/asn", tags=["ASN"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(files.router, prefix="/api", tags=["Files"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])
app.include_router(scratchpad.router, prefix="/api/scratchpad", tags=["Scratchpad"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])

# New MSC router
app.include_router(msc_router, prefix="/api", tags=["MSC"])

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": __version__,
        "protocols_loaded": len(manager.list_protocols())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
