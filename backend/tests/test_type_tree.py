import asn1tools
from backend.core.type_tree import build_type_tree

def test_build_tree_sequence_optional_default():
    schema = """
    MyModule DEFINITIONS ::= BEGIN
    MySeq ::= SEQUENCE {
        a INTEGER,
        b BOOLEAN OPTIONAL,
        c INTEGER DEFAULT 42
    }
    END
    """
    compiler = asn1tools.compile_string(schema, codec='per')
    my_seq = compiler.types['MySeq']
    
    tree = build_type_tree(my_seq)
    
    assert tree['name'] == 'MySeq'
    assert tree['kind'] == 'Sequence' 
    assert len(tree['children']) == 3
    
    a, b, c = tree['children']
    
    assert a['name'] == 'a'
    assert a['kind'] == 'Integer'
    assert not a.get('optional')
    
    assert b['name'] == 'b'
    assert b['kind'] == 'Boolean'
    assert b['optional'] is True
    
    assert c['name'] == 'c'
    assert c['kind'] == 'Integer'
    assert c['default'] == 42

def test_build_tree_choice_sequence_of():
    schema = """
    MyModule DEFINITIONS ::= BEGIN
    MyChoice ::= CHOICE {
        opt1 INTEGER,
        opt2 BOOLEAN
    }
    MyList ::= SEQUENCE OF INTEGER
    END
    """
    compiler = asn1tools.compile_string(schema, codec='per')
    
    # Choice
    choice_tree = build_type_tree(compiler.types['MyChoice'])
    assert choice_tree['kind'] == 'Choice'
    assert len(choice_tree['children']) == 2
    assert choice_tree['children'][0]['name'] == 'opt1'
    
    # Sequence Of
    list_tree = build_type_tree(compiler.types['MyList'])
    # Sequence Of usually has one child representing the element type
    assert list_tree['kind'] == 'SequenceOf'
    assert len(list_tree['children']) == 1
    assert list_tree['children'][0]['kind'] == 'Integer'

