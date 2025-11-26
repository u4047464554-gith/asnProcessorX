# ASN.1 Stream Processor - MVP Implementation Plan

## Current Status: ✅ Phase 1 & 2 Complete

---

## 1. Architecture & Tech Stack

### Implemented ✅
*   **Frontend (Web)**:
    *   **Framework**: React 18 + TypeScript + Vite ✅
    *   **UI Library**: Mantine ✅
    *   **State**: React useState (simple for MVP) ✅
    *   **Features**: Tabbed Encode/Decode UI, Protocol/Type selection ✅
*   **Backend (Engine)**:
    *   **Language**: Python 3.10+ ✅
    *   **API Framework**: FastAPI ✅
    *   **ASN.1 Engine**: `asn1tools` with PER codec ✅
    *   **Cross-Platform**: Runs on Win/Mac/Linux ✅
    *   **Quality Tools**: pytest, ruff, mypy ✅

---

## 2. MVP Features - Status

### A. Dynamic Schema Management ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Dynamic Loading | ✅ Done | `AsnManager` loads from `asn_specs/` on startup |
| Protocol Context Selection | ✅ Done | Dropdown in UI |
| Message Type Selection | ✅ Done | Dropdown populated per protocol |
| Type Definition Preview | ✅ Done | Shows ASN.1 definition when type selected |
| Hot Reload (watchdog) | ⏳ Pending | Backend restart required for new specs |

### B. Encoding & Decoding ✅
| Feature | Status | Notes |
|---------|--------|-------|
| PER Decode (Hex → JSON) | ✅ Done | Works with constraint validation |
| PER Encode (JSON → Hex) | ✅ Done | Works with CHOICE, BIT STRING, SEQUENCE |
| Constraint Validation | ✅ Done | SIZE, RANGE constraints enforced |
| Error Display | ✅ Done | Errors shown in red text |
| Example Loader | ✅ Done | Pre-fills valid JSON for demo types |
| CHOICE Type Support | ✅ Done | `{"$choice": "name", "value": ...}` format |
| BIT STRING Support | ✅ Done | `["0xHex", bitLength]` format |

### C. The "Bit-Level" Visualizer ⏳ NOT STARTED
| Feature | Status | Notes |
|---------|--------|-------|
| Custom Decoding Tracer | ⏳ Pending | Track bit cursor during decode |
| Bit Range Mapping | ⏳ Pending | `{value, start_bit, end_bit}` per field |
| Collapsible Tree View | ⏳ Pending | Replace JSON block with tree component |
| Hex/Bin View | ⏳ Pending | Side-by-side hex dump |
| Click-to-Highlight | ⏳ Pending | Tree ↔ Hex interaction |

### D. File Operations ⏳ NOT STARTED
| Feature | Status | Notes |
|---------|--------|-------|
| Save (Hex + JSON) | ⏳ Pending | Export to `.txt` file |
| Load Saved Files | ⏳ Pending | Import `.txt` or `.hex` files |
| Project Mode | ⏳ Pending | Open folder with specs + data |

---

## 3. Completed Implementation

### Phase 1: Project Skeleton & Core Engine ✅
- [x] Setup `/backend` and `/frontend` directories
- [x] Backend API with FastAPI + CORS
- [x] `AsnManager` class for loading `.asn` files
- [x] `POST /api/asn/decode` endpoint
- [x] `POST /api/asn/encode` endpoint
- [x] `GET /api/asn/protocols` endpoint
- [x] `GET /api/asn/protocols/{protocol}/types` endpoint
- [x] `GET /api/asn/protocols/{protocol}/types/{type}` endpoint
- [x] Sample ASN.1 specs: `simple_demo`, `rrc_demo`
- [x] Port conflict detection (`run_server.py`)

### Phase 2: Frontend Foundation ✅
- [x] React + Vite + TypeScript setup
- [x] Mantine UI integration
- [x] Protocol/Type selector dropdowns
- [x] Tabbed interface (Decode / Encode)
- [x] Hex input textarea
- [x] JSON input with validation
- [x] Decoded output display
- [x] Encoded hex output display
- [x] Example loader button
- [x] Error display

---

## 4. Next Steps (Prioritized)

### Phase 3: Advanced Visualization (Bit Mapping)
**Goal**: ASN.1 Studio-like bit-level inspection

1. **Backend: Decoding Tracer**
   - Create `backend/core/tracer.py`
   - Wrap `asn1tools` decode to track bit positions
   - Return structure: `{ field: string, value: any, bits: { start: int, end: int } }`

2. **Frontend: Tree View Component**
   - Create `TreeViewer.tsx` - recursive collapsible tree
   - Each node shows: field name, type, value
   - Click node → emit event with bit range

3. **Frontend: Hex Viewer Component**
   - Create `HexViewer.tsx` - formatted hex dump
   - Highlight bytes/bits based on selection
   - Show offset column

4. **Integration**
   - Sync Tree selection with Hex highlight
   - Bidirectional: click hex → highlight tree node

### Phase 4: File Operations & Polish
1. **Save/Load**
   - Download button: exports `{ hex, decoded, protocol, type }`
   - Upload button: loads saved file, auto-fills fields

2. **Hot Reload for Specs**
   - Use `watchdog` to detect `.asn` file changes
   - Auto-recompile without server restart

3. **UI Polish**
   - Better error highlighting (inline in tree)
   - Loading spinners
   - Keyboard shortcuts

### Phase 5: Extended Codec Support
1. **BER/DER Support** - Add codec selector dropdown
2. **UPER vs PER** - Aligned/Unaligned toggle
3. **More 3GPP Specs** - Add real S1AP, X2AP, NGAP specs

---

## 5. Directory Structure (Current)

```text
/
├── backend/
│   ├── main.py                 # FastAPI entry point ✅
│   ├── run_server.py           # Server launcher with port check ✅
│   ├── core/
│   │   ├── manager.py          # AsnManager - schema loading ✅
│   │   └── tracer.py           # Bit-level tracking (TODO)
│   ├── routers/
│   │   └── asn.py              # API endpoints ✅
│   ├── tests/
│   │   ├── test_api.py         # API tests ✅
│   │   └── test_rrc.py         # RRC-specific tests ✅
│   └── requirements.txt        # Python deps ✅
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main component ✅
│   │   ├── main.tsx            # Entry point ✅
│   │   └── components/         # (TODO: TreeViewer, HexViewer)
│   ├── package.json            # Node deps ✅
│   └── vite.config.ts          # Vite config ✅
├── asn_specs/
│   ├── simple_demo/simple.asn  # Demo protocol ✅
│   └── rrc_demo/rrc.asn        # 3GPP RRC sample ✅
├── pyproject.toml              # Python tool config ✅
└── README.md                   # Setup instructions ✅
```

---

## 6. Quality Checklist

| Check | Command | Status |
|-------|---------|--------|
| Tests Pass | `python -m pytest backend/tests/` | ✅ |
| Coverage | `python -m pytest --cov=backend/` | ⏳ Add more tests |
| Linting | `python -m ruff check backend/` | ✅ |
| Type Check | `python -m mypy backend/` | ✅ |
| Frontend Build | `cd frontend && npm run build` | ✅ |

---

## 7. Demo Scenarios (Working)

### Scenario 1: Simple Person Encode/Decode
1. Select `simple_demo` → `Person`
2. Click "Load Example" → JSON appears
3. Click "Encode" → Hex: `8200416c6963651e`
4. Copy hex to Decode tab → Click "Decode" → JSON restored

### Scenario 2: RRC Connection Request
1. Select `rrc_demo` → `RRCConnectionRequest`
2. Click "Load Example" → Complex JSON with CHOICE/BIT STRING
3. Click "Encode" → Hex generated
4. Decode back → Original structure restored

### Scenario 3: Constraint Violation
1. Select `simple_demo` → `Person`
2. Enter JSON with `age: 150` (exceeds 0..120 constraint)
3. Click "Encode" → Error displayed: constraint violation
