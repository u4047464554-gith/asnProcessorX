import os
import pytest
from fastapi.testclient import TestClient
import httpx

from backend.main import app

@pytest.fixture
def client():
    """
    Returns a client for testing.
    If TEST_API_URL env var is set, returns an httpx.Client connected to that URL (Integration Test).
    Otherwise, returns a TestClient wrapping the local FastAPI app (Unit Test).
    """
    api_url = os.getenv("TEST_API_URL")
    
    if api_url:
        print(f"\n[TEST] Running integration tests against {api_url}")
        with httpx.Client(base_url=api_url, timeout=10.0) as http_client:
            yield http_client
    else:
        with TestClient(app) as test_client:
            yield test_client

@pytest.fixture(autouse=True)
def temp_msc_storage(tmp_path):
    """
    Automatically use a temporary MSC storage directory for all tests.
    This ensures tests don't interfere with production data and run in isolation.
    """
    from backend.core.config import config_manager
    
    # Save original config
    original_path = config_manager.config.msc_storage_path
    
    # Set temporary storage path for tests
    temp_storage = str(tmp_path / "msc_storage_test")
    config_manager.config.msc_storage_path = temp_storage
    
    yield temp_storage
    
    # Restore original config
    config_manager.config.msc_storage_path = original_path











