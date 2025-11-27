# ASN.1 Processor

A comprehensive toolkit for working with ASN.1 specifications (PER encoding rules). 
This application allows you to encode/decode messages, visualize bit streams, and manage ASN.1 schemas dynamically.

It provides three modes of operation:
1.  **Desktop Application**: A standalone Windows application (Electron + Python) for end-users.
2.  **Web Application**: A browser-based interface for development.
3.  **Backend Service**: A REST API for integration with other tools.

## Features
- **PER Encoding/Decoding**:
    - **Decode**: Paste Hex/Base64 -> Get JSON.
    - **Encode**: Write JSON -> Get Hex/Base64.
    - **Auto-Conversion**: Changes are reflected immediately (bidirectional sync).
- **Bit Inspector**: Visualize how each bit in the stream maps to the ASN.1 structure.
- **Base64 Support**: View and edit payloads in Base64 format alongside Hex.
- **Dynamic Schema Loading**: Place `.asn` files in `asn_specs/` or configure directories in the app.
- **Multi-File Protocols**: Support for complex schemas split across multiple files (e.g. `common.asn`, `main.asn`).
- **Validation**: Constraints (Size, Range) are enforced with detailed diagnostic messages.
- **Example Loader**: Pre-loaded valid and error examples for testing.
- **Definition Tree**: Inspect the structure of loaded ASN.1 types.
- **C Code Generation**: Generate C stubs (`asn1c` based) for selected protocols (requires `asn1c` installed).
- **Service Mode**: The application can act as a configurable server/monitor for the ASN.1 processing engine.

## Quick Start (Desktop App)

Download the latest installer from the [Releases Page](https://github.com/u4047464554-gith/asnProcessorX/releases).

1.  Run `ASN Processor Setup <version>.exe`.
2.  Use the **Settings (Gear Icon)** to add your own folders containing `.asn` specs.
3.  Select a protocol and type to start testing.

**Note on C Codegen**: The "Generate C Stubs" feature requires the `asn1c` binary to be installed on your system and available in the system PATH. If missing, you will see a 503 error message.

## Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- **Build Tools (for C Codegen)**: `make`, `gcc` (or MSYS2/WSL on Windows).

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

### 3. Running in Dev Mode
Start the backend and frontend servers:

```bash
# Terminal 1 (Backend)
python backend/run_server.py

# Terminal 2 (Frontend)
cd frontend
npm run dev
```
Access the web app at `http://localhost:5173`.

## Building the Desktop App

To package the application as a standalone installer:

```powershell
python scripts/build_desktop.py
```

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

## API Documentation

The backend exposes a REST API documented in `API.md`. 
When running the backend, visit `http://localhost:8000/docs` for the interactive Swagger UI.

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
