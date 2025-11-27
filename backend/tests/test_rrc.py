import pytest
from fastapi.testclient import TestClient
from backend.main import app
import sys
import os

# Add project root to sys.path so we can import backend
sys.path.append(os.getcwd())

def test_encode_rrc():
    # Testing the RRC tuple format for BIT STRING and CHOICE
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": {
            "ue-Identity": {
                "$choice": "randomValue",
                "value": ["0x0123456789", 40]
            },
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1]
        },
        "encoding_rule": "per"
    }
    
    with TestClient(app) as client:
        response = client.post("/api/asn/encode", json=payload)
        if response.status_code != 200:
            print(response.json())
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["hex_data"]) > 0
        print(f"RRC Encoded Hex: {data['hex_data']}")

def test_encode_rrc_invalid_tuple():
    # Test with invalid tuple format (not a string hex)
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": {
            "ue-Identity": {
                "$choice": "randomValue",
                "value": [12345, 40] # Invalid: Int instead of Hex String
            },
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1]
        },
        "encoding_rule": "per"
    }
    
    with TestClient(app) as client:
        response = client.post("/api/asn/encode", json=payload)
        # Depending on where it fails (deserialization vs encoding), it might be 500 or 200 failure.
        # If deserialize fails with type error -> 500 (caught as generic Exception).
        # If asn1tools rejects it -> 200 failure.
        assert response.status_code in [200, 500]
        if response.status_code == 200:
             assert response.json().get("status") == "failure"

def test_encode_rrc_bit_length_mismatch():
    # Test specifically for the 40-bit constraint violation (Error Demo #1)
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": {
            "ue-Identity": {
                "$choice": "randomValue",
                "value": ["0x01", 8] # 8 bits, but schema requires 40
            },
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1]
        },
        "encoding_rule": "per"
    }
    
    with TestClient(app) as client:
        response = client.post("/api/asn/encode", json=payload)
        # Updated requirement: Return 200 OK with status="failure" for diagnostics
        assert response.status_code == 200 
        data = response.json()
        assert data["status"] == "failure"
        error_detail = data["diagnostics"]
        assert "Validation Error" in data["error"]
        # We expect a message complaining about bit length or constraints
        assert "Expected" in error_detail or "constraint" in error_detail.lower()

def test_get_type_definition():
    with TestClient(app) as client:
        response = client.get("/api/asn/protocols/simple_demo/types/Person")
        assert response.status_code == 200
        data = response.json()
        assert "definition" in data
        # Check for internal representation (case sensitive)
        assert "Sequence" in data["definition"]

def test_get_type_definition_not_found():
    with TestClient(app) as client:
        response = client.get("/api/asn/protocols/simple_demo/types/UnknownType")
        assert response.status_code == 404

def test_protocol_not_found():
    with TestClient(app) as client:
        response = client.get("/api/asn/protocols/invalid_proto/types")
        assert response.status_code == 404


def test_encode_rrc_choice_payload_missing_key_should_still_work():
    """Document the real-world bug: JSON arrives with empty-string choice key."""
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": {
            "ue-Identity": {
                "": "randomValue",
                "value": ["0x0123456789", 40],
            },
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1],
        },
        "encoding_rule": "per",
    }

    with TestClient(app) as client:
        response = client.post("/api/asn/encode", json=payload)
        assert response.status_code == 200
