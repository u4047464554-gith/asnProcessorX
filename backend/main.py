from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import asn

app = FastAPI(title="ASN.1 Stream Processor")

# Allow CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(asn.router, prefix="/api/asn", tags=["asn"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}

