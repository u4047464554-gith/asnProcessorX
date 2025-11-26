from __future__ import annotations

from typing import Any, Dict, List, Tuple

CHOICE_META_KEYS = {"value", "$choice", "choice"}


def _extract_choice(data: Dict[str, Any]) -> Tuple[str, Any] | None:
    """
    Interpret a dict as an ASN.1 CHOICE value if possible.
    Accepts multiple notations:
      - {"$choice": "name", "value": ...}
      - {"choice": "name", "value": ...}
      - {"value": ..., "<marker>": "name"}
      - {"name": ...} (single-key implicit CHOICE)
    """
    if "$choice" in data and "value" in data:
        return data["$choice"], data["value"]
    if "choice" in data and "value" in data:
        return data["choice"], data["value"]
    if "value" in data:
        extra_keys = [key for key in data.keys() if key not in CHOICE_META_KEYS]
        if len(extra_keys) == 1:
            marker_key = extra_keys[0]
            marker_value = data[marker_key]
            if isinstance(marker_value, str) and marker_value.strip():
                return marker_value, data["value"]
    if len(data) == 1:
        key, value = next(iter(data.items()))
        if isinstance(key, str) and key.strip():
            return key, value
    return None


def deserialize_asn1_data(data: Any) -> Any:
    """
    Recursively convert hex strings/special formats to bytes/tuples expected by asn1tools.

    Formats:
    - Hex Bytes: {"$hex": "deadbeef"} -> b'\\xde\\xad\\xbe\\xef'
    - Choice: {"$choice": "optionName", "value": "optionValue"} -> ('optionName', 'optionValue')
    - Bit String Tuple: ["0xdead", 12] -> (b'\\xde\\xad', 12)
    """
    if isinstance(data, dict):
        if "$hex" in data:
            return bytes.fromhex(data["$hex"])
        choice_candidate = _extract_choice(data)
        if choice_candidate:
            choice_name, choice_value = choice_candidate
            return (choice_name, deserialize_asn1_data(choice_value))
        return {k: deserialize_asn1_data(v) for k, v in data.items()}
    if isinstance(data, list):
        if len(data) == 2 and isinstance(data[0], str) and isinstance(data[1], int):
            if data[0].startswith("0x"):
                return (bytes.fromhex(data[0].replace("0x", "")), data[1])
        return [deserialize_asn1_data(v) for v in data]
    if isinstance(data, str):
        if data.startswith("0x"):
            return bytes.fromhex(data.replace("0x", ""))
    return data


def serialize_asn1_data(data: Any) -> Any:
    """Convert asn1tools decoded data to JSON-serializable format."""
    if isinstance(data, dict):
        return {k: serialize_asn1_data(v) for k, v in data.items()}
    if isinstance(data, tuple):
        if len(data) == 2:
            first, second = data
            if isinstance(first, str):
                return {"$choice": first, "value": serialize_asn1_data(second)}
            if isinstance(first, (bytes, bytearray)) and isinstance(second, int):
                return [f"0x{first.hex()}", second]
        return [serialize_asn1_data(v) for v in data]
    if isinstance(data, list):
        return [serialize_asn1_data(v) for v in data]
    if isinstance(data, (bytes, bytearray)):
        return data.hex()
    return data

