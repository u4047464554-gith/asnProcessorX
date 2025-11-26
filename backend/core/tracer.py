from __future__ import annotations

import contextvars
import inspect
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Dict, List, Optional, Tuple

import asn1tools

from backend.core.manager import AsnManager
from backend.core.serialization import serialize_asn1_data

# Context variable used by decode wrappers to forward trace events.
_collector_ctx: contextvars.ContextVar["TraceCollector | None"] = contextvars.ContextVar(
    "asn_trace_collector", default=None
)

_INSTRUMENTED = False


@dataclass
class BitRange:
    start: int
    end: int

    @property
    def length(self) -> int:
        return max(0, self.end - self.start)

    def to_dict(self) -> Dict[str, int]:
        return {"start": self.start, "end": self.end, "length": self.length}


@dataclass
class TraceNode:
    name: str
    type_label: str
    value: Any = None
    bits: Optional[BitRange] = None
    children: List["TraceNode"] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type_label,
            "value": self.value,
            "bits": None if self.bits is None else self.bits.to_dict(),
            "children": [child.to_dict() for child in self.children],
        }


@dataclass
class TraceResult:
    protocol: str
    type_name: str
    decoded: Any
    root: TraceNode
    total_bits: int


class TraceCollector:
    """Collects node hierarchy while the codec decodes a payload."""

    def __init__(self, total_bits: int):
        self._stack: List[Tuple[TraceNode, int]] = []
        self.root: Optional[TraceNode] = None
        self.total_bits = total_bits

    def push(self, type_obj, decoder) -> Optional[Tuple[TraceNode, int]]:
        # Only track real PER decoder instances (they expose number_of_read_bits).
        if not hasattr(decoder, "number_of_read_bits"):
            return None

        name = type_obj.name or type_obj.type_name or "anonymous"
        node = TraceNode(name=name, type_label=type_obj.type_name)
        frame = (node, decoder.number_of_read_bits())
        self._stack.append(frame)
        return frame

    def pop_success(self, frame: Optional[Tuple[TraceNode, int]], value: Any, decoder) -> None:
        if frame is None:
            return
        if not self._stack or self._stack[-1] is not frame:
            return

        node, start = self._stack.pop()
        end = decoder.number_of_read_bits()
        node.bits = BitRange(start=start, end=end)
        node.value = serialize_asn1_data(value)

        if self._stack:
            parent, _ = self._stack[-1]
            parent.children.append(node)
        else:
            self.root = node

    def pop_error(self, frame: Optional[Tuple[TraceNode, int]]) -> None:
        if frame is None:
            return
        if self._stack and self._stack[-1] is frame:
            self._stack.pop()


def _ensure_instrumented():
    global _INSTRUMENTED
    if _INSTRUMENTED:
        return

    from asn1tools.codecs import per as per_codec

    def wrap_decode(method):
        @wraps(method)
        def wrapped(self, *args, **kwargs):
            collector = _collector_ctx.get()
            if collector is None:
                return method(self, *args, **kwargs)

            decoder = args[0] if args else kwargs.get("decoder")
            frame = None
            if decoder is not None:
                frame = collector.push(self, decoder)
            try:
                value = method(self, *args, **kwargs)
            except Exception:
                collector.pop_error(frame)
                raise

            collector.pop_success(frame, value, decoder)
            return value

        return wrapped

    for _, cls in inspect.getmembers(per_codec, inspect.isclass):
        if not issubclass(cls, per_codec.Type):
            continue
        decode = getattr(cls, "decode", None)
        if not callable(decode):
            continue
        if getattr(decode, "__wrapped__", None):
            # Already wrapped by functools.wraps.
            continue
        setattr(cls, "decode", wrap_decode(decode))

    _INSTRUMENTED = True


class TraceService:
    """Facade responsible for tracing PER decodes."""

    def __init__(self, manager: AsnManager):
        self._manager = manager
        _ensure_instrumented()

    def trace(self, protocol: str, type_name: str, hex_data: str) -> TraceResult:
        if not type_name:
            raise ValueError("type_name is required for trace operations.")

        compiler = self._manager.get_compiler(protocol)
        if compiler is None:
            raise ValueError(f"Protocol '{protocol}' not found.")
        if type_name not in compiler.types:
            raise ValueError(f"Type '{type_name}' not found in protocol '{protocol}'.")

        payload_bytes = _hex_to_bytes(hex_data)
        collector = TraceCollector(total_bits=len(payload_bytes) * 8)
        token = _collector_ctx.set(collector)
        try:
            decoded = compiler.decode(type_name, payload_bytes, check_constraints=True)
        finally:
            _collector_ctx.reset(token)

        root = collector.root or TraceNode(
            name=type_name,
            type_label=type_name,
            value=serialize_asn1_data(decoded),
            bits=BitRange(0, collector.total_bits),
        )

        if not root.name:
            root.name = type_name
        if not root.type_label:
            root.type_label = type_name

        consumed_bits = root.bits.end if root.bits else len(payload_bytes) * 8

        return TraceResult(
            protocol=protocol,
            type_name=type_name,
            decoded=decoded,
            root=root,
            total_bits=consumed_bits,
        )


def _hex_to_bytes(hex_data: str) -> bytes:
    if not isinstance(hex_data, str):
        raise ValueError("hex_data must be a hex string.")
    clean = hex_data.replace("0x", "").replace(" ", "").replace("\n", "").strip()
    if len(clean) == 0 or len(clean) % 2 != 0:
        raise ValueError("hex_data must contain an even number of hex characters.")
    return bytes.fromhex(clean)

