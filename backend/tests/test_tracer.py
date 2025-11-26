import pytest

from backend.core.manager import manager
from backend.core.tracer import TraceService


@pytest.fixture(scope="module")
def trace_service():
    """Ensure protocols are loaded and provide a shared TraceService."""
    manager.reload()
    return TraceService(manager)


def _encode_hex(protocol: str, type_name: str, payload):
    compiler = manager.get_compiler(protocol)
    assert compiler is not None
    encoded = compiler.encode(type_name, payload, check_constraints=True)
    return encoded.hex()


def _find_child(node, name: str):
    return next((child for child in node.children if child.name == name), None)


def test_trace_person_structure(trace_service: TraceService):
    payload = {
        "name": "Alice",
        "age": 30,
        "isAlive": True,
        # secret omitted on purpose
    }
    hex_data = _encode_hex("simple_demo", "Person", payload)

    result = trace_service.trace("simple_demo", "Person", hex_data)

    assert result.protocol == "simple_demo"
    assert result.type_name == "Person"
    assert result.decoded["name"] == payload["name"]
    assert result.decoded["age"] == payload["age"]
    input_bits = len(bytes.fromhex(hex_data)) * 8
    assert result.total_bits <= input_bits
    assert input_bits - result.total_bits < 8

    root = result.root
    assert root.name == "Person"
    assert root.bits.length == result.total_bits

    child_names = {child.name for child in root.children}
    assert {"name", "age"}.issubset(child_names)
    # Fields that rely on defaults/optionals should be absent from the bit trace.
    assert "isAlive" not in child_names
    assert "secret" not in child_names

    name_node = _find_child(root, "name")
    assert name_node is not None
    assert name_node.value == "Alice"
    assert name_node.bits.length > 0

    age_node = _find_child(root, "age")
    assert age_node is not None
    assert age_node.bits.length > 0
    assert age_node.value == 30


def test_trace_choice_direction(trace_service: TraceService):
    direction_payload = (
        "uplink",
        {
            "name": "Bob",
            "age": 25,
            "isAlive": False,
        },
    )
    hex_data = _encode_hex("simple_demo", "Direction", direction_payload)

    result = trace_service.trace("simple_demo", "Direction", hex_data)

    assert result.root.type_label == "CHOICE"
    assert result.root.value["$choice"] == "uplink"

    uplink_node = _find_child(result.root, "uplink")
    assert uplink_node is not None
    grand_children = {child.name for child in uplink_node.children}
    assert {"name", "age", "isAlive"}.issubset(grand_children)

    downlink_node = _find_child(result.root, "downlink")
    assert downlink_node is None

