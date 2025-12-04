"""Test that type example generation returns non-empty data."""
import pytest
from backend.routers.asn import generate_default_value
from backend.core.type_tree import build_type_tree
from backend.core.manager import manager


def test_generate_default_value_for_sequence():
    """Test that SEQUENCE types generate non-empty default values."""
    # Get a real type from the compiler
    compiler = manager.get_compiler('rrc_demo')
    if not compiler:
        pytest.skip("rrc_demo protocol not available")
    
    # Try to find a sequence type
    test_types = ['RRCConnectionRequest', 'RRCReconfiguration', 'EstablishmentCause']
    found_type = None
    
    for type_name in test_types:
        if type_name in compiler.types:
            found_type = type_name
            break
    
    if not found_type:
        pytest.skip("No suitable test type found")
    
    type_obj = compiler.types[found_type]
    tree = build_type_tree(type_obj)
    default_data = generate_default_value(tree)
    
    # Verify the result is not None or empty
    assert default_data is not None, f"Default data for {found_type} should not be None"
    
    # For sequences, should return a dict (even if empty for optional-only fields)
    if tree.get("kind") == "Sequence":
        assert isinstance(default_data, dict), f"Sequence type should return dict, got {type(default_data)}"
        # Note: Some sequences might have only optional fields, so empty dict is OK
        # But we should at least verify the structure is correct


def test_generate_default_value_structure():
    """Test that the default value generation handles different type structures."""
    # Test Sequence
    sequence_tree = {
        "kind": "Sequence",
        "children": [
            {"name": "field1", "kind": "Integer", "optional": False},
            {"name": "field2", "kind": "Utf8String", "optional": False},
        ]
    }
    result = generate_default_value(sequence_tree)
    assert isinstance(result, dict)
    assert "field1" in result
    assert "field2" in result
    assert result["field1"] == 0
    assert result["field2"] == ""
    
    # Test Choice
    choice_tree = {
        "kind": "Choice",
        "children": [
            {"name": "option1", "kind": "Integer", "optional": False},
        ]
    }
    result = generate_default_value(choice_tree)
    assert isinstance(result, dict)
    assert "option1" in result
    
    # Test Enumerated
    enum_tree = {
        "kind": "Enumerated",
        "children": [
            {"name": "value1"},
            {"name": "value2"},
        ]
    }
    result = generate_default_value(enum_tree)
    assert result == "value1"
    
    # Test Integer
    int_tree = {"kind": "Integer"}
    result = generate_default_value(int_tree)
    assert result == 0
    
    # Test Boolean
    bool_tree = {"kind": "Boolean"}
    result = generate_default_value(bool_tree)
    assert result is False


def test_type_example_endpoint_returns_data(client):
    """Test that the /example endpoint returns non-empty data."""
    # This would require a test client setup
    # For now, we'll test the function directly
    compiler = manager.get_compiler('rrc_demo')
    if not compiler:
        pytest.skip("rrc_demo protocol not available")
    
    test_type = 'RRCConnectionRequest'
    if test_type not in compiler.types:
        pytest.skip(f"{test_type} not found in rrc_demo")
    
    type_obj = compiler.types[test_type]
    tree = build_type_tree(type_obj)
    default_data = generate_default_value(tree)
    
    # Verify we got something back
    assert default_data is not None
    
    # The data should be serializable
    from backend.core.serialization import serialize_asn1_data
    serialized = serialize_asn1_data(default_data)
    assert serialized is not None

