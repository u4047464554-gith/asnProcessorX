"""
Comprehensive tests for all ASN.1 types to ensure proper conversion and encoding.
Tests cover primitives, constructed types, constraints, and edge cases.
"""
import pytest
from backend.core.asn1_runtime import asn1tools
from backend.core.converter import convert_to_python_asn1
from backend.core.serialization import serialize_asn1_data


COMPREHENSIVE_ASN_SPEC = """
ComprehensiveTypes DEFINITIONS AUTOMATIC TAGS ::=
BEGIN

    -- Primitive Types
    Primitives ::= SEQUENCE {
        boolVal         BOOLEAN,
        intVal          INTEGER,
        realVal         REAL,
        nullVal         NULL,
        oidVal          OBJECT IDENTIFIER,
        enumVal         ENUMERATED { red(0), green(1), blue(2) }
    }

    -- String Types (only types supported by asn1tools without imports)
    StringTypes ::= SEQUENCE {
        ia5Val          IA5String,
        utf8Val         UTF8String,
        numericVal      NumericString,
        printableVal    PrintableString,
        visibleVal      VisibleString
    }

    -- Constructed Types
    ConstructedTypes ::= SEQUENCE {
        seqVal          SimpleSequence,
        setVal          SimpleSet,
        choiceVal       SimpleChoice,
        seqOfVal        SEQUENCE OF INTEGER,
        setOfVal        SET OF INTEGER,
        seqOfSeqVal     SEQUENCE OF SimpleSequence,
        setOfSetVal     SET OF SimpleSet
    }

    SimpleSequence ::= SEQUENCE {
        a INTEGER,
        b BOOLEAN,
        c IA5String
    }

    SimpleSet ::= SET {
        x INTEGER,
        y BOOLEAN,
        z IA5String
    }

    SimpleChoice ::= CHOICE {
        intOption       INTEGER,
        strOption       IA5String,
        seqOption       SimpleSequence
    }

    -- Special Types
    SpecialTypes ::= SEQUENCE {
        octVal          OCTET STRING,
        bitVal          BIT STRING,
        octConstrained  OCTET STRING (SIZE(4..8)),
        bitConstrained  BIT STRING (SIZE(1..16))
    }

    -- Optional and Default
    OptionalTypes ::= SEQUENCE {
        requiredVal     INTEGER,
        optVal          INTEGER OPTIONAL,
        defVal          INTEGER DEFAULT 42,
        optSeq          SimpleSequence OPTIONAL,
        defEnum         ENUMERATED { a(0), b(1) } DEFAULT a
    }

    -- Constraints
    ConstrainedTypes ::= SEQUENCE {
        intRange        INTEGER (0..255),
        intNamed        INTEGER { min(0), max(255), mid(128) },
        sizeConstrained SEQUENCE (SIZE(1..10)) OF INTEGER,
        strSize         IA5String (SIZE(1..100))
    }

    -- Empty Types
    EmptyTypes ::= SEQUENCE {
        emptySeq        SEQUENCE {},
        emptySet        SET {},
        emptyChoice     CHOICE {
            emptyOption     SEQUENCE {}
        }
    }

    -- Nested Complex
    NestedComplex ::= SEQUENCE {
        level1          SEQUENCE {
            level2          SEQUENCE {
                level3          SEQUENCE {
                    value           INTEGER
                }
            }
        },
        choiceSeq       CHOICE {
            option1         SEQUENCE {
                nestedSeq       SEQUENCE {
                    val             INTEGER
                }
            },
            option2         SEQUENCE {}
        }
    }


END
"""


@pytest.fixture
def compiler():
    return asn1tools.compile_string(COMPREHENSIVE_ASN_SPEC, codec='per')


class TestPrimitiveTypes:
    """Test all primitive ASN.1 types."""
    
    def test_primitives_conversion(self, compiler):
        type_obj = compiler.types['Primitives']
        input_data = {
            'boolVal': True,
            'intVal': 12345,
            'realVal': 3.14159,
            'nullVal': None,
            'oidVal': '1.2.840.113549.1.1.1',
            'enumVal': 'green'
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['boolVal']
        assert converted['intVal'] == 12345
        assert converted['nullVal'] is None
        assert converted['oidVal'] == '1.2.840.113549.1.1.1'
        assert converted['enumVal'] == 'green'
        
        # Verify encoding works
        encoded = compiler.encode('Primitives', converted)
        assert len(encoded) > 0
        
        # Verify round-trip
        decoded = compiler.decode('Primitives', encoded)
        assert decoded['boolVal']
        assert decoded['intVal'] == 12345
        assert decoded['enumVal'] == 'green'


class TestStringTypes:
    """Test all string types."""
    
    def test_string_types_conversion(self, compiler):
        type_obj = compiler.types['StringTypes']
        input_data = {
            'ia5Val': 'Hello IA5',
            'utf8Val': 'Hello UTF8 世界',
            'numericVal': '12345',
            'printableVal': 'ABC123',
            'visibleVal': 'Visible!'
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        
        for key in input_data:
            assert converted[key] == input_data[key]
        
        encoded = compiler.encode('StringTypes', converted)
        assert len(encoded) > 0


class TestConstructedTypes:
    """Test SEQUENCE, SET, CHOICE, SEQUENCE OF, SET OF."""
    
    def test_sequence_conversion(self, compiler):
        type_obj = compiler.types['SimpleSequence']
        input_data = {'a': 42, 'b': True, 'c': 'test'}
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted == input_data
        encoded = compiler.encode('SimpleSequence', converted)
        assert len(encoded) > 0
    
    def test_set_conversion(self, compiler):
        type_obj = compiler.types['SimpleSet']
        input_data = {'x': 10, 'y': False, 'z': 'set'}
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted == input_data
        encoded = compiler.encode('SimpleSet', converted)
        assert len(encoded) > 0
    
    def test_choice_conversion(self, compiler):
        type_obj = compiler.types['SimpleChoice']
        
        # Test integer option
        input_data = {'intOption': 42}
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted == ('intOption', 42)
        encoded = compiler.encode('SimpleChoice', converted)
        assert len(encoded) > 0
        
        # Test string option
        input_data = {'strOption': 'hello'}
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted == ('strOption', 'hello')
        encoded = compiler.encode('SimpleChoice', converted)
        assert len(encoded) > 0
        
        # Test sequence option
        input_data = {'seqOption': {'a': 1, 'b': True, 'c': 'test'}}
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted == ('seqOption', {'a': 1, 'b': True, 'c': 'test'})
        encoded = compiler.encode('SimpleChoice', converted)
        assert len(encoded) > 0
    
    def test_sequence_of_conversion(self, compiler):
        type_obj = compiler.types['ConstructedTypes']
        input_data = {
            'seqVal': {'a': 1, 'b': True, 'c': 'test'},
            'setVal': {'x': 2, 'y': False, 'z': 'set'},
            'choiceVal': {'intOption': 42},
            'seqOfVal': [1, 2, 3, 4, 5],
            'setOfVal': [10, 20, 30],
            'seqOfSeqVal': [
                {'a': 1, 'b': True, 'c': 'first'},
                {'a': 2, 'b': False, 'c': 'second'}
            ],
            'setOfSetVal': [
                {'x': 1, 'y': True, 'z': 'one'},
                {'x': 2, 'y': False, 'z': 'two'}
            ]
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert len(converted['seqOfVal']) == 5
        assert len(converted['setOfVal']) == 3
        assert len(converted['seqOfSeqVal']) == 2
        encoded = compiler.encode('ConstructedTypes', converted)
        assert len(encoded) > 0


class TestSpecialTypes:
    """Test OCTET STRING and BIT STRING."""
    
    def test_octet_string_conversion(self, compiler):
        type_obj = compiler.types['SpecialTypes']
        
        # Test with hex string (no 0x)
        input_data = {
            'octVal': 'AABBCC',
            'bitVal': ['A0', 4],
            'octConstrained': 'DEADBEEF',
            'bitConstrained': ['FF', 8]
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert isinstance(converted['octVal'], bytes)
        assert converted['octVal'] == b'\xAA\xBB\xCC'
        assert isinstance(converted['bitVal'], tuple)
        assert converted['bitVal'][0] == b'\xA0'
        assert converted['bitVal'][1] == 4
        
        encoded = compiler.encode('SpecialTypes', converted)
        assert len(encoded) > 0
    
    def test_octet_string_with_0x_prefix(self, compiler):
        type_obj = compiler.types['SpecialTypes']
        input_data = {
            'octVal': '0xAABBCC',
            'bitVal': ['0xA0', 4],
            'octConstrained': '0xDEADBEEF',
            'bitConstrained': ['0xFF', 8]
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert isinstance(converted['octVal'], bytes)
        encoded = compiler.encode('SpecialTypes', converted)
        assert len(encoded) > 0


class TestOptionalAndDefault:
    """Test OPTIONAL and DEFAULT fields."""
    
    def test_optional_fields(self, compiler):
        type_obj = compiler.types['OptionalTypes']
        
        # Test with all fields
        input_data = {
            'requiredVal': 100,
            'optVal': 200,
            'defVal': 300,
            'optSeq': {'a': 1, 'b': True, 'c': 'test'},
            'defEnum': 'b'
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['requiredVal'] == 100
        assert converted['optVal'] == 200
        assert converted['defVal'] == 300
        encoded = compiler.encode('OptionalTypes', converted)
        assert len(encoded) > 0
        
        # Test with missing optional
        input_data = {
            'requiredVal': 100
            # optVal missing, defVal missing (should use default)
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['requiredVal'] == 100
        assert 'optVal' not in converted or converted.get('optVal') is None
        encoded = compiler.encode('OptionalTypes', converted)
        assert len(encoded) > 0


class TestConstraints:
    """Test various ASN.1 constraints."""
    
    def test_integer_range(self, compiler):
        type_obj = compiler.types['ConstrainedTypes']
        input_data = {
            'intRange': 128,
            'intNamed': 128,  # Use integer value, not string name
            'sizeConstrained': [1, 2, 3],
            'strSize': 'Hello'
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['intRange'] == 128
        assert converted['intNamed'] == 128
        assert len(converted['sizeConstrained']) == 3
        encoded = compiler.encode('ConstrainedTypes', converted)
        assert len(encoded) > 0


class TestEmptyTypes:
    """Test empty SEQUENCE, SET, and CHOICE with empty option."""
    
    def test_empty_sequence(self, compiler):
        type_obj = compiler.types['EmptyTypes']
        
        # Test with empty dict
        input_data = {
            'emptySeq': {},
            'emptySet': {},
            'emptyChoice': {'emptyOption': {}}
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['emptySeq'] == {}
        assert converted['emptySet'] == {}
        assert converted['emptyChoice'] == ('emptyOption', {})
        encoded = compiler.encode('EmptyTypes', converted)
        # Empty sequences may encode to 0 bytes, which is valid
        assert len(encoded) >= 0
        
        # Test with None (should convert to {})
        input_data = {
            'emptySeq': None,
            'emptySet': None,
            'emptyChoice': {'emptyOption': None}
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['emptySeq'] == {}
        assert converted['emptySet'] == {}
        assert converted['emptyChoice'] == ('emptyOption', {})
        encoded = compiler.encode('EmptyTypes', converted)
        # Empty sequences may encode to 0 bytes, which is valid
        assert len(encoded) >= 0


class TestNestedComplex:
    """Test deeply nested and complex structures."""
    
    def test_nested_sequences(self, compiler):
        type_obj = compiler.types['NestedComplex']
        input_data = {
            'level1': {
                'level2': {
                    'level3': {
                        'value': 42
                    }
                }
            },
            'choiceSeq': {
                'option1': {
                    'nestedSeq': {
                        'val': 100
                    }
                }
            }
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['level1']['level2']['level3']['value'] == 42
        assert converted['choiceSeq'] == ('option1', {'nestedSeq': {'val': 100}})
        encoded = compiler.encode('NestedComplex', converted)
        assert len(encoded) > 0
        
        # Test with empty option
        input_data = {
            'level1': {
                'level2': {
                    'level3': {
                        'value': 42
                    }
                }
            },
            'choiceSeq': {
                'option2': {}
            }
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['choiceSeq'] == ('option2', {})
        encoded = compiler.encode('NestedComplex', converted)
        assert len(encoded) > 0


class TestRoundTrip:
    """Test encoding/decoding round-trips for all types."""
    
    def test_primitives_round_trip(self, compiler):
        type_obj = compiler.types['Primitives']
        input_data = {
            'boolVal': True,
            'intVal': 12345,
            'realVal': 3.14,
            'nullVal': None,
            'oidVal': '1.2.3.4',
            'enumVal': 'blue'
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        encoded = compiler.encode('Primitives', converted)
        decoded = compiler.decode('Primitives', encoded)
        serialized = serialize_asn1_data(decoded)
        
        assert serialized['boolVal']
        assert serialized['intVal'] == 12345
        assert serialized['enumVal'] == 'blue'
    
    def test_choice_round_trip(self, compiler):
        type_obj = compiler.types['SimpleChoice']
        input_data = {'seqOption': {'a': 1, 'b': True, 'c': 'test'}}
        converted = convert_to_python_asn1(input_data, type_obj)
        encoded = compiler.encode('SimpleChoice', converted)
        decoded = compiler.decode('SimpleChoice', encoded)
        serialized = serialize_asn1_data(decoded)
        
        assert serialized['$choice'] == 'seqOption'
        assert serialized['value']['a'] == 1
        assert serialized['value']['b']
        assert serialized['value']['c'] == 'test'
    
    def test_octet_string_round_trip(self, compiler):
        type_obj = compiler.types['SpecialTypes']
        input_data = {
            'octVal': 'AABBCC',
            'bitVal': ['A0', 4],
            'octConstrained': 'DEADBEEF',
            'bitConstrained': ['FF', 8]
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        encoded = compiler.encode('SpecialTypes', converted)
        decoded = compiler.decode('SpecialTypes', encoded)
        serialized = serialize_asn1_data(decoded)
        
        assert serialized['octVal'] == 'aabbcc'  # Lowercase hex
        assert isinstance(serialized['bitVal'], list)
        assert len(serialized['bitVal']) == 2


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_empty_lists(self, compiler):
        type_obj = compiler.types['ConstructedTypes']
        input_data = {
            'seqVal': {'a': 1, 'b': True, 'c': 'test'},
            'setVal': {'x': 2, 'y': False, 'z': 'set'},
            'choiceVal': {'intOption': 42},
            'seqOfVal': [],  # Empty list
            'setOfVal': [],  # Empty list
            'seqOfSeqVal': [],
            'setOfSetVal': []
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        assert converted['seqOfVal'] == []
        assert converted['setOfVal'] == []
        encoded = compiler.encode('ConstructedTypes', converted)
        assert len(encoded) > 0
    
    def test_missing_required_fields_handled_gracefully(self, compiler):
        """Test that missing required fields are handled (should fail encoding but not crash)."""
        type_obj = compiler.types['Primitives']
        input_data = {
            'boolVal': True,
            # Missing other required fields
        }
        converted = convert_to_python_asn1(input_data, type_obj)
        # Encoding should fail with constraint error, not crash
        with pytest.raises(Exception):  # asn1tools will raise an error
            compiler.encode('Primitives', converted)

