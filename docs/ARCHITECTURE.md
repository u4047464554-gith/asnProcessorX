# ASN.1 Processor - Architecture Documentation

## Overview

The ASN.1 Processor is a full-stack web application for editing, validating, and visualizing ASN.1 (Abstract Syntax Notation One) protocol messages. It features a Message Sequence Chart (MSC) Editor for designing protocol flows and a structured JSON editor for message data.

## Technology Stack

| Layer            | Technology                                            |
| ---------------- | ----------------------------------------------------- |
| Frontend         | React 18, TypeScript, Vite                            |
| UI Framework     | Mantine UI v7                                         |
| State Management | React Hooks (useState, useContext)                    |
| Backend          | Python 3.11+, FastAPI                                 |
| ASN.1 Compiler   | pycrate                                               |
| Storage          | File-based JSON persistence                           |
| Testing          | Vitest (frontend), Pytest (backend), Playwright (E2E) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   App.tsx    │  │  MscEditor   │  │    Components            │  │
│  │  (Main View) │  │   (MSC View) │  │  - StructuredJsonEditor  │  │
│  │              │  │              │  │  - MscMessageDetail      │  │
│  │              │  │              │  │  - MscActorPanel         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                                         │
│  ┌──────┴─────────────────┴─────────────────────────────────────┐  │
│  │                     Hooks & Services                          │  │
│  │  - useAsnProcessor (main view logic)                          │  │
│  │  - useMscEditor (MSC editor logic)                            │  │
│  │  - useSession (session management)                            │  │
│  │  - mscService (API client for MSC)                            │  │
│  │  - mscSessionService (API client for sessions)                │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTP/REST API
┌─────────────────────────────┼───────────────────────────────────────┐
│                           Backend (FastAPI)                          │
├─────────────────────────────┴───────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                      Routers (API Layer)                    │     │
│  │  /api/asn/*     - ASN.1 operations (encode, decode, etc.)  │     │
│  │  /api/msc/*     - MSC sequence operations                  │     │
│  │  /api/sessions  - Session management                       │     │
│  │  /api/scratchpad - Scratchpad/notes                        │     │
│  └────────────────────────────┬───────────────────────────────┘     │
│                               │                                      │
│  ┌────────────────────────────┴───────────────────────────────┐     │
│  │               Application Layer (Services)                  │     │
│  │  - MscApplicationService (orchestrates use cases)          │     │
│  │  - AsnManager (ASN.1 compilation & operations)             │     │
│  └────────────────────────────┬───────────────────────────────┘     │
│                               │                                      │
│  ┌────────────────────────────┴───────────────────────────────┐     │
│  │                    Domain Layer (Entities)                  │     │
│  │  - MscSequence, MscMessage, MscSession                     │     │
│  │  - TrackedIdentifier, ValidationResult                     │     │
│  └────────────────────────────┬───────────────────────────────┘     │
│                               │                                      │
│  ┌────────────────────────────┴───────────────────────────────┐     │
│  │              Infrastructure Layer (Repositories)            │     │
│  │  - MscRepository (file-based persistence with index)       │     │
│  │  - SequenceValidator, ConfigurationTracker                 │     │
│  │  - RrcIdentifierDetector, RRCStateMachine                  │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                         File System                                  │
├─────────────────────────────────────────────────────────────────────┤
│  msc_storage/                                                        │
│  ├── _sequence_index.json     # ID -> path index for O(1) lookup    │
│  ├── sessions/                                                       │
│  │   └── {session_id}/                                              │
│  │       └── {protocol}/                                            │
│  │           └── {name}_{id}.json                                   │
│  └── {protocol}/              # Legacy: sequences without session   │
│      └── {name}_{id}.json                                           │
│                                                                      │
│  asn_specs/                   # ASN.1 protocol definitions          │
│  ├── rrc_demo/                                                       │
│  ├── nr_rel17_rrc/                                                   │
│  └── simple_demo/                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture (Clean Architecture / DDD)

The backend follows Clean Architecture principles with four layers:

### 1. Domain Layer (`backend/domain/`)

Contains business entities and interfaces (no external dependencies):

```
domain/msc/
├── entities.py       # MscSequence, MscMessage, MscSession, etc.
└── interfaces.py     # Repository and service interfaces
```

**Key Entities:**
- `MscSequence`: A message sequence chart containing messages
- `MscMessage`: A single protocol message with type, data, actors
- `MscSession`: Groups related sequences together
- `TrackedIdentifier`: Tracks IDs across messages (e.g., RRC transaction ID)
- `ValidationResult`: Validation errors/warnings

### 2. Application Layer (`backend/application/`)

Contains use cases and application services:

```
application/msc/
├── use_cases.py      # CreateSequence, UpdateSequence, ValidateSequence
└── services.py       # MscApplicationService, DTOs
```

**Key Use Cases:**
- `CreateSequenceUseCase`: Creates a new sequence
- `UpdateSequenceUseCase`: Updates sequence (name, messages, etc.)
- `ValidateSequenceUseCase`: Validates messages against ASN.1 schema

### 3. Infrastructure Layer (`backend/infrastructure/`)

Contains implementations of domain interfaces:

```
infrastructure/msc/
├── msc_repository.py       # File-based persistence with index
├── identifier_detector.py  # Detects tracked IDs in messages
├── configuration_tracker.py # Tracks configuration across messages
├── sequence_validator.py   # Validates message sequences
├── rrc_state_machine.py    # RRC protocol state tracking
└── dependencies.py         # FastAPI dependency injection
```

**MscRepository Features:**
- File-based JSON storage organized by session/protocol
- Index file (`_sequence_index.json`) for O(1) sequence lookup by ID
- Automatic index rebuild on startup if missing
- Session-based directory organization

### 4. Routers Layer (`backend/routers/`)

FastAPI route handlers (API endpoints):

```
routers/
├── msc.py           # /api/msc/* endpoints
├── sessions.py      # /api/sessions endpoints
├── scratchpad.py    # /api/scratchpad endpoints
└── asn.py          # /api/asn/* endpoints (main ASN router)
```

---

## Frontend Architecture

### Component Structure

```
frontend/src/
├── App.tsx                    # Main view with ASN.1 editor
├── main.tsx                   # React entry point
├── pages/
│   └── MscEditor.tsx          # MSC Editor page
├── components/
│   ├── editor/
│   │   └── StructuredJsonEditor.tsx  # Reusable JSON editor
│   └── msc/
│       ├── MscHeader.tsx      # Editor header with controls
│       ├── MscMessageDetail.tsx # Message editing panel
│       └── MscActorPanel.tsx  # Actor state visualization
├── hooks/
│   ├── useAsnProcessor.ts     # Main view state & logic
│   ├── useMscEditor.ts        # MSC editor state & logic
│   └── useSession.tsx         # Session context provider
├── services/
│   ├── mscService.ts          # MSC API client
│   └── mscSessionService.ts   # Session API client
└── types/
    └── msc.ts                 # TypeScript type definitions
```

### State Management

The app uses React hooks for state management:

1. **`useMscEditor`**: Main hook for MSC editor
   - Manages current sequence, messages, validation state
   - Handles persistence to localStorage and backend
   - Provides undo/redo functionality

2. **`useSession`**: Context provider for sessions
   - Manages session list and current session
   - Persists current session ID to localStorage

3. **`useAsnProcessor`**: Hook for main ASN.1 view
   - Handles encode/decode operations
   - Manages protocol selection and message editing

### Shared Components

The `StructuredJsonEditor` component is shared between:
- Main view (`App.tsx`) - for direct ASN.1 message editing
- MSC Editor (`MscMessageDetail.tsx`) - for message data in sequences

This ensures consistent ASN.1 validation behavior across both views.

---

## Data Flow

### Creating a Sequence

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│ MscEditor   │───►│ useMscEditor │───►│ mscService      │───►│ FastAPI    │
│ (UI)        │    │ (Hook)       │    │ (HTTP Client)   │    │ /api/msc   │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────┬─────┘
                                                                      │
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────┴─────┐
│ File System │◄───│ MscRepository│◄───│ MscAppService   │◄───│ msc.py     │
│ (JSON)      │    │ (Persistence)│    │ (Use Cases)     │    │ (Router)   │
└─────────────┘    └──────────────┘    └─────────────────┘    └────────────┘
```

### Adding a Message

1. User types message type and clicks "Add"
2. `MscEditor.handleAddMessage()` calls `addMessage()` from hook
3. `useMscEditor.addMessage()` calls `mscService.addMessageToSequence()`
4. Backend receives POST `/api/msc/sequences/{id}/messages`
5. `MscApplicationService.add_message_to_sequence()` creates message
6. `MscRepository.update_sequence()` persists to file and updates index
7. Response returns updated sequence
8. Frontend state updates, triggers re-render

---

## Storage Architecture

### Index-Based Lookup

The repository uses an index file for O(1) sequence lookup:

```json
// _sequence_index.json
{
  "d6ba956b-711d-42c8-be63-eabb494b75a4": "C:/path/to/sessions/abc/nr_rel17_rrc/Untitled Sequence_d6ba956b.json",
  "041aa2e3-aaaf-4a0c-8d54-c8e5727cd22c": "C:/path/to/sessions/xyz/rrc_demo/My Sequence_041aa2e3.json"
}
```

**Index Lifecycle:**
1. On startup: Load index or rebuild by scanning directories
2. On create: Add entry to index
3. On update: Update entry if path changed
4. On delete: Remove entry from index
5. On lookup: Direct dictionary access (O(1))

### File Organization

```
msc_storage/
├── _sequence_index.json           # Master index
├── sessions/
│   ├── {session_id}/              # Session directory
│   │   ├── {session_id}.json      # Session metadata (optional)
│   │   └── {protocol}/            # Protocol subdirectory
│   │       └── {name}_{id8}.json  # Sequence file
│   └── default/                   # Default session
│       └── nr_rel17_rrc/
│           └── Untitled Sequence_abc12345.json
└── rrc_demo/                      # Legacy: no session
    └── Test_def67890.json
```

---

## API Endpoints

### MSC Endpoints (`/api/msc/`)

| Method | Endpoint                   | Description             |
| ------ | -------------------------- | ----------------------- |
| GET    | `/sequences`               | List all sequences      |
| POST   | `/sequences`               | Create new sequence     |
| GET    | `/sequences/{id}`          | Get sequence by ID      |
| PUT    | `/sequences/{id}`          | Update sequence         |
| DELETE | `/sequences/{id}`          | Delete sequence         |
| POST   | `/sequences/{id}/messages` | Add message to sequence |
| POST   | `/sequences/{id}/validate` | Validate sequence       |

### Session Endpoints (`/api/sessions`)

| Method | Endpoint | Description        |
| ------ | -------- | ------------------ |
| GET    | `/`      | List all sessions  |
| POST   | `/`      | Create new session |
| GET    | `/{id}`  | Get session by ID  |
| PUT    | `/{id}`  | Update session     |
| DELETE | `/{id}`  | Delete session     |

### ASN.1 Endpoints (`/api/asn/`)

| Method | Endpoint                                 | Description                  |
| ------ | ---------------------------------------- | ---------------------------- |
| GET    | `/protocols`                             | List available protocols     |
| GET    | `/protocols/{name}/types`                | Get types for protocol       |
| GET    | `/protocols/{name}/types/{type}/example` | Get example JSON             |
| POST   | `/encode`                                | Encode JSON to hex           |
| POST   | `/decode`                                | Decode hex to JSON           |
| POST   | `/validate`                              | Validate JSON against schema |

---

## Testing Architecture

### Backend Tests

```
backend/tests/
├── test_msc_api_workflows.py      # API workflow tests
├── test_msc_e2e_workflow.py       # End-to-end workflow tests
└── infrastructure/msc/
    └── test_msc_repository.py     # Repository unit tests
```

### Frontend Tests

```
frontend/src/
├── tests/
│   └── MscWorkflow.test.tsx       # Component integration tests
├── hooks/
│   └── useMscEditor.workflow.test.tsx  # Hook unit tests
└── components/editor/
    └── StructuredJsonEditor.test.tsx   # Component unit tests
```

### E2E Tests

```
e2e/
└── msc-workflow.spec.ts           # Playwright E2E tests
```

---

## Key Design Decisions

1. **File-based Storage**: Chose JSON files over database for simplicity and portability. Each sequence is a self-contained JSON file.

2. **Index for Lookups**: Added `_sequence_index.json` to avoid recursive directory scanning when looking up sequences by ID.

3. **Session Organization**: Sequences are organized under sessions for better multi-project support.

4. **Shared StructuredJsonEditor**: Single component for ASN.1 editing ensures consistent validation across main view and MSC editor.

5. **Clean Architecture**: Backend uses layered architecture (Domain → Application → Infrastructure → Routers) for testability and maintainability.

6. **React Hooks**: Frontend uses custom hooks (`useMscEditor`, `useSession`) for state management instead of external libraries like Redux.

7. **FastAPI Dependencies**: Uses FastAPI's dependency injection for clean separation and testability.
