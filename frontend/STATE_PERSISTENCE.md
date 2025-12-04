# State Persistence Implementation

## Overview

The MSC Editor now retains all state between page reloads, connection losses, and browser restarts. All user edits are automatically saved to localStorage and restored when the application loads.

## What Gets Persisted

### 1. **Current Sequence** (`useMscEditor` hook)
- Full sequence data including:
  - Sequence ID, name, protocol
  - All messages with their data
  - Configurations and tracked identifiers
  - Validation results
- Auto-saved on every change (debounced by 300ms)
- Saved on `beforeunload` event

### 2. **Selected Message Index**
- Which message is currently selected
- Persisted in both hook state and component state
- Restored on page load

### 3. **Protocol Selection**
- Currently selected protocol (rrc_demo, nr_rel17_rrc, etc.)
- Persisted in hook state
- Restored on page load

### 4. **UI State** (`MscEditor` component)
- `showMessageDetail` - Whether message detail panel is open
- `selectedMsgIndex` - Selected message index (component level)
- `protocol` - Protocol selection (component level)

### 5. **Sequence List**
- All sequences the user has created/loaded
- Persisted in `persistedSequences` array
- Merged with backend data on load

## Storage Keys

All data is stored in localStorage with these keys:

- `msc-editor-state-sequences` - Array of all sequences
- `msc-editor-state-current-sequence` - Current sequence being edited
- `msc-editor-state-selected-index` - Selected message index
- `msc-editor-state-protocol` - Selected protocol
- `msc-editor-protocol` - Protocol (component level)
- `msc-editor-selected-index` - Selected index (component level)
- `msc-editor-show-detail` - Message detail panel visibility

## Auto-Save Behavior

### Debouncing
- Current sequence: Auto-saved 300ms after last change
- UI state: Saved immediately on change
- Selected index: Saved immediately on change

### Before Unload
- All state is saved when user closes tab/window
- Uses `beforeunload` event listener

## State Restoration

### On Page Load

1. **Sequences List**: Loaded from localStorage
2. **Current Sequence**: Restored if available
3. **Selected Message**: Restored if available
4. **Protocol**: Restored if available
5. **UI State**: Restored (detail panel, etc.)

### Conflict Resolution

- If persisted sequence exists in loaded sequences: Use loaded version (more up-to-date)
- If persisted sequence doesn't exist: Add to sequences list
- If no current sequence: Create new "Untitled Sequence"

## Implementation Details

### Hook Level (`useMscEditor.ts`)

```typescript
// Persist current sequence
const [persistedCurrentSequence, setPersistedCurrentSequence] = useLocalStorage<MscSequence | null>({
  key: `${LOCAL_STORAGE_KEY}-current-sequence`,
  defaultValue: null,
});

// Auto-save with debouncing
useEffect(() => {
  if (!state.currentSequence) return;
  
  const timeoutId = setTimeout(() => {
    setPersistedCurrentSequence(state.currentSequence);
  }, 300);
  
  return () => clearTimeout(timeoutId);
}, [state.currentSequence]);
```

### Component Level (`MscEditor.tsx`)

```typescript
// Restore from localStorage on mount
const [protocol, setProtocol] = useState(() => {
  const saved = localStorage.getItem('msc-editor-protocol');
  return saved || initialProtocol || 'rrc_demo';
});

// Persist on change
useEffect(() => {
  localStorage.setItem('msc-editor-protocol', protocol);
}, [protocol]);
```

## User Experience

### Visual Feedback
- "Auto-saved" indicator in header (when sequence exists)
- No explicit save button needed (auto-saves continuously)

### Error Handling
- If localStorage is full: Error logged, but app continues
- If data is corrupted: Falls back to defaults, creates new sequence
- If restore fails: Creates new sequence, doesn't crash

## Testing

### Manual Testing
1. Add messages to a sequence
2. Reload page → Messages should still be there
3. Select a message, reload → Selection should be restored
4. Change protocol, reload → Protocol should be restored
5. Close browser, reopen → All state should be restored

### Edge Cases
- ✅ Empty localStorage (first time user)
- ✅ Corrupted localStorage data
- ✅ localStorage quota exceeded
- ✅ Multiple tabs (each has own state)
- ✅ Browser private/incognito mode (state lost on close, expected)

## Future Enhancements

1. **Backend Sync**: Sync localStorage with backend on reconnect
2. **Conflict Resolution**: Handle conflicts when backend has newer data
3. **Export/Import**: Allow users to export state for backup
4. **State Versioning**: Version state structure for migrations
5. **Compression**: Compress large sequences before storing
6. **IndexedDB**: Use IndexedDB for larger storage capacity

## Migration Notes

If the state structure changes in the future:
1. Increment `STORAGE_VERSION` constant
2. Add migration logic in `loadStoredState`
3. Convert old format to new format
4. Clear old format from localStorage

