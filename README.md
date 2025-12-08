# ASN.1 Processor

A comprehensive toolkit for working with ASN.1 specifications (PER encoding rules). 
This application allows you to encode/decode messages, visualize bit streams, and manage ASN.1 schemas dynamically.

It provides three modes of operation:
1.  **Desktop Application**: A standalone Windows application (Electron + Python) for end-users.
2.  **Web Application**: A browser-based interface for development.
3.  **Backend Service**: A REST API for integration with other tools.

## Features
- **PER Encoding/Decoding**:
    - **Decode**: Paste Hex (raw or 0x formatted) -> Get JSON.
    - **Encode**: Write JSON -> Get Hex.
    - **Auto-Conversion**: Changes are reflected immediately (bidirectional sync).
- **Bit Inspector**: Visualize how each bit in the stream maps to the ASN.1 structure.
- **0x Hex Support**: View and edit payloads in C-style byte array format (0xAA, 0xBB) alongside raw Hex.
- **Dynamic Schema Loading**: Place `.asn` files in `asn_specs/` or configure directories in the app.
- **Multi-File Protocols**: Support for complex schemas split across multiple files (e.g. `common.asn`, `main.asn`).
- **Validation**: Constraints (Size, Range) are enforced with detailed diagnostic messages.
- **Example Loader**: Pre-loaded valid and error examples for testing.
- **Definition Tree**: Inspect the structure of loaded ASN.1 types.
- **C Code Generation**: Generate C stubs (`asn1c` based) for selected protocols (requires `asn1c` installed).
- **Service Mode**: The application can act as a configurable server/monitor for the ASN.1 processing engine.


## Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)**: Detailed system architecture, data flow diagrams, and design decisions
- **[API Reference](API.md)**: Full REST API documentation
- **[Development Workflows](WORKFLOWS.md)**: TDD practices, testing guidelines, and release process

## Quick Start (Web App - For Testing/Development)

**No development experience required!** Just download and run:

### Windows
1. Download or clone this repository
2. Double-click `RUN_WEBAPP.bat`
3. Wait for the browser to open automatically
4. Start using the app at http://localhost:5173

### Linux/Mac
1. Download or clone this repository
2. Make the script executable: `chmod +x RUN_WEBAPP.sh`
3. Run: `./RUN_WEBAPP.sh`
4. Open http://localhost:5173 in your browser

**What it does:**
- ✅ Checks if Python and Node.js are installed
- ✅ Creates virtual environment automatically
- ✅ Installs all dependencies
- ✅ Starts backend and frontend servers
- ✅ Opens the app in your browser

**First run takes 2-3 minutes** (installing dependencies). Subsequent runs are instant!

To stop: Press `Ctrl+C` in the terminal window.

## Quick Start (Desktop App - For Production Use)

Download the latest installer from the [Releases Page](https://github.com/u4047464554-gith/asnProcessorX/releases).

1.  Run `ASN Processor Setup <version>.exe`.
2.  Use the **Settings (Gear Icon)** to add your own folders containing `.asn` specs.
3.  Select a protocol and type to start testing.

**Note on C Codegen**: The "Generate C Stubs" feature requires the `asn1c` binary to be installed on your system and available in the system PATH. If missing, you will see a 503 error message.

## User Guide

### 1. Basic Operation
- **Select Protocol**: Use the top-left dropdown to choose the ASN.1 protocol (e.g., `rrc_demo`).
- **Select Message Type**: Choose the specific message you want to work with (e.g., `RRCConnectionRequest`).
- **View Definition**: The "Definition Tree" panel shows the structure of the selected type.

### 2. Decoding (Hex to JSON)
1.  Paste your Hex string into the **Hex Input** box (e.g., `8005...`).
2.  The **JSON Input** box will automatically update with the decoded structure.
3.  The **Bit Inspector** (right panel) will visualize how the bits map to the fields.

### 3. Encoding (JSON to Hex)
1.  Edit the JSON in the **JSON Input** box. You can use the "Structured" editor for a form-based view or "Raw" for direct text editing.
2.  The **Hex Input** box will automatically update with the re-encoded binary data.

### 4. Editing Schemas
1.  Click **Edit Schema** in the top bar.
2.  Select a file from the left list.
3.  Make changes to the ASN.1 definition.
4.  Click **Save** to apply changes (triggers a hot reload) or **Snapshot** to save a backup.

## Development Setup

### Prerequisites

**Required:**
- **Python 3.10+** (3.13 recommended)
- **Node.js 18+** (20 LTS recommended)
- **npm** (comes with Node.js)
- **Git** (for version control)

**Optional (for full functionality):**
- **asn1c** - For C code generation feature
- **MSYS2** or **WSL** (Windows only) - For building C code
- **PyInstaller** - For building standalone backend executable (auto-installed)

### 1. Clone and Initial Setup

```bash
# Clone the repository
git clone https://github.com/u4047464554-gith/asnProcessorX.git
cd asnProcessorX

# Install root dependencies
npm install
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (CMD):
.venv\Scripts\activate.bat
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi; import pydantic; print('Backend dependencies OK')"
```

### 3. Frontend Setup

```bash
cd frontend  # from repo root

# Install dependencies
npm install

# Verify installation
npm list --depth=0
```

### 4. Running in Development Mode

#### Option A: Using npm scripts (from repo root)

```bash
# Terminal 1: Start backend server
npm run dev:backend

# Terminal 2: Start frontend dev server  
npm run dev

# Access web app at http://localhost:5173
# API docs at http://localhost:8000/docs
```

#### Option B: Manual start

```bash
# Terminal 1: Backend
cd backend
# Activate venv first (.venv\Scripts\Activate.ps1 or source .venv/bin/activate)
python run_server.py
# Server runs on http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm run dev
# Dev server runs on http://localhost:5173
```

### 5. Running Tests

#### Full Test Suite
```bash
# From repo root - runs all tests
python scripts/verify_all.py
```

#### Backend Tests Only
```bash
# Unit and integration tests
python -m pytest backend -v

# With coverage report
python -m pytest backend --cov=backend --cov-report=html

# Specific test file
python -m pytest backend/tests/test_api.py -v
```

#### Frontend Tests Only
```bash
cd frontend

# Run tests
npm run test

# Watch mode (for development)
npm run test:watch

# With coverage
npm run test:coverage
```

#### End-to-End Tests
```bash
# From repo root
npm run test:e2e

# With UI (debugging)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed
```

### 6. Code Quality Checks

```bash
# Python linting (from backend/)
python -m ruff check backend/
python -m ruff check backend/ --fix  # Auto-fix

# Type checking
python -m mypy backend --ignore-missing-imports

# Frontend linting
cd frontend
npm run lint
```

## Building the Desktop Application

### Complete Build (Recommended)

This builds both the backend executable and Electron app:

```bash
# From repo root
python scripts/build_desktop.py
```

**What this does:**
1. ✅ Builds frontend (TypeScript → JavaScript, Vite bundling)
2. ✅ Builds backend into standalone `.exe` (PyInstaller)
3. ✅ Packages everything into Electron installer

**Output:** 
- `frontend/release/ASN Processor Setup 0.3.0.exe` (Windows installer)
- `backend/dist/asn_backend.exe` (Standalone backend)

**Build time:** ~3-5 minutes (depending on system)

### Frontend-Only Build

For development builds without backend:

```bash
cd frontend
npm run build

# Build output in: frontend/dist/
```

### Electron-Only Packaging

If you already have a backend .exe:

```bash
cd frontend
npm run electron:build

# Output: frontend/release/
```

### Build Verification

After building, test the installer:

```bash
# Install the application
frontend\release\ASN Processor Setup 0.3.0.exe

# Or run the portable backend directly
backend\dist\asn_backend.exe
```

## Troubleshooting

### Build Issues

**"PyInstaller not found"**
```bash
pip install pyinstaller
```

**"electron-builder failed"**
```bash
cd frontend
npm install --save-dev electron electron-builder
```

**"Cannot find backend executable"**
- Ensure backend build completed: `backend/dist/asn_backend.exe` should exist
- Re-run: `python scripts/build_desktop.py`

### Runtime Issues

**"Module not found" errors**
```bash
# Reinstall dependencies
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

**"Port 8000 already in use"**
```bash
# Find and kill process on Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Or change port in backend/run_server.py
```

**Frontend can't connect to backend**
- Verify backend is running: http://localhost:8000/health
- Check CORS settings in `backend/main.py`
- Verify frontend API URL in `.env` or `vite.config.ts`

## Project Structure

```
asnProcessorX/
├── backend/              # FastAPI backend
│   ├── routers/         # API endpoints
│   ├── core/            # Core ASN.1 engine
│   ├── domain/          # Business logic
│   ├── infrastructure/  # External services
│   ├── tests/           # Backend tests
│   └── run_server.py    # Dev server entry point
├── frontend/            # React + Vite frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API clients
│   │   └── pages/       # Page components
│   ├── electron/        # Electron main process
│   └── dist/            # Build output
├── scripts/             # Build and utility scripts
│   ├── build_desktop.py # Main build script
│   ├── verify_all.py    # Test runner
│   └── test_release.py  # Release verification
├── e2e/                 # Playwright E2E tests
├── docs/                # Documentation
│   └── ARCHITECTURE.md  # System architecture
├── WORKFLOWS.md         # Development workflows
└── README.md            # This file
```

## Release Process

See [WORKFLOWS.md](WORKFLOWS.md) for detailed release procedures.

**Quick release checklist:**
1. ✅ Run full tests: `python scripts/verify_all.py`
2. ✅ Update version in `backend/version.py` and `frontend/package.json`
3. ✅ Build desktop app: `python scripts/build_desktop.py`
4. ✅ Test installer manually
5. ✅ Commit and tag: `git tag -a v0.3.0 -m "Release 0.3.0"`
6. ✅ Push: `git push origin main --tags`

**Output**: `frontend/release/ASN Processor Setup <version>.exe`

## Configuration (Service Mode)

The backend service is configurable via the API or the Desktop App UI.
- **Persistence**: Settings are stored in `%APPDATA%\AsnProcessor\config.json` (Windows) or `~/.config/asn_processor/config.json` (Linux/Mac).
- **API**: 
    - `GET /api/config/`: Retrieve current config.
    - `PUT /api/config/`: Update config (triggering a hot reload of schemas).

## Custom Protocols & Examples

You can add your own ASN.1 specifications by adding the folder path in the **Settings** menu.

### Adding Custom Examples
To make example messages appear in the "Load Example" dropdown for your custom protocol:
1.  Create a `.json` file in the same folder as your `.asn` files.
2.  Name the file exactly as the **Type Name** it corresponds to (e.g., `MyMessage.json` for type `MyMessage`).
3.  The file should contain a valid JSON representation of the message.

Example structure:
```
/my_protocols/
  /proto_v1/
    main.asn
    MyMessage.json  <- Will be loaded as "MyMessage (Custom Example)"
```

## API Integration (FastAPI)

The backend exposes a robust REST API (powered by **FastAPI**) that allows external tools to integrate with the ASN.1 engine over HTTP/IP. This enables workflows where other applications (e.g., log analyzers, test runners) offload ASN.1 processing to this service.

### Key Use Case: Hex -> JSON Decoding
Tools that capture binary streams can use this API to decode messages programmatically.

**Endpoint**: `POST /api/asn/decode`

**Request**:
```json
{
  "hex_data": "400092000148454c4c4f80",
  "protocol": "multi_file_demo",
  "type_name": "SessionStart",
  "encoding_rule": "per"
}
```

**Response**:
```json
{
  "status": "success",
  "decoded": {
    "subscriber": { "mcc": 246, "mnc": 1 },
    "payload": "0x48454c4c4f"
  }
}
```

Full interactive documentation (Swagger UI) is available at `http://localhost:8000/docs` when the service is running. See `API.md` for detailed endpoint references.

## Quality Checks

Run these commands from the project root:

### Tests
```bash
python -m pytest --cov=backend/routers --cov=backend/core backend/tests/
```

### Release Verification
To verify the packaged backend executable against integration tests:
```bash
python scripts/test_release.py
```

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

> **CHOICE notation:** Use the explicit `{"$choice": "<alternative>", "value": ...}` shape.
