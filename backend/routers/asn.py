from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Any, Dict, Optional, List
import os

from backend.core.asn1_runtime import asn1tools

from backend.core.manager import manager
from backend.core.serialization import deserialize_asn1_data, serialize_asn1_data
from backend.core.tracer import TraceService
from backend.core.type_tree import build_type_tree
from backend.core.codegen import CodegenService


router = APIRouter()
trace_service = TraceService(manager)
codegen_service = CodegenService(manager)

class DecodeRequest(BaseModel):
    hex_data: str
    protocol: str
    encoding_rule: str = "per"  # per, uper, ber
    type_name: Optional[str] = None

class EncodeRequest(BaseModel):
    protocol: str
    type_name: str
    data: Any
    encoding_rule: str = "per"


class TraceRequest(BaseModel):
    hex_data: str
    protocol: str
    type_name: str
    encoding_rule: str = "per"

class CodegenRequest(BaseModel):
    protocol: str
    types: List[str] = []
    options: Optional[Dict[str, Any]] = None

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
         # User requirement: Return 200 with diagnostic info, not 400
         return {
             "status": "failure",
             "protocol": request.protocol,
             "type_name": request.type_name,
             "error": f"Validation Error: {str(e)}",
             "diagnostics": str(e)
         }
    except asn1tools.EncodeError as e:
         return {
             "status": "failure",
             "protocol": request.protocol,
             "type_name": request.type_name,
             "error": f"Encoding Error: {str(e)}",
             "diagnostics": str(e)
         }
    except Exception as e:
         # Internal errors (bug in code) are still 500, but if it's a data issue we might want to handle it?
         # Let's keep 500 for unexpected server crashes.
         raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

@router.get("/protocols")
async def list_protocols():
    return manager.list_protocols()

@router.get("/protocols/metadata")
async def list_protocol_metadata():
    return manager.list_metadata()

@router.get("/protocols/{protocol}/types")
async def list_types(protocol: str):
    metadata = manager.get_protocol_metadata(protocol)
    if not metadata:
        raise HTTPException(status_code=404, detail=f"Protocol '{protocol}' not found")
    return metadata["types"]

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

    return {
        "definition": str(type_obj),
        "tree": build_type_tree(type_obj),
    }


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
             # If specific type was requested, return failure object
             if request.type_name:
                 return {
                     "status": "failure",
                     "protocol": request.protocol,
                     "decoded_type": request.type_name,
                     "error": last_error,
                     "diagnostics": last_error
                 }
             
             # Return a summary of errors if blindly trying all types
             return {
                 "status": "failure",
                 "protocol": request.protocol,
                 "decoded_type": "Unknown",
                 "error": "Could not decode against any type.",
                 "diagnostics": f"Errors: {'; '.join(error_details[:3])}..."
             }

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


@router.post("/trace")
async def trace_message(request: TraceRequest):
    if request.encoding_rule.lower() != "per":
        raise HTTPException(status_code=400, detail="Tracing currently supports PER only.")

    try:
        result = trace_service.trace(request.protocol, request.type_name, request.hex_data)
    except ValueError as exc:
        # Hex format error or similar - arguably user error, but consistent with 'diagnostics' approach
        # we can return it as failure.
        return {
            "status": "failure",
            "protocol": request.protocol,
            "type_name": request.type_name,
            "error": str(exc),
            "diagnostics": str(exc)
        }
    except asn1tools.ConstraintsError as exc:
        return {
            "status": "failure",
            "protocol": request.protocol,
            "type_name": request.type_name,
            "error": f"Validation Error: {str(exc)}",
            "diagnostics": str(exc)
        }
    except asn1tools.DecodeError as exc:
        return {
            "status": "failure",
            "protocol": request.protocol,
            "type_name": request.type_name,
            "error": f"Decode Error: {str(exc)}",
            "diagnostics": str(exc)
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(exc)}")

    return {
        "status": "success",
        "protocol": result.protocol,
        "type_name": result.type_name,
        "decoded": serialize_asn1_data(result.decoded),
        "trace": result.root.to_dict(),
        "total_bits": result.total_bits,
    }

@router.post("/codegen")
async def generate_code(request: CodegenRequest):
    try:
        zip_path = codegen_service.generate_c_stubs(
            protocol=request.protocol,
            types=request.types,
            options=request.options
        )
        filename = os.path.basename(zip_path)
        return FileResponse(
            path=zip_path, 
            filename=filename, 
            media_type='application/zip',
            background=None # TODO: Add background task to delete file
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
         # Missing dependency (asn1c)
         raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
         raise HTTPException(status_code=500, detail=str(e))
