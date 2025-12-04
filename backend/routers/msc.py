from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from uuid import UUID

from backend.application.msc.services import (
    MscApplicationService, 
    SequenceDTO, 
    ValidationResponse, 
    IdentifierDetectionResponse
)
from backend.application.msc.use_cases import MscUseCaseFactory
from backend.infrastructure.msc.dependencies import get_msc_service
from backend.domain.msc.entities import ValidationType, MscSession

router = APIRouter(
    prefix="/msc",
    tags=["MSC"],
    responses={404: {"description": "Not found"}},
)

def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

# Request models
class CreateSequenceRequest(BaseModel):
    name: str
    protocol: str
    session_id: Optional[str] = None

class UpdateSequenceRequest(BaseModel):
    name: Optional[str] = None
    add_message: Optional[Dict[str, Any]] = None
    remove_message: Optional[str] = None  # message ID

class AddMessageRequest(BaseModel):
    type_name: str
    data: Dict[str, Any]
    source_actor: str = "UE"
    target_actor: str = "gNB"

class ValidateSequenceRequest(BaseModel):
    sequence_id: str

class DetectIdentifiersRequest(BaseModel):
    protocol: str
    type_name: str

# Response models (Pydantic models for FastAPI)
class ValidationIssueResponse(CamelModel):
    type: str
    message: str
    field: Optional[str] = None
    message_index: Optional[int] = None
    code: Optional[str] = None

class MessageResponse(CamelModel):
    id: str
    type_name: str
    data: Dict[str, Any]
    source_actor: str
    target_actor: str
    timestamp: float
    validation_errors: List[ValidationIssueResponse] = Field(default_factory=list)

class TrackedIdentifierResponse(CamelModel):
    name: str
    values: Dict[int, Any] = Field(default_factory=dict)
    is_consistent: bool = True
    conflicts: List[str] = Field(default_factory=list)

class SequenceResponse(CamelModel):
    id: str
    name: str
    protocol: str
    messages: List[MessageResponse]
    sub_sequences: List[Dict[str, Any]] = Field(default_factory=list)
    configurations: Dict[str, TrackedIdentifierResponse] = Field(default_factory=dict)
    validation_results: List[ValidationIssueResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str

class ValidationResponseModel(CamelModel):
    results: List[ValidationIssueResponse]
    has_errors: bool
    error_count: int
    warning_count: int

class IdentifierResponse(CamelModel):
    identifiers: List[str]
    protocol: str
    type_name: str
    count: int
    detected_at: str

class FieldSuggestionResponse(CamelModel):
    identifier: str
    value: Any
    source_message_index: int
    confidence: float
    reason: Optional[str] = None


def build_sequence_response(dto: SequenceDTO) -> SequenceResponse:
    return SequenceResponse(
        id=dto.id,
        name=dto.name,
        protocol=dto.protocol,
        messages=[MessageResponse(**msg) for msg in dto.messages],
        sub_sequences=dto.sub_sequences,
        configurations={
            name: TrackedIdentifierResponse(**identifier)
            for name, identifier in dto.tracked_identifiers.items()
        },
        validation_results=[ValidationIssueResponse(**result) for result in dto.validation_results],
        created_at=dto.created_at,
        updated_at=dto.updated_at
    )

@router.post("/sequences", response_model=SequenceResponse)
async def create_sequence(
    request: CreateSequenceRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Create a new MSC sequence."""
    try:
        dto = msc_service.create_sequence(request.name, request.protocol, request.session_id)
        # Convert DTO to Pydantic model
        return build_sequence_response(dto)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create sequence: {str(e)}")

@router.get("/sequences/{sequence_id}", response_model=SequenceResponse)
async def get_sequence(
    sequence_id: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Retrieve an existing MSC sequence."""
    try:
        dto = msc_service.get_sequence(sequence_id)
        if not dto:
            raise HTTPException(status_code=404, detail="Sequence not found")
        # Convert DTO to Pydantic model
        return build_sequence_response(dto)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sequence: {str(e)}")

@router.put("/sequences/{sequence_id}", response_model=SequenceResponse)
async def update_sequence(
    sequence_id: str,
    request: UpdateSequenceRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Update an existing MSC sequence."""
    try:
        updates = {}
        if request.name is not None:
            updates['name'] = request.name
        
        if request.add_message is not None:
            updates['add_message'] = request.add_message
        
        if request.remove_message is not None:
            updates['remove_message'] = request.remove_message
        
        dto = msc_service.update_sequence(sequence_id, updates)
        if not dto:
            raise HTTPException(status_code=404, detail="Sequence not found")
        
        # Convert DTO to Pydantic model
        return build_sequence_response(dto)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update sequence: {str(e)}")

@router.delete("/sequences/{sequence_id}")
async def delete_sequence(
    sequence_id: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Delete an MSC sequence."""
    try:
        success = msc_service.delete_sequence(sequence_id)
        if not success:
            raise HTTPException(status_code=404, detail="Sequence not found")
        return {"status": "success", "deleted": sequence_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete sequence: {str(e)}")

@router.post("/sequences/{sequence_id}/messages", response_model=SequenceResponse)
async def add_message_to_sequence(
    sequence_id: str,
    request: AddMessageRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Add a message to an existing sequence."""
    try:
        message_data = {
            'type_name': request.type_name,
            'data': request.data,
            'source_actor': request.source_actor,
            'target_actor': request.target_actor
        }
        dto = msc_service.add_message_to_sequence(sequence_id, message_data)
        # Convert DTO to Pydantic model
        return build_sequence_response(dto)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to add message: {str(e)}")

@router.post("/sequences/{sequence_id}/validate", response_model=ValidationResponseModel)
async def validate_sequence(
    sequence_id: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Validate an MSC sequence."""
    try:
        results = msc_service.validate_sequence(sequence_id)
        
        issue_responses = [
            ValidationIssueResponse(
                type=r.type.value,
                message=r.message,
                field=r.field,
                message_index=r.message_index,
                code=r.code
            ) for r in results
        ]

        response = ValidationResponseModel(
            results=issue_responses,
            has_errors=any(r.type == ValidationType.ERROR for r in results),
            error_count=sum(1 for r in results if r.type == ValidationType.ERROR),
            warning_count=sum(1 for r in results if r.type == ValidationType.WARNING)
        )
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate sequence: {str(e)}")

@router.get("/protocols/{protocol}/identifiers/{type_name}", response_model=IdentifierResponse)
async def detect_identifiers(
    protocol: str,
    type_name: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Detect identifiers and configuration fields for a message type."""
    try:
        identifiers = msc_service.detect_identifiers(protocol, type_name)
        
        response = IdentifierDetectionResponse(
            identifiers=identifiers,
            protocol=protocol,
            type_name=type_name
        )
        
        return IdentifierResponse(
            identifiers=response.identifiers,
            protocol=response.protocol,
            type_name=response.type_name,
            count=response.count,
            detected_at=response.detected_at
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to detect identifiers: {str(e)}")

@router.get("/sequences/{sequence_id}/suggestions", response_model=List[FieldSuggestionResponse])
async def get_field_suggestions(
    sequence_id: str,
    message_index: int,
    field_name: str,
    protocol: str,
    type_name: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Get configuration suggestions for a field."""
    try:
        suggestions = msc_service.get_field_suggestions(
            sequence_id,
            message_index,
            field_name,
            protocol,
            type_name
        )
        return [FieldSuggestionResponse(**suggestion) for suggestion in suggestions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get field suggestions: {str(e)}")

@router.get("/sequences", response_model=List[SequenceResponse])
async def list_sequences(
    protocol: Optional[str] = None,
    session_id: Optional[str] = None,
    include_examples: bool = False,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """List all MSC sequences, optionally filtered by protocol and session."""
    try:
        dtos = msc_service.list_sequences(protocol, session_id)
        result = [build_sequence_response(dto) for dto in dtos]
        
        # Add example sequences if requested
        if include_examples:
            import os
            import json
            from pathlib import Path
            from backend.domain.msc.entities import MscSequence, MscMessage, TrackedIdentifier
            from datetime import datetime
            
            example_dir = Path(__file__).parent.parent / "msc_storage"
            example_files = list(example_dir.glob("example_*.json"))
            
            for example_file in example_files:
                try:
                    with open(example_file, 'r', encoding='utf-8') as f:
                        example_data = json.load(f)
                        # Only include if protocol matches or no protocol filter
                        if not protocol or example_data.get("protocol") == protocol:
                            # Convert to SequenceDTO format
                            messages = []
                            for msg_data in example_data.get("messages", []):
                                from backend.domain.msc.entities import ValidationResult, ValidationType
                                validation_errors = [
                                    ValidationResult(
                                        type=ValidationType(error.get("type", "error")),
                                        message=error.get("message", ""),
                                        field=error.get("field"),
                                        message_index=error.get("message_index"),
                                        code=error.get("code")
                                    )
                                    for error in msg_data.get("validation_errors", [])
                                ]
                                messages.append(MscMessage(
                                    id=msg_data.get("id"),
                                    type_name=msg_data.get("type_name", ""),
                                    data=msg_data.get("data", {}),
                                    source_actor=msg_data.get("source_actor", "UE"),
                                    target_actor=msg_data.get("target_actor", "gNB"),
                                    timestamp=msg_data.get("timestamp", 0.0),
                                    validation_errors=validation_errors
                                ))
                            
                            tracked_identifiers = {}
                            for name, ident_data in example_data.get("tracked_identifiers", {}).items():
                                tracked_identifiers[name] = TrackedIdentifier(
                                    name=ident_data.get("name", name),
                                    values={int(k): v for k, v in ident_data.get("values", {}).items()},
                                    conflicts=ident_data.get("conflicts", [])
                                )
                            
                            example_seq = MscSequence(
                                id=example_data.get("id"),
                                name=example_data.get("name", "Example"),
                                protocol=example_data.get("protocol", "nr_rel17_rrc"),
                                messages=messages,
                                tracked_identifiers=tracked_identifiers,
                                created_at=datetime.fromisoformat(example_data.get("created_at", "2025-01-01T00:00:00")),
                                updated_at=datetime.fromisoformat(example_data.get("updated_at", "2025-01-01T00:00:00"))
                            )
                            
                            result.append(build_sequence_response(SequenceDTO(example_seq)))
                except Exception as e:
                    print(f"Failed to load example {example_file}: {e}", flush=True)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sequences: {str(e)}")

@router.get("/examples/{example_name}", response_model=SequenceResponse)
async def get_example_sequence(
    example_name: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Load an example MSC sequence by name."""
    try:
        from pathlib import Path
        import json
        from backend.domain.msc.entities import MscSequence, MscMessage, TrackedIdentifier, ValidationResult, ValidationType
        from datetime import datetime
        
        example_dir = Path(__file__).parent.parent / "msc_storage"
        example_file = example_dir / f"example_{example_name}.json"
        
        if not example_file.exists():
            raise HTTPException(status_code=404, detail=f"Example sequence '{example_name}' not found")
        
        with open(example_file, 'r', encoding='utf-8') as f:
            example_data = json.load(f)
        
        # Convert to MscSequence
        messages = []
        for msg_data in example_data.get("messages", []):
            validation_errors = [
                ValidationResult(
                    type=ValidationType(error.get("type", "error")),
                    message=error.get("message", ""),
                    field=error.get("field"),
                    message_index=error.get("message_index"),
                    code=error.get("code")
                )
                for error in msg_data.get("validation_errors", [])
            ]
            messages.append(MscMessage(
                id=msg_data.get("id"),
                type_name=msg_data.get("type_name", ""),
                data=msg_data.get("data", {}),
                source_actor=msg_data.get("source_actor", "UE"),
                target_actor=msg_data.get("target_actor", "gNB"),
                timestamp=msg_data.get("timestamp", 0.0),
                validation_errors=validation_errors
            ))
        
        tracked_identifiers = {}
        for name, ident_data in example_data.get("tracked_identifiers", {}).items():
            tracked_identifiers[name] = TrackedIdentifier(
                name=ident_data.get("name", name),
                values={int(k): v for k, v in ident_data.get("values", {}).items()},
                conflicts=ident_data.get("conflicts", [])
            )
        
        example_seq = MscSequence(
            id=example_data.get("id"),
            name=example_data.get("name", "Example"),
            protocol=example_data.get("protocol", "nr_rel17_rrc"),
            messages=messages,
            tracked_identifiers=tracked_identifiers,
            created_at=datetime.fromisoformat(example_data.get("created_at", "2025-01-01T00:00:00")),
            updated_at=datetime.fromisoformat(example_data.get("updated_at", "2025-01-01T00:00:00"))
        )
        
        return build_sequence_response(SequenceDTO(example_seq))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load example sequence: {str(e)}")

@router.post("/reorganize-storage")
async def reorganize_storage(
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Reorganize storage: move files to protocol subdirectories with readable names."""
    try:
        # Access the repository directly
        from backend.infrastructure.msc.dependencies import get_msc_repository
        repo = get_msc_repository()
        result = repo.reorganize_storage()
        return {
            "status": "success",
            "reorganized": result["reorganized"],
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reorganize storage: {str(e)}")

@router.get("/health")
async def msc_health():
    """Health check for MSC service."""
    return {
        "status": "healthy",
        "service": "msc",
        "version": "1.0.0",
        "features": {
            "sequence_crud": True,
            "validation": True,
            "identifier_detection": True,
            "rrc_state_machine": True,
            "hex_decode": True
        }
    }


# Request model for hex decode
class HexDecodeRequest(BaseModel):
    hex_data: str
    protocol: str
    type_name: Optional[str] = None
    encoding_rule: str = "per"
    source_actor: str = "UE"
    target_actor: str = "gNB"


class BatchHexDecodeRequest(BaseModel):
    hex_messages: List[str]
    protocol: str
    type_name: Optional[str] = None
    encoding_rule: str = "per"


class DecodedMessageResponse(CamelModel):
    type_name: str
    data: Dict[str, Any]
    hex: str
    status: str
    error: Optional[str] = None
    source_actor: str = "UE"
    target_actor: str = "gNB"


@router.post("/decode-hex", response_model=DecodedMessageResponse)
async def decode_hex_to_message(request: HexDecodeRequest):
    """Decode a single hex string to an MSC message."""
    from backend.core.manager import manager
    from backend.core.serialization import serialize_asn1_data
    
    try:
        compiler = manager.get_compiler(request.protocol)
        if not compiler:
            return DecodedMessageResponse(
                type_name=request.type_name or "Unknown",
                data={},
                hex=request.hex_data,
                status="error",
                error=f"Protocol '{request.protocol}' not found"
            )
        
        # Clean hex data
        clean_hex = request.hex_data.replace("0x", "").replace(" ", "").replace("\n", "").replace(",", "")
        data_bytes = bytes.fromhex(clean_hex)
        
        # Try to decode
        decoded = None
        decoded_type = request.type_name or "Unknown"
        
        types_to_try = [request.type_name] if request.type_name else list(compiler.types.keys())
        
        for type_name in types_to_try:
            try:
                decoded = compiler.decode(type_name, data_bytes, check_constraints=True)
                decoded_type = type_name
                break
            except Exception:
                continue
        
        if decoded is None:
            return DecodedMessageResponse(
                type_name=decoded_type,
                data={},
                hex=clean_hex,
                status="error",
                error="Could not decode against any type"
            )
        
        # Determine message direction based on type
        source_actor = request.source_actor
        target_actor = request.target_actor
        
        # Auto-detect direction for common RRC messages
        ue_to_gnb_types = [
            'RRCSetupRequest', 'RRCSetupComplete', 'RRCReconfigurationComplete',
            'MeasurementReport', 'SecurityModeComplete', 'UECapabilityInformation',
            'RRCConnectionRequest', 'RRCConnectionSetupComplete'
        ]
        gnb_to_ue_types = [
            'RRCSetup', 'RRCReconfiguration', 'RRCRelease',
            'SecurityModeCommand', 'UECapabilityEnquiry',
            'RRCConnectionSetup', 'RRCConnectionReconfiguration', 'RRCConnectionRelease'
        ]
        
        if decoded_type in ue_to_gnb_types:
            source_actor = "UE"
            target_actor = "gNB"
        elif decoded_type in gnb_to_ue_types:
            source_actor = "gNB"
            target_actor = "UE"
        
        return DecodedMessageResponse(
            type_name=decoded_type,
            data=serialize_asn1_data(decoded),
            hex=clean_hex,
            status="success",
            source_actor=source_actor,
            target_actor=target_actor
        )
        
    except ValueError as e:
        return DecodedMessageResponse(
            type_name=request.type_name or "Unknown",
            data={},
            hex=request.hex_data,
            status="error",
            error=f"Invalid hex format: {str(e)}"
        )
    except Exception as e:
        return DecodedMessageResponse(
            type_name=request.type_name or "Unknown",
            data={},
            hex=request.hex_data,
            status="error",
            error=f"Decode error: {str(e)}"
        )


@router.post("/decode-hex-batch", response_model=List[DecodedMessageResponse])
async def decode_hex_batch(request: BatchHexDecodeRequest):
    """Decode multiple hex strings to MSC messages."""
    results = []
    
    for hex_msg in request.hex_messages:
        single_request = HexDecodeRequest(
            hex_data=hex_msg,
            protocol=request.protocol,
            type_name=request.type_name,
            encoding_rule=request.encoding_rule
        )
        result = await decode_hex_to_message(single_request)
        results.append(result)
    
    return results


@router.post("/sequences/{sequence_id}/add-from-hex", response_model=SequenceResponse)
async def add_message_from_hex(
    sequence_id: str,
    request: HexDecodeRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Decode hex and add the resulting message to a sequence."""
    # First decode the hex
    decoded = await decode_hex_to_message(request)
    
    if decoded.status != "success":
        raise HTTPException(status_code=400, detail=decoded.error or "Failed to decode hex")
    
    # Add to sequence
    message_data = {
        'type_name': decoded.type_name,
        'data': decoded.data,
        'source_actor': decoded.source_actor,
        'target_actor': decoded.target_actor
    }
    
    dto = msc_service.add_message_to_sequence(sequence_id, message_data)
    return build_sequence_response(dto)

# Session Management Endpoints

class SessionRequest(BaseModel):
    name: str
    description: Optional[str] = None

class SessionResponse(CamelModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str
    updated_at: str
    is_active: bool

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    request: SessionRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Create a new session."""
    try:
        session = msc_service.create_session(request.name, request.description)
        return SessionResponse(
            id=session.id,
            name=session.name,
            description=session.description,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            is_active=session.is_active
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """List all sessions."""
    try:
        sessions = msc_service.list_sessions()
        return [
            SessionResponse(
                id=session.id,
                name=session.name,
                description=session.description,
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat(),
                is_active=session.is_active
            )
            for session in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Get a specific session."""
    try:
        session = msc_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return SessionResponse(
            id=session.id,
            name=session.name,
            description=session.description,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            is_active=session.is_active
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@router.put("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    request: SessionRequest,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Update a session."""
    try:
        session = msc_service.update_session(session_id, request.name, request.description)
        return SessionResponse(
            id=session.id,
            name=session.name,
            description=session.description,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
            is_active=session.is_active
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    msc_service: MscApplicationService = Depends(get_msc_service)
):
    """Delete a session."""
    try:
        success = msc_service.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")
