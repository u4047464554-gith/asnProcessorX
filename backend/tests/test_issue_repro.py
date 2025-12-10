
def test_rrc_encoding_mismatch_repro(client):
    # Reproduction of the user's issue:
    # Protocol: rrc_demo
    # Type: RRCConnectionRequest (SEQUENCE)
    # Data: InitialUE-Identity payload (CHOICE -> Tuple)
    
    # This mimics what the frontend was sending when the state was desynchronized

    # But the error message said "got ('randomValue', ...)". 
    # This means the INPUT to the encoder was a tuple.
    # deserialize_asn1_data returns a tuple ONLY if the input dict represents a CHOICE.
    
    # If the user input was the JSON for InitialUE-Identity:
    initial_ue_identity_json = {
        "$choice": "randomValue",
        "value": ["0x1122334455", 40]
    }
    
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": initial_ue_identity_json,
        "encoding_rule": "per"
    }
    
    response = client.post("/api/asn/encode", json=payload)
    
    # We expect this to fail because RRCConnectionRequest is a SEQUENCE, 
    # but we passed data that deserializes to a CHOICE tuple.
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failure"
    error_detail = data["error"]
    print(f"\n[REPRO] Error detail: {error_detail}")
    
    # Verify it matches the user's reported error structure
    # "Encoding Error: ... Expected data of type dict, but got ('randomValue', ...)"
    # OR with improved converter: "Sequence member ... not found"
    assert "Expected data of type dict" in error_detail or "Sequence member" in error_detail
    assert "randomValue" in error_detail

def test_rrc_connection_request_valid(client):
    # Verify valid payload works
    valid_data = {
        "ue-Identity": {
            "$choice": "randomValue",
            "value": ["0x0123456789", 40]
        },
        "establishmentCause": "mo-Signalling",
        "spare": ["0x80", 1]
    }
    
    payload = {
        "protocol": "rrc_demo",
        "type_name": "RRCConnectionRequest",
        "data": valid_data,
        "encoding_rule": "per"
    }
    
    response = client.post("/api/asn/encode", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"




