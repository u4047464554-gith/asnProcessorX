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







