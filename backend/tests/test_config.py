import os
import sys
import tempfile
import shutil

# Add project root to sys.path
sys.path.append(os.getcwd())

def test_get_default_config(client):
    response = client.get("/api/config/")
    assert response.status_code == 200
    data = response.json()
    
    # Default config has asn_specs in specs_directories
    assert "specs_directories" in data
    assert isinstance(data["specs_directories"], list)
    assert "asn_specs" in data["specs_directories"]
    
    # Default log level
    assert data["log_level"] == "INFO"

def test_update_config(client):
    # Get current config
    response = client.get("/api/config/")
    assert response.status_code == 200
    original_config = response.json()
    
    # Modify config
    new_specs = original_config["specs_directories"] + ["/tmp/test_specs"]
    update_payload = {
        "specs_directories": new_specs,
        "log_level": "DEBUG"
    }
    
    # Send update
    response = client.put("/api/config/", json=update_payload)
    if response.status_code != 200:
        print(f"Update config failed: {response.text}")
    assert response.status_code == 200
    data = response.json()
    
    assert data["specs_directories"] == new_specs
    assert data["log_level"] == "DEBUG"
    
    # Verify persistence (GET again)
    response = client.get("/api/config/")
    assert response.status_code == 200
    assert response.json()["specs_directories"] == new_specs
    
    # Cleanup: Revert to original
    client.put("/api/config/", json=original_config)

def test_reload_behavior(client):
    # This test is tricky because it modifies global state.
    # We will create a temporary directory with a simple ASN spec,
    # add it to config, and check if the new protocol appears.
    
    tmp_dir = tempfile.mkdtemp()
    try:
        # Create a dummy protocol folder and asn file
        proto_name = "temp_test_proto"
        proto_dir = os.path.join(tmp_dir, proto_name)
        os.makedirs(proto_dir)
        
        with open(os.path.join(proto_dir, "test.asn"), "w") as f:
            f.write("""
            TestModule DEFINITIONS AUTOMATIC TAGS ::= BEGIN
            TestType ::= INTEGER
            END
            """)
            
        # Update config to include tmp_dir
        response = client.get("/api/config/")
        original_config = response.json()
        
        new_specs = original_config["specs_directories"] + [tmp_dir]
        client.put("/api/config/", json={"specs_directories": new_specs})
        
        # Check protocols list - it should now include 'temp_test_proto'
        # The backend reloads automatically on config update
        response = client.get("/api/asn/protocols")
        assert response.status_code == 200
        protocols = response.json()
        
        assert proto_name in protocols
        
        # Cleanup config
        client.put("/api/config/", json=original_config)
        
    finally:
        shutil.rmtree(tmp_dir)

