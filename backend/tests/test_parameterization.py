import os
import sys

from fastapi.testclient import TestClient

from backend.main import app

# Ensure project root on sys.path for test discovery environments
sys.path.append(os.getcwd())


def _encode(client: TestClient, type_name: str, data: dict) -> str:
    response = client.post(
        "/api/asn/encode",
        json={
            "protocol": "parameterization_demo",
            "type_name": type_name,
            "data": data,
            "encoding_rule": "per",
        },
    )
    assert response.status_code == 200, response.json()
    return response.json()["hex_data"]


def _decode(client: TestClient, type_name: str, hex_data: str) -> dict:
    response = client.post(
        "/api/asn/decode",
        json={
            "protocol": "parameterization_demo",
            "type_name": type_name,
            "hex_data": hex_data,
            "encoding_rule": "per",
        },
    )
    assert response.status_code == 200, response.json()
    return response.json()["data"]


def test_parameterized_type_roundtrip():
    sample_payload = {
        "id": 42,
        "payload": 1337,
    }

    with TestClient(app) as client:
        encoded_hex = _encode(client, "TemplateInteger", sample_payload)
        decoded = _decode(client, "TemplateInteger", encoded_hex)

    assert decoded["id"] == 42
    assert decoded["payload"] == 1337


def test_nested_parameterized_type_roundtrip():
    sample_payload = {
        "flag": False,
        "nested": {
            "id": 7,
            "payload": 900,
        },
    }

    with TestClient(app) as client:
        encoded_hex = _encode(client, "TemplateBooleanSeqOfInt", sample_payload)
        decoded = _decode(client, "TemplateBooleanSeqOfInt", encoded_hex)

    assert decoded["flag"] is False
    assert decoded["nested"]["id"] == 7
    assert decoded["nested"]["payload"] == 900


def test_value_parameter_size_constraint_roundtrip():
    payload = {"samples": [True, False, True]}

    with TestClient(app) as client:
        encoded_hex = _encode(client, "BoundedBooleanSeq5", payload)
        decoded = _decode(client, "BoundedBooleanSeq5", encoded_hex)

    assert decoded == payload


def test_value_parameter_size_constraint_violation():
    payload = {"samples": [True, False, True, False, True, False]}

    with TestClient(app) as client:
        response = client.post(
            "/api/asn/encode",
            json={
                "protocol": "parameterization_demo",
                "type_name": "BoundedBooleanSeq5",
                "data": payload,
                "encoding_rule": "per",
            },
        )

    assert response.status_code == 400
    assert "Validation Error" in response.json()["detail"]


def test_value_parameter_range_constraint_roundtrip():
    payload = {"value": 21}

    with TestClient(app) as client:
        encoded_hex = _encode(client, "RangeLimited7To42", payload)
        decoded = _decode(client, "RangeLimited7To42", encoded_hex)

    assert decoded == payload

