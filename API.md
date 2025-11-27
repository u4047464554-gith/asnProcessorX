# ASN.1 Processor Backend API

The backend exposes a RESTful API for ASN.1 operations. It is built with FastAPI and supports dynamic protocol loading, PER encoding/decoding, message tracing, and code generation.

## Base URL
- **Development**: `http://localhost:8000`
- **Desktop App**: Dynamic ephemeral port (typically `http://127.0.0.1:<port>`). The app frontend discovers this port on startup.

## Endpoints

### 1. Protocol Management

#### List Protocols
Returns a list of available protocols (folders in `asn_specs/`).

- **GET** `/api/asn/protocols`
- **Response**: `List[str]`
  ```json
  ["simple_demo", "rrc_demo", "multi_file_demo", "parameterization_demo"]
  ```

#### List Protocol Metadata
Returns detailed metadata for all protocols, including source files and available top-level types.

- **GET** `/api/asn/protocols/metadata`
- **Response**: `List[ProtocolMetadata]`
  ```json
  [
    {
      "name": "simple_demo",
      "files": ["simple_demo/simple.asn"],
      "types": ["Person", "Direction", "MyMessage", "StatusCode"]
    },
    ...
  ]
  ```

#### List Types for Protocol
Returns just the list of type names for a specific protocol.

- **GET** `/api/asn/protocols/{protocol}/types`
- **Response**: `List[str]`

#### Get Type Definition
Returns the compiled definition string and a structural tree for a specific type. Useful for inspecting constraints.

- **GET** `/api/asn/protocols/{protocol}/types/{type_name}`
- **Response**:
  ```json
  {
    "definition": "Sequence(name='Person', members=[...])",
    "tree": {
      "name": "Person",
      "type": "SEQUENCE",
      "children": [
        { "name": "name", "type": "IA5String", "constraints": [...] },
        ...
      ]
    }
  }
  ```

---

### 2. Encoding & Decoding (PER)

#### Decode (Hex -> JSON)
Decodes a hexadecimal PER string into a JSON-serializable object.

- **POST** `/api/asn/decode`
- **Request**:
  ```json
  {
    "protocol": "simple_demo",
    "type_name": "Person",
    "hex_data": "8200416c6963653c",
    "encoding_rule": "per"
  }
  ```
  *Note: `type_name` is optional if the codec can auto-detect (e.g. BER), but required for PER.*

- **Response**:
  ```json
  {
    "status": "success",
    "protocol": "simple_demo",
    "decoded_type": "Person",
    "data": {
      "name": "Alice",
      "age": 30,
      "isAlive": true
    }
  }
  ```

#### Encode (JSON -> Hex)
Encodes a JSON object into a hexadecimal PER string.

- **POST** `/api/asn/encode`
- **Request**:
  ```json
  {
    "protocol": "simple_demo",
    "type_name": "Person",
    "data": {
      "name": "Alice",
      "age": 30,
      "isAlive": true
    },
    "encoding_rule": "per"
  }
  ```

- **Response**:
  ```json
  {
    "status": "success",
    "protocol": "simple_demo",
    "type_name": "Person",
    "hex_data": "8200416c6963653c"
  }
  ```

#### Trace Message
Decodes a message and returns a bit-level trace, mapping specific bits in the input to fields in the ASN.1 structure. Useful for debugging encoding issues.

- **POST** `/api/asn/trace`
- **Request**: Same as Decode.
  ```json
  {
    "protocol": "simple_demo",
    "type_name": "Person",
    "hex_data": "8200416c6963653c",
    "encoding_rule": "per"
  }
  ```

- **Response**:
  ```json
  {
    "status": "success",
    "decoded": { ... },
    "trace": {
      "name": "Person",
      "type": "SEQUENCE",
      "bit_offset": 0,
      "bit_length": 64,
      "children": [
        { "name": "name", "bit_offset": 0, "bit_length": 48, "value": "Alice" },
        { "name": "age", "bit_offset": 48, "bit_length": 8, "value": 30 },
        ...
      ]
    },
    "total_bits": 64
  }
  ```

---

### 3. Code Generation

#### Generate C Stubs
Generates C source code (`.c`, `.h`) for the specified protocol using `asn1c`. Returns a ZIP file containing the generated code and necessary skeletons.

- **POST** `/api/asn/codegen`
- **Request**:
  ```json
  {
    "protocol": "simple_demo",
    "types": ["Person"], 
    "options": {
      "compound-names": true
    }
  }
  ```
  *Note: `types` list is optional; if omitted, generates code for the entire module.*

- **Response**: Binary ZIP file download.

---

### 4. System

#### Health Check
- **GET** `/health`
- **Response**: `{"status": "ok", "version": "..."}`

## Data Formats

### JSON Representation of ASN.1 Types
- **BIT STRING**: Represented as a tuple/array: `["0xHEXSTRING", bit_length]`.
  - Example: `["0x80", 1]` represents a single bit `1`.
- **OCTET STRING**: Represented as a hex string prefixed with `0x`.
  - Example: `"0x010203"`
- **CHOICE**: Explicit format preferred:
  ```json
  {
    "$choice": "alternativeName",
    "value": ...
  }
  ```
- **SEQUENCE**: Standard JSON Object.
- **SEQUENCE OF / SET OF**: Standard JSON Array.
- **ENUMERATED**: String value of the enum label.




