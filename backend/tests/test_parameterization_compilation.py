
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
