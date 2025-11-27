# ASN.1 Stream Processor - MVP

## Prerequisites
- Python 3.10+
- Node.js 18+
- **Build Tools (for C Codegen)**:
    - `make`, `gcc` (or compatible C compiler)
    - `flex`, `bison` (for building `asn1c` from source)
    - Windows users: MSYS2, Git Bash, or WSL is recommended to provide the Unix-like environment for `asn1c`.

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

### 2. Build ASN1C (Optional but required for Codegen)
The project vendors `asn1c` in `sources/asn1c`. To enable C code generation features:

```bash
python scripts/build_asn1c.py
```
This will build the `asn1c` binary and place it in `sources/asn1c/bin/`.

### 3. Frontend
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

## Desktop Application (Electron)

The application can be packaged as a standalone desktop app (EXE on Windows). This bundles the Python backend and the React frontend into a single installer.

### Prerequisites
- Everything listed above.
- `PyInstaller` (installed via `backend/requirements.txt`).
- `electron-builder` (installed via `frontend/npm install`).

### Build Instructions
To build the desktop installer:

```powershell
# From project root
python scripts/build_desktop.py
```

This script performs the following steps:
1.  Builds the React Frontend (`npm run build`).
2.  Bundles the Python Backend into a standalone executable (`PyInstaller`).
3.  Packages everything into an Electron application using `electron-builder`.

**Output**:
- **Installer**: `frontend/release/ASN Processor Setup 0.0.0.exe`
- **Unpacked**: `frontend/release/win-unpacked/`

### Troubleshooting Desktop App
Logs are written to your user profile directory:
- `%USERPROFILE%\AsnProcessorLogs\electron.log` (Frontend/Launcher logs)
- `%USERPROFILE%\AsnProcessorLogs\backend.log` (Python Backend logs)

In the application, press `Ctrl+Shift+I` to open the Developer Tools.

### Service Mode (Configuration)
The desktop application includes a configuration interface (Service Mode):
1. Click the **Settings (Gear)** icon in the header.
2. **ASN Spec Directories**: Add or remove folders containing `.asn` files to dynamically load protocols.
3. **Automatic Reload**: The backend automatically recompiles protocols when the configuration is saved.
4. **Persistence**: Settings are stored in `%APPDATA%\AsnProcessor\config.json` (Windows) or `~/.config/asn_processor/config.json` (Linux/Mac).

## Quality Checks

Run these commands from the project root:

### Tests & Coverage
```bash
python -m pytest --cov=backend/routers --cov=backend/core backend/tests/
```

### Release Verification (Desktop)
To verify the packaged backend executable against integration tests:
```bash
python scripts/test_release.py
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
- **Definition Tree**: Expand the collapsible definition panel to inspect nested ASN.1 constraints when needed.
- **C Code Generation**: Generate C stubs (`asn1c` based) for selected protocols directly from the UI.

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

### Parameterization Demo
`parameterization_demo` exercises patched X.683 support (type + value parameters). A few handy payloads:

```json
{
  "protocol": "parameterization_demo",
  "type_name": "TemplateInteger",
  "data": {
    "id": 42,
    "payload": 1337
  }
}
```

```json
{
  "protocol": "parameterization_demo",
  "type_name": "BoundedBooleanSeq5",
  "data": {
    "samples": [true, false, true]
  }
}
```

> **CHOICE notation:** Use the explicit `{"$choice": "<alternative>", "value": ...}` shape. Implicit single-key CHOICE objects are no longer auto-detected so that single-field SEQUENCE types (common in parameterized constructs) encode correctly.
