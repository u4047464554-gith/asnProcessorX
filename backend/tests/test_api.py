from backend.main import app
import sys
import os

# Add project root to sys.path so we can import backend
sys.path.append(os.getcwd())

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.3.0"

def test_list_protocols(client):
    response = client.get("/api/asn/protocols")
    assert response.status_code == 200
    protocols = response.json()
    assert "simple_demo" in protocols
    assert "rrc_demo" in protocols

def test_decode_person(client):
    # Hex for Person(name='Alice', age=30, isAlive=True)
    # Generated with constraints: 8200416c6963653c
    hex_data = "8200416c6963653c"
    
    payload = {
        "hex_data": hex_data,
        "protocol": "simple_demo",
        "type_name": "Person",
        "encoding_rule": "per"
    }
    
    response = client.post("/api/asn/decode", json=payload)
    # Print response for debugging if it fails
    if response.status_code != 200:
        print(response.json())
        
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert data["decoded_type"] == "Person"
    assert data["data"]["name"] == "Alice"
    assert data["data"]["age"] == 30
    assert data["data"]["isAlive"] is True

def test_encode_person(client):
    payload = {
        "protocol": "simple_demo",
        "type_name": "Person",
        "data": {
            "name": "Bob",
            "age": 25,
            "isAlive": False
            # secret omitted
        },
        "encoding_rule": "per"
    }
    
    response = client.post("/api/asn/encode", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # Verify hex. Bob (3 chars) + Age 25 + False
    # Just check we got some hex back
    assert len(data["hex_data"]) > 0

def test_encode_constraint_fail(client):
    payload = {
        "protocol": "simple_demo",
        "type_name": "Person",
        "data": {
            "name": "TooOld",
            "age": 200,  # Max is 120
            "isAlive": True
        },
        "encoding_rule": "per"
    }
    
    response = client.post("/api/asn/encode", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "failure"
    assert "Validation Error" in response.json()["error"]
