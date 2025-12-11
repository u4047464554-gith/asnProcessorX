
import os
import sys
import tempfile
import shutil
import pytest

sys.path.append(os.getcwd())

class TestParameterizedCompilation:
    """Test compilation of parameterized ASN.1 types which are known to cause issues."""

    def test_parameterized_integer_constraint(self, client):
        """
        Test a parameterized type where the parameter is used in a constraint.
        This often triggers 'int object is not subscriptable' if the parser
        misidentifies the parameter as a complex object.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            proto_name = "param_test_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
ParamModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN

    -- Parameterized Type Definition
    -- param is an INTEGER value
    BoundedSeq { INTEGER : maxLen } ::= SEQUENCE {
        payload OCTET STRING (SIZE(0..maxLen)),
        id      INTEGER (0..maxLen)
    }

    -- Instantiation with integer literal
    MyBoundedSeq ::= BoundedSeq { 255 }
    
    -- Instantiation with defined value
    myMax INTEGER ::= 100
    MyOtherBoundedSeq ::= BoundedSeq { myMax }

END
"""
            with open(os.path.join(proto_dir, "param.asn"), "w") as f:
                f.write(asn_content)
            
            # Get original config
            response = client.get("/api/config/")
            original_config = response.json()
            
            # Add external directory
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            assert response.status_code == 200
            data = response.json()
            
            # Check for compilation errors
            if data.get("compilation_status") == "warning":
                error_msg = data["compilation_errors"].get(proto_name, "Unknown error")
                pytest.fail(f"Compilation failed for parameterized type: {error_msg}")

            assert data.get("compilation_status") == "success"
            
            # Verify we can encode/decode using the instantiated type
            test_data = {
                "payload": "010203",
                "id": 50
            }
            encode_resp = client.post("/api/asn/encode", json={
                "protocol": proto_name,
                "type_name": "MyBoundedSeq",
                "data": test_data
            })
            assert encode_resp.status_code == 200, f"Encode failed: {encode_resp.text}"
            assert encode_resp.json()["status"] == "success"

        finally:
            # Cleanup
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)

    def test_parameterized_type_as_parameter(self, client):
        """
        Test a parameterized type where the parameter is a TYPE.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            proto_name = "param_type_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
ParamTypeModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN

    -- Parameter is a TYPE
    Wrapper { TypeParam } ::= SEQUENCE {
        header UTF8String,
        body   TypeParam
    }

    -- Instantiation
    MyWrapper ::= Wrapper { INTEGER }
    MyComplexWrapper ::= Wrapper { SEQUENCE { a BOOLEAN } }

END
"""
            with open(os.path.join(proto_dir, "type_param.asn"), "w") as f:
                f.write(asn_content)
            
            # Get original config
            response = client.get("/api/config/")
            original_config = response.json()
            
            # Add external directory
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            assert response.status_code == 200
            data = response.json()
            
            if data.get("compilation_status") == "warning":
                error_msg = data["compilation_errors"].get(proto_name, "Unknown error")
                pytest.fail(f"Compilation failed for parameterized type-as-param: {error_msg}")

            assert data.get("compilation_status") == "success"

        finally:
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)

    def test_nested_parameterization_with_literal(self, client):
        """
        Test nested parameterization where one inner type uses a literal value.
        This reproduces the 'int object is not subscriptable' crash by ensuring
        the compiler encounters an int literal when scanning for dummy parameter substitutions.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            proto_name = "nested_literal_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
NestedParam DEFINITIONS AUTOMATIC TAGS ::= BEGIN

    Inner { INTEGER: val } ::= SEQUENCE {
        field INTEGER (0..val)
    }
    
    -- Outer takes a type parameter T, but uses Inner { 10 } (literal) internally.
    -- The compiler iterates b's parameters ([10]) checking if they match 'T'.
    Outer { T } ::= SEQUENCE {
        a T,
        b Inner { 10 }
    }
    
    -- Instantiation
    MyOuter ::= Outer { BOOLEAN }

END
"""
            with open(os.path.join(proto_dir, "nested.asn"), "w") as f:
                f.write(asn_content)
            
            # Get original config
            response = client.get("/api/config/")
            original_config = response.json()
            
            # Add external directory
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            
            assert response.status_code == 200
            data = response.json()
            
            if data.get("compilation_status") == "warning":
                error_msg = data["compilation_errors"].get(proto_name, "Unknown error")
                pytest.fail(f"Compilation failed for nested literal: {error_msg}")

            assert data.get("compilation_status") == "success"

        finally:
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)

    def test_parameterization_complex_types(self, client):
        """
        Test parameterization with various complex types (CHOICE, ENUM, SEQUENCE OF)
        and mixed integer literals to ensure robust handling across the board.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            proto_name = "complex_param_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
ComplexParam DEFINITIONS AUTOMATIC TAGS ::= BEGIN

    -- 1. Parameterized CHOICE
    ParamChoice { T } ::= CHOICE {
        a T,
        b INTEGER
    }

    -- 2. Parameterized SEQUENCE OF with literal constraint
    ParamSeqOf { INTEGER: size } ::= SEQUENCE OF INTEGER (0..size)

    -- 3. Deep nesting with mix of Type and Value params
    Deep { T, INTEGER: maxVal } ::= SEQUENCE {
        item T,
        list ParamSeqOf { maxVal },  -- Literal substitution check
        choice ParamChoice { T }
    }
    
    -- Instantiation
    MyComplex ::= Deep { BOOLEAN, 100 }
    
    -- Verify literal handling in various positions
    LiteralUser ::= SEQUENCE {
        s1 ParamSeqOf { 10 },
        s2 ParamSeqOf { 20 }
    }

END
"""
            with open(os.path.join(proto_dir, "complex.asn"), "w") as f:
                f.write(asn_content)
            
            # Get original config
            response = client.get("/api/config/")
            original_config = response.json()
            
            # Add external directory
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            
            assert response.status_code == 200
            data = response.json()
            
            if data.get("compilation_status") == "warning":
                error_msg = data["compilation_errors"].get(proto_name, "Unknown error")
                pytest.fail(f"Compilation failed for complex types: {error_msg}")

            assert data.get("compilation_status") == "success"
            
            # Basic encode text to ensure runtime works
            test_data = {
                "item": True,
                "list": [1, 50, 99],
                "choice": {"a": False}
            }
            encode_resp = client.post("/api/asn/encode", json={
                "protocol": proto_name,
                "type_name": "MyComplex",
                "data": test_data
            })
            assert encode_resp.status_code == 200
            assert encode_resp.json()["status"] == "success"

        finally:
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)
