from __future__ import annotations

from typing import Any, Dict, List, Optional, Set


def build_type_tree(compiled_type: Any) -> Dict[str, Any]:
    """
    Convert an asn1tools compiled type into a JSON-serialisable tree that
    the frontend can render as a collapsible structure.
    """
    type_obj = getattr(compiled_type, "_type", compiled_type)
    return _describe_type(type_obj, set())


def _describe_type(type_obj: Any, visited: Set[int]) -> Dict[str, Any]:
    type_cls = type(type_obj).__name__
    node: Dict[str, Any] = {
        "name": getattr(type_obj, "name", None),
        "type": getattr(type_obj, "type_name", type_cls),
        "kind": type_cls
    }

    if getattr(type_obj, "optional", False):
        node["optional"] = True

    if getattr(type_obj, "default", None) is not None:
        node["default"] = getattr(type_obj, "default")

    constraints = _extract_constraints(type_obj)
    if constraints:
        node["constraints"] = constraints

    type_id = id(type_obj)
    if type_id in visited:
        node["note"] = "recursive reference"
        return node

    visited.add(type_id)
    children: List[Dict[str, Any]] = []

    root_members = getattr(type_obj, "root_members", None)
    if root_members:
        for member in root_members:
            children.append(_describe_type(member, visited))

    root_index_to_member = getattr(type_obj, "root_index_to_member", None)
    if root_index_to_member:
        for _, member in sorted(root_index_to_member.items(), key=lambda item: item[0]):
            children.append(_describe_type(member, visited))

    element_type = getattr(type_obj, "element_type", None)
    if element_type:
        child = _describe_type(element_type, visited)
        if not child.get("name"):
            child["name"] = "element"
        children.append(child)

    visited.remove(type_id)

    if children:
        node["children"] = children

    return node


def _extract_constraints(type_obj: Any) -> Optional[Dict[str, Any]]:
    constraints: Dict[str, Any] = {}

    range_info = _build_range(
        getattr(type_obj, "minimum", None),
        getattr(type_obj, "maximum", None),
    )
    if range_info:
        constraints["range"] = range_info

    # Extract size constraints for BIT STRING / OCTET STRING
    number_of_bits = getattr(type_obj, "number_of_bits", None)
    if number_of_bits is not None:
        constraints["size"] = number_of_bits

    if getattr(type_obj, "has_extension_marker", None):
        constraints["extensionMarker"] = True

    choices = getattr(type_obj, "root_index_to_data", None)
    if isinstance(choices, dict) and choices:
        constraints["choices"] = list(choices.values())

    named_bits = getattr(type_obj, "named_bits", None)
    if isinstance(named_bits, dict) and named_bits:
        constraints["namedBits"] = named_bits

    if not constraints:
        return None

    return constraints


def _build_range(minimum: Any, maximum: Any) -> Optional[Dict[str, Any]]:
    values: Dict[str, Any] = {}
    if minimum is not None:
        values["min"] = minimum
    if maximum is not None:
        values["max"] = maximum
    return values or None





