import json
from collections import defaultdict

d = json.load(open('frontend/test-results.json'))

print(f"Total: {d['numPassedTests']} passed, {d['numFailedTests']} failed")
print()

# Get detailed failures by file
failures = []
for suite in d['testResults']:
    file_name = suite['name'].split('/')[-1].split('\\')[-1]
    for r in suite['assertionResults']:
        if r['status'] == 'failed':
            error = r['failureMessages'][0].split('\n')[0] if r['failureMessages'] else 'Unknown'
            failures.append({
                'file': file_name,
                'test': r['title'],
                'error': error[:100]
            })

# Group by file
by_file = defaultdict(list)
for f in failures:
    by_file[f['file']].append(f)

print("Failures by file:")
print("=" * 70)
for fname, tests in sorted(by_file.items(), key=lambda x: -len(x[1])):
    print(f"\n{fname} ({len(tests)} failures):")
    for t in tests:
        print(f"  • {t['test'][:50]}")
        print(f"    → {t['error'][:70]}")
