import os
import sys

from fastapi.testclient import TestClient

from backend.main import app

# Ensure project root on sys.path for test discovery environments
sys.path.append(os.getcwd())


def _normalize(paths):
    return sorted(p.replace("\\", "/") for p in paths)


def test_multi_file_metadata():
    with TestClient(app) as client:
        response = client.get("/api/asn/protocols/metadata")
        assert response.status_code == 200
        payload = response.json()

    multi_entry = next((item for item in payload if item["name"] == "multi_file_demo"), None)
    assert multi_entry is not None, f"metadata missing multi_file_demo: {payload}"

    assert _normalize(multi_entry["files"]) == _normalize(
        ["multi_file_demo/common.asn", "multi_file_demo/main.asn"]
    )
    assert "SessionStart" in multi_entry["types"]
    assert "SubscriberId" in multi_entry["types"]


def test_multi_file_encode_decode_roundtrip():
    session_payload = {
        "subscriber": {
            "mcc": 310,
            "mnc": 260,
            "msin": "0x0102030405",
        },
        "requested": "attachRequest",
        "payload": "0xDEADBEEF",
    }

    with TestClient(app) as client:
        encode_resp = client.post(
            "/api/asn/encode",
            json={
                "protocol": "multi_file_demo",
                "type_name": "SessionStart",
                "data": session_payload,
                "encoding_rule": "per",
            },
        )
        assert encode_resp.status_code == 200, encode_resp.json()
        encoded_hex = encode_resp.json()["hex_data"]
        assert encoded_hex, "Encoded PER output is empty"

        decode_resp = client.post(
            "/api/asn/decode",
            json={
                "protocol": "multi_file_demo",
                "type_name": "SessionStart",
                "hex_data": encoded_hex,
                "encoding_rule": "per",
            },
        )

        assert decode_resp.status_code == 200, decode_resp.json()
        decoded_payload = decode_resp.json()["data"]

    assert decoded_payload["subscriber"]["mcc"] == 310
    assert decoded_payload["subscriber"]["mnc"] == 260
    assert decoded_payload["subscriber"]["msin"] == "0102030405"
    assert decoded_payload["requested"] == "attachRequest"
    assert decoded_payload["payload"] == "deadbeef"

