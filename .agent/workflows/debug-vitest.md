---
description: How to debug Vitest test failures efficiently
---

# Debugging Vitest Test Failures

## Use JSON Reporter for Clear Output

PowerShell has encoding issues with Vitest's colored output. Always use JSON reporter for reliable results:

```bash
npx vitest run [test-file] --reporter=json --outputFile=test-results.json
```

Then read the JSON file directly - it contains:
- `numPassedTests`, `numFailedTests` - Summary counts
- `testResults[].assertionResults[]` - Individual test results
- `failureMessages[]` - Actual error messages with stack traces

## Key Fields in JSON Output

```json
{
  "status": "failed|passed",
  "title": "test name",
  "failureMessages": ["Error message with stack trace"]
}
```

## Common Vitest/Testing-Library Errors

1. **"Unable to find element with placeholder text"**
   - UI changed, test selectors are outdated
   - Fix: Update selector to match current UI

2. **"Target container is not a DOM element"**
   - DOM was corrupted by previous test (usually from mocking document.createElement)
   - Fix: Restore mocked methods in afterEach

3. **"Found multiple elements"**
   - Use `getAllByText` instead of `getByText`

4. **"toBeInTheDocument not found"**
   - Missing `@testing-library/jest-dom` setup
   - Check `setupFiles` in vite.config.ts points to setup file with `import '@testing-library/jest-dom'`

## Running Specific Tests

```bash
# Single test file
npx vitest run src/pages/MyComponent.test.tsx

# Specific test by name pattern
npx vitest run -t "should load session"

# With verbose output (use JSON for PowerShell)
npx vitest run --reporter=verbose
```

## Workflow Tests vs Unit Tests

- **Workflow tests** (`.workflow.test.tsx`) - Test user flows with mocked services
- **Unit tests** (`.test.tsx`) - Test component behavior with mocked hooks

When tests diverge from implementation, prioritize fixing workflow tests first as they test actual user behavior.
