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
        # Should fail because we don't convert Int to bytes in our helper
        # Or asn1tools might fail with type error
        assert response.status_code != 200

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


@pytest.mark.xfail(reason="Front-end serialization drops '$choice' key, causing 400 from encode API")
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
