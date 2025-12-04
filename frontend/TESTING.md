# MSC Editor Testing Guide

This document describes the automated tests for the MSC Editor functionality.

## Running Tests

### Run All Tests
```bash
cd frontend
npm run test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test Files
```bash
# MSC Editor component tests
npm run test -- src/pages/MscEditor.test.tsx

# useMscEditor hook tests
npm run test -- src/hooks/useMscEditor.test.tsx
```

### Run Tests with Coverage
```bash
npm run test -- --coverage
```

## Test Coverage

### Component Tests (`MscEditor.test.tsx`)

Tests the MSC Editor React component:

- ✅ **Rendering**: Verifies the component renders correctly with header, protocol selector, and sequence name input
- ✅ **Sequence Creation**: Tests automatic sequence creation on mount
- ✅ **Protocol Types Loading**: Validates that message types are loaded for the selected protocol
- ✅ **Sequence Name Debouncing**: Ensures sequence name updates are debounced (500ms) to prevent excessive API calls
- ✅ **Sequence Name Blur**: Tests immediate save on input blur
- ✅ **Message Display**: Verifies messages are displayed in the sequence list
- ✅ **Message Addition**: Tests adding messages with default JSON data from backend
- ✅ **Message Detail Panel**: Validates that clicking a message opens the detail panel
- ✅ **Hex Decoding**: Tests hex string decoding and message creation
- ✅ **State Panel**: Verifies state tracking display when a message is selected
- ✅ **Undo/Redo**: Tests undo/redo functionality
- ✅ **Save/Load**: Validates file save and load operations
- ✅ **Empty State**: Tests display when no messages exist
- ✅ **Actor Headers**: Verifies UE and gNB actor headers are displayed
- ✅ **Protocol Change**: Tests protocol switching and sequence recreation

### Hook Tests (`useMscEditor.test.tsx`)

Tests the `useMscEditor` custom hook business logic:

- ✅ **Initialization**: Verifies initial state is correct
- ✅ **Sequence Creation**: Tests creating new sequences
- ✅ **Message Addition**: Tests adding messages to sequences
- ✅ **Message Removal**: Tests removing messages from sequences
- ✅ **Sequence Validation**: Tests validation functionality
- ✅ **Sequence Name Update**: Tests updating sequence names
- ✅ **Undo/Redo**: Tests history management
- ✅ **Export/Import**: Tests sequence export and import

## Key Test Scenarios

### 1. Sequence Name Debouncing
```typescript
// Typing multiple characters should not trigger API calls immediately
fireEvent.change(nameInput, { target: { value: 'M' } });
fireEvent.change(nameInput, { target: { value: 'My' } });
fireEvent.change(nameInput, { target: { value: 'My Test' } });

// Should not call setSequenceName immediately
expect(setSequenceName).not.toHaveBeenCalled();

// After 500ms, should be called
vi.advanceTimersByTime(500);
expect(setSequenceName).toHaveBeenCalledWith('My Test');
```

### 2. Message Addition with Default Data
```typescript
// When adding a message, should fetch default JSON structure
const response = await fetch(`/api/asn/protocols/${protocol}/types/${typeName}/example`);
// Then add message with the fetched data
await addMessage({ type_name, data: exampleData });
```

### 3. Hex Decoding
```typescript
// Should decode hex and create message
fireEvent.change(hexInput, { target: { value: '80 05 1A 2B' } });
fireEvent.click(decodeButton);
// Should call decode endpoint and add message
```

## Continuous Integration

These tests should be run:
- Before committing code
- In CI/CD pipeline
- Before releasing new versions

## Writing New Tests

When adding new features to the MSC Editor:

1. **Add component test** in `MscEditor.test.tsx` for UI interactions
2. **Add hook test** in `useMscEditor.test.tsx` for business logic
3. **Mock external dependencies** (API calls, localStorage, etc.)
4. **Test edge cases** (empty states, error handling, etc.)
5. **Test user interactions** (clicks, typing, form submissions)

## Mocking

Tests use mocks for:
- `useMscEditor` hook
- `axios` for API calls
- `global.fetch` for protocol types and examples
- `localStorage` for persistence
- Browser APIs (ResizeObserver, matchMedia, etc.)

## Debugging Tests

If a test fails:

1. Check the error message and stack trace
2. Verify mocks are set up correctly
3. Check if async operations are properly awaited
4. Use `screen.debug()` to see the rendered output
5. Run tests in watch mode to see changes in real-time

## Example Test Output

```
✓ renders MSC Editor with header
✓ creates a new sequence on mount if none exists
✓ displays protocol selector
✓ loads available message types for protocol
✓ allows changing sequence name with debouncing
✓ saves sequence name immediately on blur
✓ displays current sequence messages
✓ allows adding a new message with default JSON data
✓ displays message detail panel when message is clicked
✓ handles hex decoding
✓ displays state panel when message is selected
✓ handles undo/redo actions
✓ disables undo/redo when not available
✓ handles save to file
✓ displays empty state when no messages
✓ shows actor headers
✓ handles protocol change

Test Files  2 passed (2)
     Tests  18 passed (18)
  Start at  10:30:45
  Duration  2.45s
```

