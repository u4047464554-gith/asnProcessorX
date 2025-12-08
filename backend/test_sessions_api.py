"""Test script for Sessions API."""
import requests
import sys

BASE_URL = "http://localhost:8000"

def test_api():
    errors = []
    
    print("=" * 60)
    print("SESSIONS API TEST")
    print("=" * 60)
    
    # 1. List sessions (should have default)
    print("\n1. List sessions...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        sessions = res.json()
        assert isinstance(sessions, list), "Expected list"
        assert len(sessions) >= 1, "Expected at least one session (default)"
        print(f"   ✓ Found {len(sessions)} session(s)")
        for s in sessions:
            print(f"     - {s['id']}: {s['name']}")
    except Exception as e:
        errors.append(f"List sessions: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 2. Create a new session
    print("\n2. Create new session...")
    new_session_id = None
    try:
        res = requests.post(f"{BASE_URL}/api/sessions", json={
            "name": "Test Session",
            "description": "Created by test script"
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        session = res.json()
        assert session['name'] == "Test Session"
        new_session_id = session['id']
        print(f"   ✓ Created session: {new_session_id}")
    except Exception as e:
        errors.append(f"Create session: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 3. Get session by ID
    print("\n3. Get session by ID...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        session = res.json()
        assert session['id'] == new_session_id
        print(f"   ✓ Got session: {session['name']}")
    except Exception as e:
        errors.append(f"Get session: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 4. Update session
    print("\n4. Update session...")
    try:
        res = requests.put(f"{BASE_URL}/api/sessions/{new_session_id}", json={
            "name": "Test Session Updated",
            "description": "Updated by test"
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        session = res.json()
        assert session['name'] == "Test Session Updated"
        print(f"   ✓ Updated to: {session['name']}")
    except Exception as e:
        errors.append(f"Update session: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 5. Save scratchpad to session
    print("\n5. Save scratchpad to session...")
    try:
        test_content = "Hello from test script!\nLine 2\nLine 3"
        res = requests.put(f"{BASE_URL}/api/sessions/{new_session_id}/scratchpad", json={
            "content": test_content
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        print(f"   ✓ Saved scratchpad")
    except Exception as e:
        errors.append(f"Save scratchpad: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 6. Load scratchpad from session
    print("\n6. Load scratchpad from session...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}/scratchpad")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data['content'] == test_content, f"Content mismatch"
        print(f"   ✓ Loaded scratchpad: {len(data['content'])} chars")
    except Exception as e:
        errors.append(f"Load scratchpad: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 7. Save message to session
    print("\n7. Save message to session...")
    try:
        res = requests.post(f"{BASE_URL}/api/sessions/{new_session_id}/messages", json={
            "filename": "test_message",
            "protocol": "rrc_demo",
            "type": "RRCConnectionRequest",
            "data": {"test": "data", "value": 123}
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        print(f"   ✓ Saved message")
    except Exception as e:
        errors.append(f"Save message: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 8. List messages in session
    print("\n8. List messages in session...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}/messages")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        messages = res.json()
        assert isinstance(messages, list)
        assert "test_message.json" in messages
        print(f"   ✓ Found {len(messages)} message(s): {messages}")
    except Exception as e:
        errors.append(f"List messages: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 9. Get message from session
    print("\n9. Get message from session...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}/messages/test_message.json")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        msg = res.json()
        assert msg['protocol'] == "rrc_demo"
        assert msg['type'] == "RRCConnectionRequest"
        print(f"   ✓ Got message: {msg['type']}")
    except Exception as e:
        errors.append(f"Get message: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 10. Delete message from session
    print("\n10. Delete message from session...")
    try:
        res = requests.delete(f"{BASE_URL}/api/sessions/{new_session_id}/messages/test_message.json")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        print(f"   ✓ Deleted message")
        
        # Verify deletion
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}/messages")
        messages = res.json()
        assert "test_message.json" not in messages
        print(f"   ✓ Verified deletion")
    except Exception as e:
        errors.append(f"Delete message: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 11. Delete session
    print("\n11. Delete test session...")
    try:
        res = requests.delete(f"{BASE_URL}/api/sessions/{new_session_id}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        print(f"   ✓ Deleted session")
        
        # Verify deletion
        res = requests.get(f"{BASE_URL}/api/sessions/{new_session_id}")
        assert res.status_code == 404, "Session should be deleted"
        print(f"   ✓ Verified deletion (404)")
    except Exception as e:
        errors.append(f"Delete session: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # 12. Cannot delete last session
    print("\n12. Test cannot delete last session...")
    try:
        res = requests.get(f"{BASE_URL}/api/sessions")
        sessions = res.json()
        if len(sessions) == 1:
            res = requests.delete(f"{BASE_URL}/api/sessions/{sessions[0]['id']}")
            assert res.status_code == 400, f"Expected 400, got {res.status_code}"
            print(f"   ✓ Correctly prevented deletion of last session")
        else:
            print(f"   ⊘ Skipped (more than one session exists)")
    except Exception as e:
        errors.append(f"Delete last session test: {e}")
        print(f"   ✗ FAILED: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    if errors:
        print(f"FAILED: {len(errors)} error(s)")
        for e in errors:
            print(f"  - {e}")
        return 1
    else:
        print("ALL TESTS PASSED! ✓")
        return 0

if __name__ == "__main__":
    sys.exit(test_api())
