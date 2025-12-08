import re
from typing import List
from backend.domain.msc.interfaces import IIdentifierDetector
from backend.core.manager import manager
from backend.core.type_tree import build_type_tree

class RrcIdentifierDetector(IIdentifierDetector):
    """Concrete implementation of identifier detector for RRC protocols."""
    
    # Common RRC identifier patterns
    IDENTIFIER_PATTERNS = [
        r'.*Identity$',
        r'.*Identifier$',
        r'.*ID$',
        r'.*Config$',
        r'.*Configuration$',
        r'^transactionIdentifier$',
        r'^rrc-TransactionIdentifier$',
        r'^ue-Identity$',
        r'^establishmentCause$',
        r'^cellIdentity$',
        r'^physCellId$',
        r'^carrierFreq$',
    ]
    
    # Types commonly used for identifiers
    IDENTIFIER_TYPES = {
        'INTEGER', 'ENUMERATED', 'SEQUENCE', 'CHOICE', 'OBJECT IDENTIFIER',
        'BIT STRING', 'OCTET STRING'
    }
    
    def __init__(self):
        self._patterns = [re.compile(pattern) for pattern in self.IDENTIFIER_PATTERNS]
    
    def detect_identifiers(self, protocol: str, type_name: str) -> List[str]:
        """
        Detect identifier fields for a given protocol and type.
        
        Uses pattern matching on field names and type analysis.
        """
        compiler = manager.get_compiler(protocol)
        if not compiler:
            return []
        
        try:
            # Get the type definition
            type_obj = compiler.types.get(type_name)
            if not type_obj:
                return []
            
            # Build type tree for analysis
            tree = build_type_tree(type_obj)
            return self._analyze_type_tree(tree, type_name)
            
        except Exception as e:
            print(f"Error detecting identifiers for {protocol}.{type_name}: {e}")
            return []
    
    def _analyze_type_tree(self, node: dict, type_name: str) -> List[str]:
        """Recursively analyze type tree to find identifier fields."""
        identifiers = []
        
        # Check current node
        if self._is_identifier_field(node.get('name', ''), node.get('type', '')):
            identifiers.append(node['name'])
        
        # Analyze children (SEQUENCE, CHOICE, etc.)
        children = node.get('children', [])
        for child in children:
            identifiers.extend(self._analyze_type_tree(child, type_name))
        
        return identifiers
    
    def is_identifier_field(self, field_name: str, field_type: str) -> bool:
        """Determine if a field should be tracked as an identifier."""
        # Check naming patterns
        for pattern in self._patterns:
            if pattern.match(field_name):
                return True
        
        # Check if field type is commonly used for identifiers
        if field_type in self.IDENTIFIER_TYPES:
            # Additional heuristics for specific field names
            simple_name = field_name.lower()
            if any(keyword in simple_name for keyword in ['id', 'identity', 'config', 'transaction']):
                return True
        
        return False
    
    def _is_rrc_specific_identifier(self, field_name: str, field_type: str, context_type: str) -> bool:
        """RRC-specific identifier detection logic."""
        rrc_patterns = {
            'RRCConnectionRequest': ['ue-Identity', 'establishmentCause'],
            'RRCConnectionSetup': ['rrc-TransactionIdentifier'],
            'RRCConnectionSetupComplete': ['rrc-TransactionIdentifier'],
            'RRCReconfiguration': ['rrc-TransactionIdentifier'],
            'MeasurementReport': ['measId', 'physCellId'],
        }
        
        if context_type in rrc_patterns:
            if field_name in rrc_patterns[context_type]:
                return True
        
        return False
