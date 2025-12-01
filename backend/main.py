from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.routers import asn, config, files, messages
from backend.core.manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load protocols on startup
    manager.load_protocols()
    yield
    # Clean up if needed

app = FastAPI(title="ASN.1 Stream Processor", lifespan=lifespan)

# Allow CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(asn.router, prefix="/api/asn", tags=["asn"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.3.0"}
