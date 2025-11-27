from typing import Any
from backend.core.serialization import deserialize_asn1_data

def _get_members(type_obj: Any) -> list:
    """Helper to retrieve members from different asn1tools internal structures."""
    if hasattr(type_obj, "root_members") and type_obj.root_members:
        return type_obj.root_members
    if hasattr(type_obj, "root_index_to_member") and type_obj.root_index_to_member:
        # Sort by index to ensure deterministic order, though not strictly required for lookup
        return [type_obj.root_index_to_member[i] for i in sorted(type_obj.root_index_to_member.keys())]
    # Handle additions (extensions) if necessary?
    # additions_index_to_member might be present.
    # But for CHOICE conversion we just need to find *a* match.
    all_members = []
    if hasattr(type_obj, "additions_index_to_member") and type_obj.additions_index_to_member:
         all_members.extend(type_obj.additions_index_to_member.values())
    return all_members

def convert_to_python_asn1(data: Any, type_obj: Any) -> Any:
    """
    Recursively convert JSON-compatible data to Python ASN.1 native types (e.g. Tuples for CHOICE),
    guided by the asn1tools compiled type definition.
    """
    # Handle wrapper objects if present (e.g. Member wrappers)
    real_type = getattr(type_obj, "_type", type_obj)
    
    # If still same, might be because it doesn't have _type. 
    # Check class name.
    type_cls = type(real_type).__name__

    # Handle Choice: Convert { key: val } -> (key, val)
    if type_cls == 'Choice':
        if isinstance(data, dict):
            # Iterate over known members to find the matching key in data
            members = _get_members(real_type)
            for member in members:
                if member.name in data:
                    val = data[member.name]
                    # Recurse for the value
                    converted_val = convert_to_python_asn1(val, member)
                    return (member.name, converted_val)
            
            # If not found in root_members, check if it's extension?
            # Or if data has keys like 'choice', '$choice' which deserialize_asn1_data handles.
            # But structured editor uses member names.
            pass
        
        # If tuple already, recurse on value?
        if isinstance(data, (tuple, list)) and len(data) == 2:
             # Assume (key, val)
             return (data[0], convert_to_python_asn1(data[1], real_type)) # Hard to know which member without key lookup?
             # Actually if it's tuple, we assume it's already close to native.
             pass

    # Handle Sequence / Set
    if type_cls in ('Sequence', 'Set'):
        if isinstance(data, dict):
            converted = {}
            members = _get_members(real_type)
            for member in members:
                if member.name in data:
                    converted[member.name] = convert_to_python_asn1(data[member.name], member)
            
            # Preserve keys that are not in members (extensions or errors?)
            # Better to only include known members to avoid unexpected args to encoder?
            # But extensions are important.
            # Let's include extra keys too, just processed with generic deserializer
            for k, v in data.items():
                if k not in converted:
                    converted[k] = deserialize_asn1_data(v)
            return converted

    # Handle SequenceOf / SetOf
    if type_cls in ('SequenceOf', 'SetOf'):
        if isinstance(data, list):
            element_type = getattr(real_type, "element_type", None)
            if element_type:
                return [convert_to_python_asn1(item, element_type) for item in data]
    
    # Handle OctetString
    if type_cls == 'OctetString':
        val = data
        if isinstance(data, (list, tuple)) and len(data) >= 1:
            val = data[0]
        
        if isinstance(val, str):
            clean_hex = val.replace("0x", "").replace(" ", "").replace("\n", "")
            # Handle odd length by padding
            if len(clean_hex) % 2 != 0:
                clean_hex += "0"
            try:
                return bytes.fromhex(clean_hex)
            except ValueError:
                pass 

    # Handle BitString
    if type_cls == 'BitString':
        hex_str = None
        bit_len = None
        
        if isinstance(data, (list, tuple)) and len(data) >= 2:
            hex_str = data[0]
            bit_len = int(data[1])
        elif isinstance(data, str):
            hex_str = data
            
        if isinstance(hex_str, str):
            clean_hex = hex_str.replace("0x", "").replace(" ", "").replace("\n", "")
            if len(clean_hex) % 2 != 0:
                clean_hex += "0"
            
            try:
                b = bytes.fromhex(clean_hex)
                if bit_len is None:
                    bit_len = len(b) * 8
                return (b, bit_len)
            except ValueError:
                pass

    # Handle primitives and fallback
    return deserialize_asn1_data(data)

