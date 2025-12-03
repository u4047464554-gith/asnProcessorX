from fastapi import APIRouter, HTTPException
from backend.core.config import config_manager, AppConfig
from backend.core.manager import manager

router = APIRouter()

@router.get("/", response_model=AppConfig)
async def get_config():
    return config_manager.get()

@router.put("/", response_model=AppConfig)
async def update_config(config: AppConfig):
    try:
        config_manager.save(config)
        # Reload protocols if specs directories changed
        # This is a heavy operation, might want to make it explicit?
        # For now, reload automatically.
        manager.reload()
        return config_manager.get()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))










