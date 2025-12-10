"""
Test for external ASN.1 specification directory functionality.
This tests the key feature of allowing users to add custom ASN.1 specs.
"""
import os
import sys
import tempfile
import shutil
import pytest

sys.path.append(os.getcwd())


class TestExternalAsnSpecWorkflow:
    """Test workflows for adding and using external ASN.1 specifications."""

    def test_add_external_spec_directory_success(self, client):
        """
        WORKFLOW: Add External Spec Directory → Compile → Use Messages
        
        Steps:
        1. Create a temporary directory with valid ASN.1 spec
        2. Add directory to specs_directories via config API
        3. Verify protocol appears in protocol list
        4. Verify types are available
        5. Encode/decode a message using the new spec
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            # Step 1: Create a valid ASN.1 specification
            proto_name = "external_test_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
TestExternalModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN
    
    ExternalMessage ::= SEQUENCE {
        messageId   INTEGER (0..255),
        payload     OCTET STRING (SIZE (1..100)),
        priority    Priority
    }
    
    Priority ::= ENUMERATED {
        low(0),
        medium(1),
        high(2)
    }
    
END
"""
            with open(os.path.join(proto_dir, "external.asn"), "w") as f:
                f.write(asn_content)
            
            # Get original config
            response = client.get("/api/config/")
            assert response.status_code == 200
            original_config = response.json()
            
            # Step 2: Add external directory to config
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            assert response.status_code == 200
            data = response.json()
            
            # Verify compilation status
            assert data.get("compilation_status") == "success", \
                f"Compilation should succeed, got: {data.get('compilation_errors')}"
            
            # Step 3: Verify protocol appears in list
            response = client.get("/api/asn/protocols")
            assert response.status_code == 200
            protocols = response.json()
            assert proto_name in protocols, \
                f"Protocol '{proto_name}' should be in list. Available: {protocols}"
            
            # Step 4: Verify types are available
            response = client.get(f"/api/asn/protocols/{proto_name}/types")
            assert response.status_code == 200
            types = response.json()
            assert "ExternalMessage" in types, f"ExternalMessage should be in types: {types}"
            assert "Priority" in types, f"Priority should be in types: {types}"
            
            # Step 5: Encode a message
            test_message = {
                "messageId": 42,
                "payload": "48656C6C6F",  # "Hello" in hex
                "priority": "high"
            }
            response = client.post("/api/asn/encode", json={
                "protocol": proto_name,
                "type_name": "ExternalMessage",
                "data": test_message
            })
            assert response.status_code == 200, f"Encode failed: {response.text}"
            encoded = response.json()
            assert encoded.get("status") == "success", f"Encode status should be success: {encoded}"
            assert "hex_data" in encoded, f"Response should contain hex_data: {encoded}"
            
            # Step 6: Decode the message back
            response = client.post("/api/asn/decode", json={
                "protocol": proto_name,
                "hex_data": encoded["hex_data"],
                "type_name": "ExternalMessage"
            })
            assert response.status_code == 200, f"Decode failed: {response.text}"
            decoded = response.json()
            assert decoded["status"] == "success", f"Decode should succeed: {decoded}"
            # Verify decoded type
            assert decoded["decoded_type"] == "ExternalMessage"
            
        finally:
            # Cleanup: Restore original config
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)

    def test_add_external_spec_with_compilation_error(self, client):
        """
        WORKFLOW: Add External Spec with Invalid ASN.1 → Get Error Feedback
        
        This tests that users receive proper error messages when their
        ASN.1 specification has syntax errors.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            # Create an invalid ASN.1 specification
            proto_name = "broken_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            # Intentionally broken ASN.1 (missing END keyword, syntax error)
            broken_asn = """
BrokenModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN
    
    -- Missing type definition body
    BrokenType ::= 
    
    -- Missing END keyword
"""
            with open(os.path.join(proto_dir, "broken.asn"), "w") as f:
                f.write(broken_asn)
            
            # Get original config
            response = client.get("/api/config/")
            original_config = response.json()
            
            # Add external directory with broken spec
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            assert response.status_code == 200
            data = response.json()
            
            # CRITICAL: Verify we get error feedback
            assert data.get("compilation_status") == "warning", \
                "Compilation status should be 'warning' for broken spec"
            assert "compilation_errors" in data, \
                "Response should include compilation_errors"
            assert proto_name in data["compilation_errors"], \
                f"Error for '{proto_name}' should be reported: {data.get('compilation_errors')}"
            
            # Verify the error message is meaningful
            error_msg = data["compilation_errors"][proto_name]
            assert len(error_msg) > 0, "Error message should not be empty"
            
            # Protocol should NOT appear in the list (compilation failed)
            response = client.get("/api/asn/protocols")
            protocols = response.json()
            assert proto_name not in protocols, \
                f"Broken protocol should not appear in list: {protocols}"
            
        finally:
            # Cleanup
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)

    def test_nonexistent_directory_gracefully_handled(self, client):
        """
        WORKFLOW: Add Non-Existent Directory → Graceful Handling
        
        Ensures the system doesn't crash when a nonexistent path is added.
        """
        response = client.get("/api/config/")
        original_config = response.json()
        
        try:
            # Add a nonexistent directory
            fake_path = "/this/path/does/not/exist/12345"
            new_specs = original_config["specs_directories"] + [fake_path]
            
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            
            # Should succeed (path is just ignored)
            assert response.status_code == 200
            
            # Existing protocols should still work
            response = client.get("/api/asn/protocols")
            assert response.status_code == 200
            # Should have at least the bundled protocols
            protocols = response.json()
            assert len(protocols) > 0, "Should still have bundled protocols"
            
        finally:
            client.put("/api/config/", json=original_config)

    def test_protocol_types_available_after_adding_external_spec(self, client):
        """
        Test that after adding an external spec, we can list types.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            proto_name = "schema_test_protocol"
            proto_dir = os.path.join(tmp_dir, proto_name)
            os.makedirs(proto_dir)
            
            asn_content = """
SchemaTestModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN
    
    TestRecord ::= SEQUENCE {
        name    UTF8String (SIZE (1..64)),
        age     INTEGER (0..150) OPTIONAL,
        active  BOOLEAN
    }
    
END
"""
            with open(os.path.join(proto_dir, "schema.asn"), "w") as f:
                f.write(asn_content)
            
            response = client.get("/api/config/")
            original_config = response.json()
            
            new_specs = original_config["specs_directories"] + [tmp_dir]
            response = client.put("/api/config/", json={
                "specs_directories": new_specs
            })
            assert response.status_code == 200
            assert response.json().get("compilation_status") == "success"
            
            # Verify types are available
            response = client.get(f"/api/asn/protocols/{proto_name}/types")
            assert response.status_code == 200, f"Types fetch failed: {response.text}"
            types = response.json()
            
            # Verify the type is in the list
            assert "TestRecord" in types, f"TestRecord should be in types: {types}"
            
        finally:
            client.put("/api/config/", json=original_config)
            shutil.rmtree(tmp_dir)
