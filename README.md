# ASN.1 Stream Processor - MVP

## Prerequisites
- Python 3.10+
- Node.js 18+

## Setup

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Frontend
```bash
cd frontend
npm install
# Optional: override backend URL (defaults to 8000; Vite dev ports auto-map to 8010)
# PowerShell:
#   setx VITE_API_BASE "http://localhost:8010"
# macOS/Linux:
#   export VITE_API_BASE="http://localhost:8010"
# Restart your terminal so Vite picks it up.
```

## Running the App

### 1. Start Backend
```bash
# From project root - uses port conflict detection
python backend/run_server.py
```
Server will start at `http://localhost:8000`.

**Note**: If you get a "Port 8000 already in use" error, kill the old process:
```bash
# Find the process
netstat -ano | findstr :8000
# Kill it (replace <PID> with actual number)
taskkill /PID <PID> /F
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Client will start at `http://localhost:5173` (or the next free port). The UI calls the backend at `VITE_API_BASE`. When unset, it autodetects common Vite dev ports and talks to `http://localhost:8010`; otherwise it uses same-origin requests.

## Quality Checks

Run these commands from the project root:

### Tests & Coverage
```bash
python -m pytest --cov=backend/routers --cov=backend/core backend/tests/
```

### Linting (Ruff)
```bash
python -m ruff check backend/
```

### Type Checking (MyPy)
```bash
python -m mypy backend/
```

## Features
- **Dynamic Schema Loading**: Place `.asn` files in `asn_specs/`.
- **Multi-File Protocols**: Each protocol folder may contain several `.asn` sources that import from one another. The `multi_file_demo` example shows this by splitting shared types and the top-level message into `common.asn` and `main.asn`.
- **Protocols**: Select between `simple_demo`, `rrc_demo`, and `multi_file_demo`.
- **PER Encoding/Decoding**:
    - **Decode**: Paste Hex -> Get JSON.
    - **Encode**: Write JSON -> Get Hex.
- **Validation**: Constraints (Size, Range) are enforced. Errors are displayed in the UI.
- **Example Loader**: Auto-fill valid JSON for testing (choose `<Type> (Valid Demo)`).
- **Error Demos**: Pick the `<Type> (Error Demo)` option to insert a payload that violates constraints and see validation errors.

## ASN DAO Metadata API
- `GET /api/asn/protocols/metadata`: returns the precompiled ASN_DAO for every protocol, including the list of source files (relative to `asn_specs/`) and available type names.
- Metadata powers downstream flows where users select one or more prebuilt specs for encode/decode operations.

## Example Data
**Protocol**: `simple_demo`
**Type**: `Person`

**Valid Hex**: `8200416c6963653c` (Alice, 30)

**Valid JSON**:
```json
{
  "name": "Alice",
  "age": 30,
  "isAlive": true
}
```

**Protocol**: `multi_file_demo`
**Type**: `SessionStart`

**Valid Hex**: `0092000148454c4c4f964578616d706c652073657373696f6e207061796c6f6164`

**Valid JSON**:
```json
{
  "subscriber": {
    "mcc": 246,
    "mnc": 1,
    "msin": "0x48454c4c4f"
  },
  "requested": "serviceRequest",
  "payload": "0x4578616d706c652073657373696f6e207061796c6f6164"
}
```
