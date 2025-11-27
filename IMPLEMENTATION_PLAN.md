# ASN.1 Stream Processor - MVP Implementation Plan

## Current Status: ✅ Phase 1 & 2 Complete

---

## 1. Architecture & Tech Stack

### Implemented ✅
*   **Frontend (Web)**:
    *   **Framework**: React 18 + TypeScript + Vite ✅
    *   **Platform**: Electron (Desktop App) ✅
    *   **UI Library**: Mantine ✅
    *   **State**: React useState (simple for MVP) ✅
    *   **Features**: Tabbed Encode/Decode UI, Protocol/Type selection, Settings/Config ✅
*   **Backend (Engine)**:
    *   **Language**: Python 3.10+ ✅
    *   **API Framework**: FastAPI ✅
    *   **Packaging**: PyInstaller (Standalone Executable) ✅
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
| Hot Reload (watchdog) | ✅ Done | Manual trigger via Config Update (Service Mode) |

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

### Phase 2.5: C Code Generation (New) ✅
- [x] Vendor `asn1c` sources into `sources/asn1c/repo`
- [x] Create `scripts/build_asn1c.py` build script
- [x] Implement `CodegenService` in backend
- [x] Add `POST /api/asn/codegen` endpoint
- [x] Add UI Modal for generating and downloading C stubs
- [x] Add backend unit tests for codegen service

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

### Phase 6: Desktop Application & Service Mode ✅
1. **Desktop Packaging**
   - Electron Shell + PyInstaller Backend ✅
   - Single Installer (NSIS) ✅
   - Auto-discovery of free ports ✅
2. **Service Mode (Configuration)**
   - Persistent Settings (`config.json`) ✅
   - UI for managing ASN Spec Directories ✅
   - Dynamic Protocol Reloading ✅
3. **Quality Assurance**
   - Release Integration Tests (`test_release.py`) ✅
   - Configuration Unit Tests ✅

---

## 5. Directory Structure (Current)

```text
/
├── backend/
│   ├── main.py                 # FastAPI entry point ✅
│   ├── run_server.py           # Server launcher with port check ✅
│   ├── core/
│   │   ├── manager.py          # AsnManager - schema loading ✅
│   │   ├── codegen.py          # C Code Generator Service ✅
│   │   └── tracer.py           # Bit-level tracking (TODO)
│   ├── routers/
│   │   └── asn.py              # API endpoints ✅
│   ├── tests/
│   │   ├── test_api.py         # API tests ✅
│   │   ├── test_codegen.py     # Codegen tests ✅
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
├── sources/
│   ├── asn1c/                  # Vendored ASN.1 Compiler ✅
│   │   ├── repo/               # Upstream source
│   │   ├── bin/                # Compiled binary
│   │   └── README.md
├── scripts/
│   └── build_asn1c.py          # Build helper script ✅
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

---

## 8. X.683 Parameterization Workstream

### 8.1 Requirements Recap
- **Scope**: Support X.683 parameterization in three passes—formal type parameters (1a), value parameters (1b), and Information Object Classes/sets (1c).
- **Use cases**: Multi-module specs (e.g., 3GPP RRC) that rely on parameterized SEQUENCE/CHOICE definitions, nested parameterized types, and constraints driven by passed values.
- **Deliverables**: Parser/loader extensions, runtime resolution during encode/decode, regression specs & tests, and UX surface updates so users can target parameterized definitions confidently.

### 8.2 Research Findings
- **Spec highlights**: X.683 defines (a) declaration syntax (`Type { T } ::= ...`), (b) actual parameter binding `Foo { INTEGER }`, (c) propagation rules when parameterized types themselves reference other parameterized types, and (d) dual value+type parameters influencing constraints.
- **asn1tools baseline**: Upstream already parses parameterized definitions (see `parser.convert_parameterized_*`) and partially rewrites them in `asn1tools/codecs/compiler.py` via `pre_process_parameterization_step_1/2`. However, the current release strips parameterized type descriptors after compilation, meaning tooling such as our manager/tracer cannot expose parameter metadata or accept actual parameters at runtime.
- **Gap for ASN Processor**:
  - No API surface to select instantiated parameterized types (UI only lists fully resolved names).
  - Serialization helpers do not understand parameter scope when converting JSON↔PER.
  - Tracer lacks awareness of substituted definitions, so bit-level introspection cannot report bound parameters.

### 8.3 Design Direction
1. **Metadata Capture**  
   - Extend `AsnManager` to store parameter signatures (`parameters`, `actual-parameters`) before `asn1tools` removes them (hook into compilation via `pre_process_parameterization_step_*` or a preprocessing mirror in `backend/core/manager.py`).
   - Persist enriched descriptors in `ProtocolMetadata` so the frontend can show which types remain template-like and what arguments they expect.
2. **Resolution Pipeline**  
   - Introduce a resolver utility that, given a type reference plus actual parameters, clones the compiler’s descriptor, substitutes dummy parameters (mirroring `pre_process_parameterization_step_1_dummy_to_actual_type`), and produces a concrete type for encode/decode.
   - Ensure resolver can operate recursively for nested parameterized references and can substitute: member types, element types, `SIZE`, `WITH COMPONENTS`, and `restricted-to` ranges.
3. **Serialization & Validation**  
   - `deserialize_asn1_data`/`serialize_asn1_data` stay mostly intact; however, resolution must happen before calling `asn1tools.encode/decode`, and any validation errors should reference instantiated names (e.g., `B { BOOLEAN, INTEGER }`).
   - CHOICE normalization now requires the explicit `{"$choice": "...", "value": ...}` wrapper to avoid colliding with single-field SEQUENCEs that appear frequently in parameterized templates.
4. **Tracing Integration**  
   - Propagate resolved descriptors into `TraceService` to preserve human-friendly node labels and to display actual parameters alongside type names for clarity.
5. **Testing Assets**  
   - Craft specs under `asn_specs/multi_file_demo/parameterization_demo/` covering:
     * Type-only substitution (Phase 2).
     * Value-driven constraints for Phase 3.
     * IOC adoption (Phase 4, optional).
   - Mirror upstream fixtures (see `sources/asn1tools/tests/files/parameterization.asn`) to keep parity with asn1tools behavior and guard against regressions.

### 8.4 Work Breakdown (mirrors execution plan)
1. **Phase 1 – Research & Design (✅ ongoing now)**  
   - Capture spec interpretation (this section) and pinpoint touch-points inside `backend/core/*`.
2. **Phase 2 – Type Parameterization**  
   - Parser/manager metadata, resolver core, encode/decode plumbing, tests.
3. **Phase 3 – Value Parameters**  
   - Extend resolver to propagate actual values into constraints/SIZE ranges; add JSON schema hints so UI can prompt for required values.
4. **Phase 4 – IOC Parameters**  
   - If customer specs rely on parameterized object classes, derive requirements from `x683.asn` fixture and repeat the resolver pattern.
5. **Docs & Samples**  
   - Update README with usage instructions, provide CLI/REST examples, and keep sample specs + expected outputs version-controlled for reproducibility.

### 8.5 IOC Parameterization Assessment
- X.683 object class/set parameterization remains rare in the customer-provided specs; the new `parameterization_demo` plus 3GPP samples cover only type/value parameters.
- The vendored `asn1tools` parser already exposes hooks (`convert_parameterized_object_*`); we hardened it against malformed tokens so mixed modules at least parse cleanly.
- Implementing full IOC binding would require extending `codecs/compiler.py` with resolution logic similar to `pre_process_parameterization_step_1_dummy_to_actual_type`, plus new regression specs (see `sources/asn1tools/tests/files/x683.asn` for the canonical fixture).
- Action: defer full IOC substitution until we have a spec that exercises it—current sprint delivers the necessary groundwork (parser stability, vendor override, test scaffolding) so we can add it incrementally.
