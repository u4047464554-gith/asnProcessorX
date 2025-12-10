import json
import os
import sys

# Set encoding to utf-8 for output to handle emojis correctly
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

try:
    path = 'frontend/test-results.json'
    if not os.path.exists(path):
        print("No test results found.")
        sys.exit(0)

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = data['numTotalTests']
    passed = data['numPassedTests']
    failed = data['numFailedTests']
    
    print(f"\n## Test Summary")
    print(f"**Total:** {total} | **Passed:** {passed} ✅ | **Failed:** {failed} ❌")
    
    if failed > 0:
        print("\n### ❌ Failures by File")
        
        # Group result by file
        files = {}
        for suite in data['testResults']:
            # filename relative to project
            filename = suite['name'].replace('\\', '/')
            if 'frontend/src/' in filename:
                filename = filename.split('frontend/src/')[-1]
            
            failures = []
            for res in suite['assertionResults']:
                if res['status'] == 'failed':
                    failures.append(res)
            
            if failures:
                 print(f"\n#### `{filename}` ({len(failures)} failures)")
                 for fail in failures:
                     title = fail['title']
                     msg = "Unknown error"
                     if fail['failureMessages']:
                         lines = fail['failureMessages'][0].split('\n')
                         msg = lines[0]
                         if len(msg) > 120: msg = msg[:120] + "..."
                     print(f"- **{title}**")
                     print(f"  - `{msg}`")
    
    print("\nDone.")
except Exception as e:
    print(f"Error parsing results: {e}")
