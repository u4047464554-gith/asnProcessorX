from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.routers import asn, config, files, messages
from backend.core.manager import manager

# New import for MSC router
from backend.routers.msc import router as msc_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load protocols on startup
    manager.load_protocols()
    yield
    # Clean up if needed

app = FastAPI(title="ASN.1 Processor API", version="0.3.0")

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
app.include_router(config.router, prefix="/api", tags=["Config"])
app.include_router(files.router, prefix="/api", tags=["Files"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])

# New MSC router
app.include_router(msc_router, prefix="/api", tags=["MSC"])

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "0.3.0",
        "protocols_loaded": len(manager.list_protocols())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
