from fastapi import Depends

from backend.domain.msc.interfaces import (
    IIdentifierDetector, IConfigurationTracker, ISequenceValidator,
    IStateMachine, IMscRepository
)
from backend.infrastructure.msc.identifier_detector import RrcIdentifierDetector
from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
from backend.infrastructure.msc.sequence_validator import SequenceValidator
from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine
from backend.infrastructure.msc.msc_repository import MscRepository
from backend.application.msc.use_cases import MscUseCaseFactory
from backend.application.msc.services import MscApplicationService
from backend.core.config import config_manager

def get_identifier_detector() -> IIdentifierDetector:
    """Dependency provider for identifier detector."""
    return RrcIdentifierDetector()

def get_configuration_tracker() -> IConfigurationTracker:
    """Dependency provider for configuration tracker."""
    return ConfigurationTracker()

def get_sequence_validator(
    config_tracker: IConfigurationTracker = Depends(get_configuration_tracker)
) -> ISequenceValidator:
    """Dependency provider for sequence validator."""
    return SequenceValidator(config_tracker)

def get_rrc_state_machine() -> IStateMachine:
    """Dependency provider for RRC state machine."""
    return RRCStateMachine()

def get_msc_repository() -> IMscRepository:
    """Dependency provider for MSC repository."""
    # Get storage path from config manager
    msc_storage_path = config_manager.get_msc_storage_path()
    return MscRepository(storage_path=msc_storage_path)

def get_msc_use_case_factory(
    repository: IMscRepository = Depends(get_msc_repository),
    detector: IIdentifierDetector = Depends(get_identifier_detector),
    tracker: IConfigurationTracker = Depends(get_configuration_tracker),
    validator: ISequenceValidator = Depends(get_sequence_validator),
    state_machine: IStateMachine = Depends(get_rrc_state_machine)
) -> MscUseCaseFactory:
    """Dependency provider for MSC use case factory."""
    return MscUseCaseFactory(
        repository=repository,
        detector=detector,
        tracker=tracker,
        validator=validator,
        state_machine=state_machine
    )

def get_msc_service(
    factory: MscUseCaseFactory = Depends(get_msc_use_case_factory)
) -> MscApplicationService:
    """Dependency provider for MSC application service."""
    return MscApplicationService(factory)

