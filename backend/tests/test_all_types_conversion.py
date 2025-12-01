import pytest
import asn1tools
from backend.core.converter import convert_to_python_asn1

ASN_SPEC = """
AllTypes DEFINITIONS AUTOMATIC TAGS ::=
BEGIN

    Root ::= SEQUENCE {
        -- Primitives
        boolVal     BOOLEAN,
        intVal      INTEGER,
        strVal      IA5String,
        utf8Val     UTF8String,
        nullVal     NULL,
        oidVal      OBJECT IDENTIFIER,
        enumVal     ENUMERATED { a(0), b(1), c(2) },
        
        -- Constructed
        seqVal      SimpleSeq,
        seqOfVal    SEQUENCE OF INTEGER,
        setVal      SimpleSet,
        setOfVal    SET OF INTEGER,
        choiceVal   SimpleChoice,
        
        -- Special
        octVal      OCTET STRING,
        bitVal      BIT STRING,
        
        -- Optional/Default
        optVal      INTEGER OPTIONAL,
        defVal      INTEGER DEFAULT 42
    }

    SimpleSeq ::= SEQUENCE {
        a INTEGER,
        b BOOLEAN
    }

    SimpleSet ::= SET {
        x INTEGER,
        y BOOLEAN
    }

    SimpleChoice ::= CHOICE {
        c1 INTEGER,
        c2 IA5String,
        c3 SimpleSeq
    }

    -- Recursive
    RecursiveSeq ::= SEQUENCE {
        val INTEGER,
        next RecursiveSeq OPTIONAL
    }

END
"""

@pytest.fixture
def compiler():
    return asn1tools.compile_string(ASN_SPEC, codec='per')

def test_all_types_conversion(compiler):
    type_obj = compiler.types['Root']
    
    # Input Data (JSON-like from frontend)
    input_data = {
        'boolVal': True,
        'intVal': 123,
        'strVal': 'hello',
        'utf8Val': 'world',
        'nullVal': None,
        'oidVal': '1.2.840.113549',
        'enumVal': 'b', # String enum
        
        'seqVal': {'a': 1, 'b': False},
        'seqOfVal': [1, 2, 3],
        'setVal': {'x': 10, 'y': True},
        'setOfVal': [4, 5, 6],
        'choiceVal': {'c3': {'a': 99, 'b': True}}, # Choice as Dict
        
        'octVal': ['AABBCC', 24], # Tuple input from frontend (no 0x)
        'bitVal': ['A0', 4],      # Tuple input from frontend (no 0x)
        
        'optVal': 100,
        # defVal missing, should use default if encoded? 
        # Converter just passes what is present or handles structure.
    }
    
    # Expected Output (Python ASN.1 native)
    expected_data = {
        'boolVal': True,
        'intVal': 123,
        'strVal': 'hello',
        'utf8Val': 'world',
        'nullVal': None,
        'oidVal': '1.2.840.113549',
        'enumVal': 'b',
        
        'seqVal': {'a': 1, 'b': False},
        'seqOfVal': [1, 2, 3],
        'setVal': {'x': 10, 'y': True},
        'setOfVal': [4, 5, 6],
        'choiceVal': ('c3', {'a': 99, 'b': True}), # Converted to Tuple!
        
        'octVal': b'\xAA\xBB\xCC', # Converted to bytes
        'bitVal': (b'\xA0', 4),    # Converted to (bytes, len) tuple
        
        'optVal': 100
    }
    
    converted = convert_to_python_asn1(input_data, type_obj)
    
    # Assertions
    assert converted['boolVal'] == expected_data['boolVal']
    assert converted['intVal'] == expected_data['intVal']
    assert converted['strVal'] == expected_data['strVal']
    assert converted['utf8Val'] == expected_data['utf8Val']
    assert converted['nullVal'] == expected_data['nullVal']
    assert converted['oidVal'] == expected_data['oidVal']
    assert converted['enumVal'] == expected_data['enumVal']
    
    assert converted['seqVal'] == expected_data['seqVal']
    assert converted['seqOfVal'] == expected_data['seqOfVal']
    assert converted['setVal'] == expected_data['setVal']
    # setOfVal order might vary in encoding but list equality implies order in Python
    assert sorted(converted['setOfVal']) == sorted(expected_data['setOfVal'])
    
    assert converted['choiceVal'] == expected_data['choiceVal']
    assert isinstance(converted['choiceVal'], tuple)
    
    assert converted['octVal'] == expected_data['octVal']
    assert isinstance(converted['octVal'], bytes)
    
    assert converted['bitVal'] == expected_data['bitVal']
    assert isinstance(converted['bitVal'], tuple)
    
    # Verify encoding works
    encoded = compiler.encode('Root', converted)
    assert len(encoded) > 0

def test_recursive_conversion(compiler):
    type_obj = compiler.types['RecursiveSeq']
    
    input_data = {
        'val': 1,
        'next': {
            'val': 2,
            'next': {
                'val': 3
                # next missing (optional)
            }
        }
    }
    
    converted = convert_to_python_asn1(input_data, type_obj)
    
    assert converted['val'] == 1
    assert converted['next']['val'] == 2
    assert converted['next']['next']['val'] == 3
    
    encoded = compiler.encode('RecursiveSeq', converted)
    assert len(encoded) > 0


def test_empty_sequence_in_choice(compiler):
    """Test CHOICE with empty SEQUENCE {} option (like criticalExtensionsFuture in RRC)."""
    asn_spec = """
    TestEmptySeq DEFINITIONS AUTOMATIC TAGS ::=
    BEGIN
        TestChoice ::= CHOICE {
            normalOption    SEQUENCE { value INTEGER },
            emptyOption     SEQUENCE {}
        }
    END
    """
    test_compiler = asn1tools.compile_string(asn_spec, codec='per')
    type_obj = test_compiler.types['TestChoice']
    
    # Test 1: Empty sequence as dict {}
    input_data = {'emptyOption': {}}
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted == ('emptyOption', {})
    encoded = test_compiler.encode('TestChoice', converted)
    assert len(encoded) > 0
    
    # Test 2: Empty sequence as None (should convert to {})
    input_data = {'emptyOption': None}
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted == ('emptyOption', {})
    encoded = test_compiler.encode('TestChoice', converted)
    assert len(encoded) > 0
    
    # Test 3: Normal option still works
    input_data = {'normalOption': {'value': 42}}
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted == ('normalOption', {'value': 42})
    encoded = test_compiler.encode('TestChoice', converted)
    assert len(encoded) > 0


def test_empty_sequence_standalone(compiler):
    """Test standalone empty SEQUENCE {} type."""
    asn_spec = """
    TestEmptySeq DEFINITIONS AUTOMATIC TAGS ::=
    BEGIN
        EmptySeq ::= SEQUENCE {}
        Container ::= SEQUENCE {
            emptyField    EmptySeq,
            normalField   INTEGER
        }
    END
    """
    test_compiler = asn1tools.compile_string(asn_spec, codec='per')
    type_obj = test_compiler.types['Container']
    
    # Test with empty dict
    input_data = {'emptyField': {}, 'normalField': 100}
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted['emptyField'] == {}
    assert converted['normalField'] == 100
    encoded = test_compiler.encode('Container', converted)
    assert len(encoded) > 0
    
    # Test with None (should convert to {})
    input_data = {'emptyField': None, 'normalField': 100}
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted['emptyField'] == {}
    assert converted['normalField'] == 100
    encoded = test_compiler.encode('Container', converted)
    assert len(encoded) > 0


def test_rrc_reconfiguration_like_structure():
    """Test structure similar to RRCReconfiguration with criticalExtensionsFuture."""
    asn_spec = """
    RRCReconfigTest DEFINITIONS AUTOMATIC TAGS ::=
    BEGIN
        RRCReconfiguration ::= SEQUENCE {
            rrc-TransactionIdentifier    INTEGER (0..3),
            criticalExtensions            CHOICE {
                rrcReconfiguration          SEQUENCE { value INTEGER },
                criticalExtensionsFuture    SEQUENCE {}
            }
        }
    END
    """
    test_compiler = asn1tools.compile_string(asn_spec, codec='per')
    type_obj = test_compiler.types['RRCReconfiguration']
    
    # Test with criticalExtensionsFuture (empty sequence)
    input_data = {
        'rrc-TransactionIdentifier': 0,
        'criticalExtensions': {'criticalExtensionsFuture': {}}
    }
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted['rrc-TransactionIdentifier'] == 0
    assert converted['criticalExtensions'] == ('criticalExtensionsFuture', {})
    encoded = test_compiler.encode('RRCReconfiguration', converted)
    assert len(encoded) > 0
    
    # Test with criticalExtensionsFuture as None (should convert to {})
    input_data = {
        'rrc-TransactionIdentifier': 0,
        'criticalExtensions': {'criticalExtensionsFuture': None}
    }
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted['criticalExtensions'] == ('criticalExtensionsFuture', {})
    encoded = test_compiler.encode('RRCReconfiguration', converted)
    assert len(encoded) > 0
    
    # Test with normal option
    input_data = {
        'rrc-TransactionIdentifier': 1,
        'criticalExtensions': {'rrcReconfiguration': {'value': 42}}
    }
    converted = convert_to_python_asn1(input_data, type_obj)
    assert converted['criticalExtensions'] == ('rrcReconfiguration', {'value': 42})
    encoded = test_compiler.encode('RRCReconfiguration', converted)
    assert len(encoded) > 0


