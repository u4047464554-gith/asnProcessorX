import json

d = json.load(open('frontend/test-results.json'))

# Group failures by test file
failures_by_file = {}
for suite in d['testResults']:
    file_name = suite['name'].split('/')[-1]
    failed_tests = [r for r in suite['assertionResults'] if r['status'] == 'failed']
    if failed_tests:
        failures_by_file[file_name] = failed_tests

print(f"Frontend Test Summary")
print(f"=" * 60)
print(f"Passed: {d['numPassedTests']}, Failed: {d['numFailedTests']}")
print()

for file_name, failures in sorted(failures_by_file.items()):
    print(f"\n{file_name}: {len(failures)} failures")
    print("-" * 50)
    for test in failures[:5]:  # Show first 5 per file
        title = test['title'][:60]
        error = test['failureMessages'][0].split('\n')[0][:70] if test['failureMessages'] else 'Unknown'
        print(f"  - {title}")
        print(f"    {error}")
