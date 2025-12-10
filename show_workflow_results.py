import json
import sys

try:
    with open('frontend/workflow-results.json', 'r') as f:
        data = json.load(f)

    print(f"Test Suite: {data['testResults'][0]['name'].split('/')[-1]}")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for result in data['testResults'][0]['assertionResults']:
        status_icon = "✅" if result['status'] == 'passed' else "❌"
        print(f"{status_icon} {result['title']}")
        if result['status'] == 'passed':
            passed += 1
        else:
            failed += 1
            for msg in result.get('failureMessages', []):
                print(f"   Error: {msg.splitlines()[0]}")

    print("-" * 60)
    print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")

except Exception as e:
    print(f"Error parsing results: {e}")
