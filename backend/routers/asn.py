from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, Tuple
from backend.core.manager import manager
import asn1tools

CHOICE_META_KEYS = {"value", "$choice", "choice"}  # Keys used for CHOICE encoding


def _extract_choice(data: Dict[str, Any]) -> Optional[Tuple[str, Any]]:
    """
    Attempt to interpret a dict as an ASN.1 CHOICE value.
    Accepts multiple notations:
      - {"$choice": "randomValue", "value": ...}
      - {"choice": "randomValue", "value": ...}
      - {"": "randomValue", "value": ...}    (what the current UI sends)
      - {"randomValue": ... }                (single-key implicit CHOICE)
    """
    if "$choice" in data and "value" in data:
        return data["$choice"], data["value"]
    if "choice" in data and "value" in data:
        return data["choice"], data["value"]
    if "value" in data:
        extra_keys = [
            key for key in data.keys() if key not in CHOICE_META_KEYS
        ]
        if len(extra_keys) == 1:
            marker_key = extra_keys[0]
            marker_value = data[marker_key]
            if isinstance(marker_value, str) and marker_value.strip():
                return marker_value, data["value"]
    if len(data) == 1:
        key, value = next(iter(data.items()))
        if isinstance(key, str) and key.strip():
            return key, value
    return None


router = APIRouter()

class DecodeRequest(BaseModel):
    hex_data: str
    protocol: str
    encoding_rule: str = "per"  # per, uper, ber
    type_name: Optional[str] = None

class EncodeRequest(BaseModel):
    protocol: str
    type_name: str
    data: Dict[str, Any]
    encoding_rule: str = "per"

@router.post("/encode")
async def encode_message(request: EncodeRequest):
    compiler = manager.get_compiler(request.protocol)
    if not compiler:
        raise HTTPException(status_code=404, detail=f"Protocol '{request.protocol}' not found")

    try:
        # We need to recursively convert hex strings in JSON back to bytes 
        # because the compiler expects bytes for OCTET STRING / BIT STRING.
        # However, asn1tools might handle hex strings for some fields or fail.
        # A robust approach is to check the schema or try encoding.
        # For MVP, let's assume the input JSON 'data' matches what asn1tools expects,
        # EXCEPT that bytes are represented as hex strings.
        
        print(f"[ENCODE] Raw request data: {request.data}", flush=True)
        prepared_data = deserialize_asn1_data(request.data)
        print(f"[ENCODE] Prepared data: {prepared_data}", flush=True)

        encoded = compiler.encode(
            request.type_name, 
            prepared_data, 
            check_constraints=True
        )
        return {
            "status": "success",
            "protocol": request.protocol,
            "type_name": request.type_name,
            "hex_data": encoded.hex()
        }
    except asn1tools.ConstraintsError as e:
         raise HTTPException(status_code=400, detail=f"Validation Error: {str(e)}")
    except asn1tools.EncodeError as e:
         raise HTTPException(status_code=400, detail=f"Encoding Error: {str(e)}")
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

def deserialize_asn1_data(data):
    """
    Recursively convert hex strings/special formats to bytes/tuples expected by asn1tools.
    
    Formats:
    - Hex Bytes: {"$hex": "deadbeef"} -> b'\xde\xad\xbe\xef'
    - Choice: {"$choice": "optionName", "value": "optionValue"} -> ('optionName', 'optionValue')
    - Bit String Tuple: ["0xdead", 12] -> (b'\xde\xad', 12)
    """
    if isinstance(data, dict):
        # Check for special hex marker
        if "$hex" in data:
            return bytes.fromhex(data["$hex"])
        choice_candidate = _extract_choice(data)
        if choice_candidate:
            choice_name, choice_value = choice_candidate
            return (choice_name, deserialize_asn1_data(choice_value))
        return {k: deserialize_asn1_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        # Support tuple for BIT STRING: [hex_str, bit_len]
        if len(data) == 2 and isinstance(data[0], str) and isinstance(data[1], int):
             if data[0].startswith("0x"):
                 # Important: Ensure we return a tuple, NOT a list. 
                 return (bytes.fromhex(data[0].replace("0x", "")), data[1])
        return [deserialize_asn1_data(v) for v in data]
    elif isinstance(data, str):
        if data.startswith("0x"):
             return bytes.fromhex(data.replace("0x", ""))
    return data

@router.on_event("startup")
async def startup_event():
    manager.load_protocols()

@router.get("/protocols")
async def list_protocols():
    return manager.list_protocols()

@router.get("/protocols/{protocol}/types")
async def list_types(protocol: str):
    compiler = manager.get_compiler(protocol)
    if not compiler:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol}' not found")
    # Return sorted list of type names
    return sorted(list(compiler.types.keys()))

@router.get("/protocols/{protocol}/types/{type_name}")
async def get_type_definition(protocol: str, type_name: str):
    compiler = manager.get_compiler(protocol)
    if not compiler:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol}' not found")
    
    # Get the ASN.1 definition text for this type if possible.
    # asn1tools compiles to internal objects, but we might be able to find the text representation
    # or at least a string representation of the compiled object.
    # compiler.types is a dictionary of name -> Type object.
    
    type_obj = compiler.types.get(type_name)
    if not type_obj:
         raise HTTPException(status_code=404, detail=f"Type '{type_name}' not found")

    # The string representation of the type object is often the ASN.1 definition (roughly)
    return {"definition": str(type_obj)}


@router.post("/debug/normalize")
async def debug_normalize(payload: Dict[str, Any]):
    """Temporary endpoint to inspect how payloads are normalized."""
    return deserialize_asn1_data(payload)

@router.post("/decode")
async def decode_message(request: DecodeRequest):
    compiler = manager.get_compiler(request.protocol)
    if not compiler:
        raise HTTPException(status_code=404, detail=f"Protocol '{request.protocol}' not found")

    try:
        # Remove 0x prefix and whitespace
        clean_hex = request.hex_data.replace("0x", "").replace(" ", "").replace("\n", "")
        data_bytes = bytes.fromhex(clean_hex)
        
        # Attempt to decode. 
        # Note: asn1tools 'decode' usually requires knowing the top-level type 
        # OR it tries to guess if the message is self-delimiting (BER) or if we provide a type name.
        # For PER, we usually need the Type Name.
        # MVP strategy: Try to decode against ALL top-level types in the schema? 
        # Or ask user to specify Type?
        # The user requirement said: "selectable message types".
        # So we probably need to let user pick the type, or list available types.
        # For now, let's try to decode using the first successful type or add a field to request.
        
        # We'll just decode blindly if the tool supports it, or iterate types.
        # asn1tools `decode` takes a `type_name`.
        # Let's assume for MVP we expose a list of types and user picks one, 
        # OR we try to guess (hard for PER).
        
        # Let's iterate over types for now if type not specified (not in request yet).
        # We will update DecodeRequest to include optional 'type_name'.
        
        decoded = None
        decoded_type = "Unknown"
        
        # Get all types
        types = [request.type_name] if request.type_name else compiler.types.keys()
        
        success = False
        last_error = ""
        error_details = []

        for type_name in types:
            try:
                decoded = compiler.decode(type_name, data_bytes, check_constraints=True)
                decoded_type = type_name
                success = True
                break
            except asn1tools.ConstraintsError as e:
                error_msg = f"Constraints Error in '{type_name}': {str(e)}"
                last_error = error_msg
                error_details.append(error_msg)
                continue
            except asn1tools.DecodeError as e:
                error_msg = f"Decode Error in '{type_name}': {str(e)}"
                last_error = error_msg
                error_details.append(error_msg)
                continue
            except Exception as e:
                last_error = str(e)
                error_details.append(f"Error in '{type_name}': {str(e)}")
                continue
        
        if not success:
             # If specific type was requested, fail harder
             if request.type_name:
                 raise HTTPException(status_code=400, detail=last_error)
             
             # Return a summary of errors if blindly trying all types
             raise HTTPException(status_code=400, detail=f"Could not decode. Errors: {'; '.join(error_details[:3])}...")

        # Convert decoded object (which might have bytes) to JSON serializable
        # primitive version of asn1tools decode result is usually dicts and python types.
        # We need a helper to serialize bytes/bytearrays to hex strings for JSON.
        
        return {
            "status": "success",
            "protocol": request.protocol,
            "decoded_type": decoded_type,
            "data": serialize_asn1_data(decoded)
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def serialize_asn1_data(data):
    """Convert asn1tools decoded data to JSON-serializable format."""
    if isinstance(data, dict):
        return {k: serialize_asn1_data(v) for k, v in data.items()}
    elif isinstance(data, tuple):
        # Handle CHOICE tuples: ('choice_name', value)
        # and BIT STRING tuples: (bytes, bit_length)
        if len(data) == 2:
            first, second = data
            if isinstance(first, str):
                # CHOICE: ('choice_name', value)
                return {"$choice": first, "value": serialize_asn1_data(second)}
            elif isinstance(first, (bytes, bytearray)) and isinstance(second, int):
                # BIT STRING: (bytes, bit_length)
                return [f"0x{first.hex()}", second]
        # Generic tuple - convert to list
        return [serialize_asn1_data(v) for v in data]
    elif isinstance(data, list):
        return [serialize_asn1_data(v) for v in data]
    elif isinstance(data, (bytes, bytearray)):
        return data.hex()
    else:
        return data
