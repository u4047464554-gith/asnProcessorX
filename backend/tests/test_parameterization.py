import os
import sys
from typing import Any, Dict

from fastapi.testclient import TestClient

from backend.main import app

sys.path.append(os.getcwd())


DEMO_CASES: Dict[str, Dict[str, Any]] = {
    "simple_demo": {
        "Person": {"name": "Alice", "age": 30, "isAlive": True},
        "Direction": {
            "$choice": "uplink",
            "value": {"name": "Bob", "age": 25, "isAlive": True},
        },
        "MyMessage": {"id": 7, "value": "Hello World"},
        "StatusCode": 42,
    },
    "rrc_demo": {
        "RRCConnectionRequest": {
            "ue-Identity": {"$choice": "randomValue", "value": ["0x0123456789", 40]},
            "establishmentCause": "mo-Signalling",
            "spare": ["0x80", 1],
        },
        "InitialUE-Identity": {"$choice": "randomValue", "value": ["0x1122334455", 40]},
        "S-TMSI": {"mmec": ["0xAA", 8], "m-TMSI": ["0x01020304", 32]},
    },
    "multi_file_demo": {
        "SessionStart": {
            "subscriber": {"mcc": 246, "mnc": 1, "msin": "0x48454c4c4f"},
            "requested": "serviceRequest",
            "payload": "0x4578616d706c652073657373696f6e207061796c6f6164",
        },
        "SubscriberId": {"mcc": 310, "mnc": 260, "msin": "0x0102030405"},
        "MessageId": "attachRequest",
    },
}

ERROR_CASES: Dict[str, Dict[str, Any]] = {
    "simple_demo": {
        "Person": {"name": "Alice", "age": 999, "isAlive": True},
        "Direction": {"$choice": "invalidChoice", "value": {}},
    },
    "rrc_demo": {
        "RRCConnectionRequest": {
            "ue-Identity": {"$choice": "randomValue", "value": ["0x01", 8]},
            "establishmentCause": "invalid",
            "spare": ["0x00", 0],
        },
    },
    "multi_file_demo": {
        "SessionStart": {
            "subscriber": {"mcc": 50, "mnc": 9999, "msin": "0x01"},
            "requested": "invalid",
            "payload": "",
        },
    },
}


def _assert_trace(client: TestClient, protocol: str, type_name: str, hex_data: str):
    trace_resp = client.post(
        "/api/asn/trace",
        json={
            "protocol": protocol,
            "type_name": type_name,
            "hex_data": hex_data,
            "encoding_rule": "per",
        },
    )
    assert trace_resp.status_code == 200, trace_resp.json()
    trace_payload = trace_resp.json()
    assert trace_payload["trace"]["name"]
    assert trace_payload["trace"]["type"]


def test_demo_payload_roundtrip():
    with TestClient(app) as client:
        for protocol, cases in DEMO_CASES.items():
            for type_name, payload in cases.items():
                encode_resp = client.post(
                    "/api/asn/encode",
                    json={
                        "protocol": protocol,
                        "type_name": type_name,
                        "data": payload,
                        "encoding_rule": "per",
                    },
                )
                assert encode_resp.status_code == 200, encode_resp.json()
                hex_data = encode_resp.json()["hex_data"]
                assert hex_data

                decode_resp = client.post(
                    "/api/asn/decode",
                    json={
                        "protocol": protocol,
                        "type_name": type_name,
                        "hex_data": hex_data,
                        "encoding_rule": "per",
                    },
                )
                assert decode_resp.status_code == 200, decode_resp.json()

                _assert_trace(client, protocol, type_name, hex_data)


def test_demo_error_payloads():
    with TestClient(app) as client:
        for protocol, cases in ERROR_CASES.items():
            for type_name, payload in cases.items():
                resp = client.post(
                    "/api/asn/encode",
                    json={
                        "protocol": protocol,
                        "type_name": type_name,
                        "data": payload,
                        "encoding_rule": "per",
                    },
                )
                assert resp.status_code in (400, 422)


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

