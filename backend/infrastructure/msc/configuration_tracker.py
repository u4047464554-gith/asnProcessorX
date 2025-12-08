from typing import List, Dict, Any, Optional
from backend.domain.msc.interfaces import IConfigurationTracker
from backend.domain.msc.entities import TrackedIdentifier
from datetime import datetime

class ConfigurationTracker(IConfigurationTracker):
    """Concrete implementation for tracking configuration values across MSC sequences."""
    
    def __init__(self):
        self._tracked_identifiers: Dict[str, TrackedIdentifier] = {}
    
    def track_value(self, identifier_name: str, message_index: int, value: Any) -> TrackedIdentifier:
        """
        Track a configuration value for an identifier at a specific message index.
        
        Args:
            identifier_name: Name of the identifier (e.g., 'ue-Identity')
            message_index: Index of the message in the sequence
            value: The value to track
            
        Returns:
            Updated TrackedIdentifier instance
        """
        if identifier_name not in self._tracked_identifiers:
            self._tracked_identifiers[identifier_name] = TrackedIdentifier(
                name=identifier_name,
                values={}
            )
        
        current_identifier = self._tracked_identifiers[identifier_name]
        updated_identifier = current_identifier.add_value(message_index, value)
        
        self._tracked_identifiers[identifier_name] = updated_identifier
        return updated_identifier
    
    def get_suggestions(self, identifier_name: str, message_index: int) -> List[Dict[str, Any]]:
        """
        Get suggested values for an identifier based on previous messages.
        
        Args:
            identifier_name: Name of the identifier
            message_index: Current message index (suggestions from previous messages only)
            
        Returns:
            List of suggestion dictionaries with value, source index, and confidence
        """
        suggestions = []
        
        if identifier_name in self._tracked_identifiers:
            identifier = self._tracked_identifiers[identifier_name]
            
            # Get all previous values (sorted by message index)
            previous_values = sorted(
                [(idx, val) for idx, val in identifier.values.items() if idx < message_index],
                key=lambda x: x[0],  # Sort by message index
                reverse=True  # Most recent first
            )
            
            # Generate suggestions from recent values
            for idx, value in previous_values[:3]:  # Limit to 3 most recent
                confidence = self._calculate_confidence(identifier_name, value, message_index - idx)
                
                suggestions.append({
                    'identifier': identifier_name,
                    'value': value,
                    'source_message_index': idx,
                    'confidence': confidence,
                    'reason': f"Used in message {idx}"
                })
        
        # Sort by confidence descending
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        return suggestions
    
    def detect_conflicts(self, identifier_name: str) -> List[str]:
        """
        Detect and return conflicts for a specific identifier.
        
        Args:
            identifier_name: Name of the identifier
            
        Returns:
            List of conflict description strings
        """
        if identifier_name not in self._tracked_identifiers:
            return []
        
        identifier = self._tracked_identifiers[identifier_name]
        conflicts = []
        
        if not identifier.is_consistent():
            # Analyze value distribution
            value_counts = {}
            for value in identifier.values.values():
                value_str = str(value)
                value_counts[value_str] = value_counts.get(value_str, 0) + 1
            
            # Find conflicting values (more than one value used)
            conflicting_values = [val for val, count in value_counts.items() if count > 0]
            
            conflicts.append(
                f"Inconsistent values for '{identifier_name}': {', '.join(conflicting_values)} "
                f"(used {len(identifier.values)} times across {len(set(identifier.values.values()))} distinct values)"
            )
        
        # Check for temporal conflicts (values changing too frequently)
        if len(identifier.values) > 2:
            indices = sorted(identifier.values.keys())
            value_changes = 0
            for i in range(1, len(indices)):
                if identifier.values[indices[i]] != identifier.values[indices[i-1]]:
                    value_changes += 1
            
            if value_changes > 1:
                conflicts.append(
                    f"Frequent changes in '{identifier_name}': {value_changes} changes across {len(indices)} messages"
                )
        
        return conflicts
    
    def get_all_tracked_identifiers(self) -> Dict[str, TrackedIdentifier]:
        """Get all currently tracked identifiers."""
        return self._tracked_identifiers.copy()
    
    def clear_tracking(self, identifier_name: Optional[str] = None) -> None:
        """Clear tracking for a specific identifier or all tracking."""
        if identifier_name:
            self._tracked_identifiers.pop(identifier_name, None)
        else:
            self._tracked_identifiers.clear()
    
    def _calculate_confidence(self, identifier_name: str, value: Any, recency: int) -> float:
        """
        Calculate confidence score for a suggestion.
        
        Args:
            identifier_name: Name of identifier
            value: Suggested value
            recency: How many messages ago this value was used
            
        Returns:
            Confidence score between 0.0 and 1.0
        """
        base_confidence = 0.8  # Base confidence for exact previous value
        
        # Recency bonus (more recent = higher confidence)
        recency_bonus = max(0, 1.0 - (recency * 0.1))  # Decay by 0.1 per message
        
        # Identifier type bonus (critical identifiers get higher confidence)
        critical_identifiers = {'ue-Identity', 'rrc-TransactionIdentifier', 'cellIdentity'}
        type_bonus = 0.2 if identifier_name in critical_identifiers else 0.0
        
        confidence = min(1.0, base_confidence + recency_bonus + type_bonus)
        return confidence
    
    def export_tracking_state(self) -> Dict[str, Any]:
        """Export current tracking state for persistence or debugging."""
        return {
            'tracked_identifiers': {
                name: {
                    'name': identifier.name,
                    'values': identifier.values,
                    'conflicts': identifier.conflicts,
                    'is_consistent': identifier.is_consistent()
                } for name, identifier in self._tracked_identifiers.items()
            },
            'total_tracked': len(self._tracked_identifiers),
            'exported_at': datetime.now().isoformat()
        }
    
    def import_tracking_state(self, state: Dict[str, Any]) -> None:
        """Import tracking state from exported data."""
        if 'tracked_identifiers' in state:
            for name, data in state['tracked_identifiers'].items():
                self._tracked_identifiers[name] = TrackedIdentifier(
                    name=data['name'],
                    values=data['values']
                )
                # Restore conflicts if present
                if 'conflicts' in data and data['conflicts']:
                    # Note: This would need to update the frozen dataclass
                    # For now, we'll recreate with conflicts
                    pass  # Simplified implementation

