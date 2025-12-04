import React, { useMemo, useState, useEffect } from 'react';
import { Paper, Text, Group, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { 
  IconChevronDown, 
  IconChevronRight, 
  IconCircleDot, 
  IconAlertCircle, 
  IconCheck,
  IconCopy
} from '@tabler/icons-react';
import type { MscSequence, MscMessage, ValidationResult } from '../../domain/msc/types';

interface MscDiagramProps {
  sequence: MscSequence | null;
  selectedMessageIndex?: number;
  onMessageSelect?: (index: number) => void;
  height?: number;
  showValidation?: boolean;
  collapsible?: boolean;
}

const ACTOR_WIDTH = 120;
const MESSAGE_HEIGHT = 60;
const DIAGRAM_MARGIN = 40;
const ACTOR_COLORS = {
  UE: '#3b82f6',    // Blue
  gNB: '#ef4444',   // Red
  Network: '#10b981', // Green
  CoreNetwork: '#8b5cf6' // Purple
};

export const MscDiagram: React.FC<MscDiagramProps> = ({
  sequence,
  selectedMessageIndex,
  onMessageSelect,
  height = 600,
  showValidation = true,
  collapsible = true
}) => {
  const [expandedSubSequences, setExpandedSubSequences] = useState<Set<string>>(new Set());
  const [diagramWidth, setDiagramWidth] = useState(800);
  
  // Actor positions
  const actors = useMemo(() => {
    if (!sequence) return [];
    const actorSet = new Set<string>();
    
    sequence.messages.forEach(msg => {
      // Handle both camelCase and snake_case naming
      const sourceActor = msg.sourceActor || msg.source_actor || 'UE';
      const targetActor = msg.targetActor || msg.target_actor || 'gNB';
      actorSet.add(sourceActor);
      actorSet.add(targetActor);
    });
    
    return Array.from(actorSet).sort();
  }, [sequence]);
  
  const actorPositions = useMemo(() => {
    return actors.reduce((acc, actor, index) => {
      acc[actor] = DIAGRAM_MARGIN + (index * ACTOR_WIDTH) + (ACTOR_WIDTH / 2);
      return acc;
    }, {} as Record<string, number>);
  }, [actors]);
  
  // Calculate diagram dimensions
  useEffect(() => {
    if (sequence && actors.length > 0) {
      const maxX = Math.max(...Object.values(actorPositions));
      setDiagramWidth(maxX + DIAGRAM_MARGIN + 100); // Extra space for labels
    }
  }, [actorPositions, sequence, actors.length]);
  
  const toggleSubSequence = (subSequenceId: string) => {
    setExpandedSubSequences(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subSequenceId)) {
        newSet.delete(subSequenceId);
      } else {
        newSet.add(subSequenceId);
      }
      return newSet;
    });
  };
  
  if (!sequence) {
    return (
      <Paper p="md" withBorder>
        <Text>No sequence to display. Create or load a sequence first.</Text>
      </Paper>
    );
  }
  
  const renderActor = (actor: string, y: number) => {
    const x = actorPositions[actor];
    const color = ACTOR_COLORS[actor as keyof typeof ACTOR_COLORS] || '#6b7280';
    
    return (
      <g key={actor}>
        {/* Actor line */}
        <line
          x1={x}
          y1={DIAGRAM_MARGIN}
          x2={x}
          y2={height - DIAGRAM_MARGIN}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={actor === 'UE' ? "5,5" : undefined}
        />
        
        {/* Actor label */}
        <g transform={`translate(${x - 30}, ${y})`}>
          <rect
            x="0"
            y="-12"
            width={60}
            height={24}
            rx="4"
            fill={color}
            opacity="0.1"
          />
          <text
            x="30"
            y="0"
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill={color}
          >
            {actor}
          </text>
        </g>
      </g>
    );
  };
  
  const renderMessage = (message: MscMessage, index: number, y: number, depth: number = 0) => {
    // Handle both camelCase and snake_case naming
    const sourceActor = message.sourceActor || message.source_actor || 'UE';
    const targetActor = message.targetActor || message.target_actor || 'gNB';
    const sourceX = actorPositions[sourceActor];
    const targetX = actorPositions[targetActor];
    const isSelected = selectedMessageIndex === index;
    const hasErrors = message.validationErrors?.some(e => e.type === 'error');
    const hasWarnings = message.validationErrors?.some(e => e.type === 'warning');
    
    // Adjust y position for nesting depth
    const adjustedY = y + (depth * 20);
    
    let strokeColor = '#64748b';
    let strokeWidth = 2;
    
    if (isSelected) {
      strokeColor = '#3b82f6';
      strokeWidth = 3;
    } else if (hasErrors) {
      strokeColor = '#ef4444';
      strokeWidth = 3;
    } else if (hasWarnings) {
      strokeColor = '#f59e0b';
      strokeWidth = 2.5;
    }
    
    return (
      <g key={`${message.id}-${depth}`}>
        {/* Message arrow */}
        <line
          x1={sourceX}
          y1={adjustedY}
          x2={targetX}
          y2={adjustedY}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          markerEnd="url(#arrowhead)"
          onClick={() => onMessageSelect?.(index)}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Arrowhead */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
          </marker>
        </defs>
        
        {/* Message label */}
        <g transform={`translate(${(sourceX + targetX) / 2}, ${adjustedY - 10})`}>
          <foreignObject width="200" height="30">
            <div style={{ 
              padding: '4px 8px', 
              background: isSelected ? '#eff6ff' : '#f8fafc',
              borderRadius: '4px',
              border: `1px solid ${strokeColor}`,
              fontSize: '11px',
              fontFamily: 'monospace',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}>
              <Text size="xs" lineClamp={1}>
                {message.type_name}
              </Text>
            </div>
          </foreignObject>
        </g>
        
        {/* Validation indicators */}
        {showValidation && (hasErrors || hasWarnings) && (
          <g transform={`translate(${targetX + 10}, ${adjustedY})`}>
            <Tooltip 
              label={message.validationErrors?.map(e => `${e.type}: ${e.message}`).join('\n') || ''}
              withArrow
              position="right"
              style={{ maxWidth: 300 }}
            >
              <ActionIcon size="xs" variant="light" color={hasErrors ? 'red' : 'orange'}>
                {hasErrors ? <IconAlertCircle size={12} /> : <IconCircleDot size={12} />}
              </ActionIcon>
            </Tooltip>
          </g>
        )}
        
        {/* Timestamp label */}
        <text
          x={targetX + 15}
          y={adjustedY + 3}
          fontSize="10"
          fill="#64748b"
          textAnchor="start"
        >
          t={new Date(message.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </text>
      </g>
    );
  };
  
  const renderSubSequence = (subSequence: MscSequence, startY: number, depth: number) => {
    const subId = subSequence.id;
    const isExpanded = expandedSubSequences.has(subId);
    const subMessages = subSequence.messages;
    
    return (
      <g key={`sub-${subId}`}>
        {/* Sub-sequence boundary */}
        <rect
          x={DIAGRAM_MARGIN - 10}
          y={startY - 10}
          width={diagramWidth - 2 * DIAGRAM_MARGIN + 20}
          height={MESSAGE_HEIGHT * (subMessages.length + 1) + 20}
          fill="none"
          stroke="#e2e8f0"
          strokeDasharray="5,5"
          strokeWidth="1"
          rx="4"
          opacity={0.7}
        />
        
        {/* Sub-sequence header */}
        <g transform={`translate(${DIAGRAM_MARGIN}, ${startY - 5})`}>
          <rect
            x="0"
            y="0"
            width="200"
            height="25"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            rx="4"
          />
          <Group>
            <text x="8" y="17" fontSize="12" fontWeight="600" fill="#475569">
              Sub-sequence: {subSequence.name}
            </text>
            <ActionIcon
              size="xs"
              variant="transparent"
              onClick={() => toggleSubSequence(subId)}
              style={{ cursor: 'pointer' }}
            >
              {isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            </ActionIcon>
          </Group>
        </g>
        
        {/* Render sub-sequence messages if expanded */}
        {isExpanded && subMessages.map((message, index) => {
          const messageY = startY + MESSAGE_HEIGHT * (index + 1);
          return renderMessage(message, index, messageY, depth + 1);
        })}
      </g>
    );
  };
  
  const renderSequence = useMemo(() => {
    if (!sequence) return null;
    
    let currentY = DIAGRAM_MARGIN;
    const elements = [];
    
    // Render actors
    actors.forEach(actor => {
      elements.push(renderActor(actor, currentY));
    });
    
    // Render main messages
    sequence.messages.forEach((message, index) => {
      const messageY = currentY + MESSAGE_HEIGHT;
      elements.push(renderMessage(message, index, messageY, 0));
      currentY = messageY;
    });
    
    // Render sub-sequences (simplified - would need proper positioning)
    // For now, just placeholder
    if (sequence.subSequences.length > 0) {
      currentY += 20;
      elements.push(
        <g key="subsequences-placeholder">
          <text x={DIAGRAM_MARGIN} y={currentY} fontSize="12" fill="#94a3b8">
            Sub-sequences (collapsible - implementation pending)
          </text>
        </g>
      );
      currentY += MESSAGE_HEIGHT;
    }
    
    return elements;
  }, [sequence, actors, actorPositions, diagramWidth, height, selectedMessageIndex, onMessageSelect, showValidation, collapsible, expandedSubSequences]);
  
  return (
    <Paper withBorder p="md" style={{ height, overflow: 'auto' }}>
      <Group justify="space-between" mb="sm">
        <Text size="lg" fw={600}>
          MSC Sequence Diagram: {sequence?.name || 'Untitled'}
        </Text>
        <Group>
          <Badge variant="light" color={sequence?.validationResults?.some(r => r.type === 'error') ? 'red' : 'green'}>
            {sequence?.validationResults?.filter(r => r.type === 'error').length || 0} Errors | 
            {sequence?.validationResults?.filter(r => r.type === 'warning').length || 0} Warnings
          </Badge>
          <Text size="sm" c="dimmed">
            Messages: {sequence?.messages.length || 0} | Actors: {actors.length}
          </Text>
        </Group>
      </Group>
      
      <div style={{ position: 'relative', width: '100%', height: height - 100 }}>
        <svg
          width={diagramWidth}
          height={height - 100}
          viewBox={`0 0 ${diagramWidth} ${height - 100}`}
          style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Timeline */}
          <line
            x1={DIAGRAM_MARGIN}
            y1={DIAGRAM_MARGIN}
            x2={DIAGRAM_MARGIN}
            y2={height - DIAGRAM_MARGIN}
            stroke="#64748b"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          
          {/* Time labels */}
          {[0, 5, 10, 15, 20].map((time, index) => (
            <g key={index}>
              <line
                x1={DIAGRAM_MARGIN - 5}
                y1={DIAGRAM_MARGIN + (time * MESSAGE_HEIGHT)}
                x2={DIAGRAM_MARGIN}
                y2={DIAGRAM_MARGIN + (time * MESSAGE_HEIGHT)}
                stroke="#94a3b8"
                strokeWidth="1"
              />
              <text
                x={DIAGRAM_MARGIN - 15}
                y={DIAGRAM_MARGIN + (time * MESSAGE_HEIGHT) + 3}
                fontSize="10"
                fill="#64748b"
                textAnchor="end"
              >
                t+{time}s
              </text>
            </g>
          ))}
          
          {/* Render sequence elements */}
          {renderSequence}
          
          {/* Legend */}
          <g transform={`translate(${diagramWidth - 200}, 20)`}>
            <text x="0" y="0" fontSize="10" fill="#64748b" fontWeight="600">
              Legend
            </text>
            <text x="0" y="15" fontSize="9" fill="#475569">
              ● Normal message
            </text>
            <text x="0" y="28" fontSize="9" fill="#ef4444">
              ● Error validation
            </text>
            <text x="0" y="41" fontSize="9" fill="#f59e0b">
              ● Warning validation
            </text>
            <text x="0" y="54" fontSize="9" fill="#3b82f6">
              ● Selected message
            </text>
          </g>
        </svg>
      </div>
      
      {/* Sequence info panel */}
      {sequence && (
        <Paper withBorder p="sm" mt="md">
          <Group justify="apart">
            <div>
              <Text size="sm" c="dimmed">Protocol: {sequence.protocol}</Text>
              <Text size="sm" c="dimmed">Created: {new Date(sequence.createdAt).toLocaleString()}</Text>
              <Text size="sm" c="dimmed">Updated: {new Date(sequence.updatedAt).toLocaleString()}</Text>
            </div>
            <Group>
              {sequence.validationResults?.length > 0 && (
                <Tooltip 
                  label={sequence.validationResults.map(r => `${r.type}: ${r.message}`).join('\n')}
                  multiline
                  width={300}
                >
                  <Badge 
                    color={sequence.validationResults.some(r => r.type === 'error') ? 'red' : 'yellow'}
                    variant="filled"
                  >
                    {sequence.validationResults.filter(r => r.type === 'error').length} Errors
                  </Badge>
                </Tooltip>
              )}
              <ActionIcon variant="subtle" onClick={() => window.open('data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(sequence, null, 2)), '_blank')}>
                <IconCopy size="16" />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      )}
    </Paper>
  );
};

MscDiagram.displayName = 'MscDiagram';

export default MscDiagram;
