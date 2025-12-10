import json

d = json.load(open('frontend/test-results.json'))

print(f"=" * 60)
print(f"FRONTEND TEST SUMMARY")
print(f"=" * 60)
print(f"Passed: {d['numPassedTests']}")
print(f"Failed: {d['numFailedTests']}")
print(f"Total:  {d['numTotalTests']}")
print(f"Pass Rate: {100 * d['numPassedTests'] / d['numTotalTests']:.1f}%")
print(f"=" * 60)
