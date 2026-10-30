import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import Svg, { Rect, Circle, Line, Text as SvgText, Path, Defs, Marker } from 'react-native-svg';
import { useTheme } from '../../../theme';
import { 
  GitCommit, 
  Workflow, 
  Code2, 
  Eye, 
  Plus, 
  Trash2, 
  Maximize2, 
  Layers,
  ChevronDown
} from 'lucide-react-native';

export type DiagramPreset = 'architecture' | 'workflow' | 'state_machine';

export interface DiagramNodeItem {
  id: string;
  label: string;
  color?: string;
}

export interface DiagramEdgeItem {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramBlockMetadata {
  title?: string;
  preset?: DiagramPreset;
  code?: string;
  nodes?: DiagramNodeItem[];
  edges?: DiagramEdgeItem[];
}

interface DiagramBlockProps {
  metadata?: DiagramBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateDiagram?: (updates: DiagramBlockMetadata) => void;
}

const PRESET_TEMPLATES: Record<DiagramPreset, { title: string; code: string; nodes: DiagramNodeItem[]; edges: DiagramEdgeItem[] }> = {
  architecture: {
    title: 'ScribeX Architecture Topology',
    code: `flowchart TD\n  Client[Expo Client App] --> Gateway[Intake Engine]\n  Gateway --> Vault[SQLite + LanceDB]\n  Vault --> AI[Friday AI Graph]`,
    nodes: [
      { id: 'n1', label: 'Expo Client App', color: '#38BDF8' },
      { id: 'n2', label: 'Intake Engine', color: '#8B5CF6' },
      { id: 'n3', label: 'SQLite + LanceDB', color: '#10B981' },
      { id: 'n4', label: 'Friday AI Graph', color: '#F59E0B' },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'sub-5ms' },
      { from: 'n2', to: 'n3', label: 'WAL write' },
      { from: 'n3', to: 'n4', label: 'vector sync' },
    ],
  },
  workflow: {
    title: 'Note Processing Decision Pipeline',
    code: `flowchart LR\n  Capture[Raw Ingest] --> Detect[Conflict Detect]\n  Detect --> Gate[Ask Gate]\n  Gate --> Commit[Atomic Commit]`,
    nodes: [
      { id: 'w1', label: 'Raw Ingest', color: '#06B6D4' },
      { id: 'w2', label: 'Conflict Detect', color: '#EC4899' },
      { id: 'w3', label: 'Ask Gate', color: '#F59E0B' },
      { id: 'w4', label: 'Atomic Commit', color: '#10B981' },
    ],
    edges: [
      { from: 'w1', to: 'w2', label: 'normalize' },
      { from: 'w2', to: 'w3', label: 'contradiction' },
      { from: 'w3', to: 'w4', label: 'approved' },
    ],
  },
  state_machine: {
    title: 'Task Lifecycle State Machine',
    code: `stateDiagram\n  Draft --> InProgress\n  InProgress --> InReview\n  InReview --> Completed`,
    nodes: [
      { id: 's1', label: 'Draft', color: '#A1A1AA' },
      { id: 's2', label: 'In Progress', color: '#38BDF8' },
      { id: 's3', label: 'In Review', color: '#A855F7' },
      { id: 's4', label: 'Completed', color: '#10B981' },
    ],
    edges: [
      { from: 's1', to: 's2', label: 'start' },
      { from: 's2', to: 's3', label: 'submit' },
      { from: 's3', to: 's4', label: 'verify' },
    ],
  },
};

export const DiagramBlock: React.FC<DiagramBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateDiagram,
}) => {
  const { isDark } = useTheme();

  const preset = metadata?.preset || 'architecture';
  const defaultTemplate = PRESET_TEMPLATES[preset] || PRESET_TEMPLATES.architecture;

  const title = metadata?.title || content || defaultTemplate.title;
  const nodes = metadata?.nodes && metadata.nodes.length > 0 ? metadata.nodes : defaultTemplate.nodes;
  const edges = metadata?.edges && metadata.edges.length > 0 ? metadata.edges : defaultTemplate.edges;
  const code = metadata?.code || defaultTemplate.code;

  const [localTitle, setLocalTitle] = useState(title);
  const [localCode, setLocalCode] = useState(code);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [activePreset, setActivePreset] = useState<DiagramPreset>(preset);

  const commitUpdates = (partial: Partial<DiagramBlockMetadata>) => {
    onUpdateDiagram?.({
      title: localTitle,
      preset: activePreset,
      code: localCode,
      nodes,
      edges,
      ...partial,
    });
  };

  const handleSelectPreset = (newPreset: DiagramPreset) => {
    onFocus?.();
    const tpl = PRESET_TEMPLATES[newPreset];
    setActivePreset(newPreset);
    setLocalTitle(tpl.title);
    setLocalCode(tpl.code);
    commitUpdates({
      preset: newPreset,
      title: tpl.title,
      code: tpl.code,
      nodes: tpl.nodes,
      edges: tpl.edges,
    });
  };

  const handleUpdateNodeLabel = (id: string, label: string) => {
    const nextNodes = nodes.map(n => n.id === id ? { ...n, label } : n);
    commitUpdates({ nodes: nextNodes });
  };

  const handleAddNode = () => {
    onFocus?.();
    const newId = `n-${Date.now()}`;
    const newColor = ['#38BDF8', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'][nodes.length % 5];
    const newNode: DiagramNodeItem = {
      id: newId,
      label: `Node ${nodes.length + 1}`,
      color: newColor,
    };
    const lastNode = nodes[nodes.length - 1];
    const newEdges = [...edges];
    if (lastNode) {
      newEdges.push({ from: lastNode.id, to: newId, label: 'connect' });
    }
    commitUpdates({ nodes: [...nodes, newNode], edges: newEdges });
  };

  const handleDeleteNode = (id: string) => {
    if (nodes.length <= 1) return;
    const nextNodes = nodes.filter(n => n.id !== id);
    const nextEdges = edges.filter(e => e.from !== id && e.to !== id);
    commitUpdates({ nodes: nextNodes, edges: nextEdges });
  };

  // Node spatial layout calculations (Linear Horizontal Pipeline / Flow)
  const nodeLayout = useMemo(() => {
    const nodeWidth = 140;
    const nodeHeight = 44;
    const spacing = 70;
    const startX = 30;
    const startY = 50;

    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    nodes.forEach((n, idx) => {
      positions[n.id] = {
        x: startX + idx * (nodeWidth + spacing),
        y: startY,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    const totalWidth = startX + nodes.length * (nodeWidth + spacing) + 50;
    const totalHeight = 140;

    return { positions, totalWidth, totalHeight };
  }, [nodes]);

  return (
    <Pressable
      onPress={onFocus}
      onLongPress={() => onStartDrag?.()}
      delayLongPress={250}
      className="my-3 w-full"
    >
      <View
        style={{
          borderColor: isSelected
            ? '#06B6D4'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Header Bar: Badge, Presets, View Toggle & Actions */}
        <View className="flex-row items-start justify-between gap-3 mb-2.5 pb-2.5 border-b border-light-border dark:border-white/5">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Diagram Badge */}
              <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                <Workflow size={11} color="#06B6D4" />
                <Text className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Diagram & Whiteboard
                </Text>
              </View>

              {/* Template Presets Picker */}
              {(['architecture', 'workflow', 'state_machine'] as const).map((p) => {
                const isActive = activePreset === p;
                const labels = {
                  architecture: 'Architecture',
                  workflow: 'Decision Flow',
                  state_machine: 'State Machine',
                };
                return (
                  <Pressable
                    key={p}
                    onPress={() => handleSelectPreset(p)}
                    style={{
                      backgroundColor: isActive ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      borderColor: isActive ? 'rgba(6, 182, 212, 0.4)' : 'transparent',
                    }}
                    className="px-2 py-0.5 rounded-lg border"
                  >
                    <Text
                      style={{ color: isActive ? '#06B6D4' : isDark ? '#A1A1AA' : '#71717A' }}
                      className="text-[10px] font-bold"
                    >
                      {labels[p]}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Visual / Code Toggle Pill */}
              <Pressable
                onPress={() => {
                  onFocus?.();
                  setViewMode(viewMode === 'visual' ? 'code' : 'visual');
                }}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5 ml-auto"
              >
                {viewMode === 'visual' ? (
                  <>
                    <Code2 size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
                    <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                      Edit Code
                    </Text>
                  </>
                ) : (
                  <>
                    <Eye size={10} color="#06B6D4" />
                    <Text className="text-[10px] font-mono text-cyan-400 font-bold">
                      View Diagram
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Diagram Title */}
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Diagram Title..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Delete Block Button */}
          {Boolean(onDelete) && (
            <Pressable
              onPress={onDelete}
              className="p-1.5 rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>

        {/* VIEW 1: Visual Interactive SVG Diagram Canvas */}
        {viewMode === 'visual' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} className="w-full">
              <View
                style={{
                  width: Math.max(nodeLayout.totalWidth, 500),
                  height: nodeLayout.totalHeight,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                }}
                className="rounded-xl border border-light-border dark:border-white/10 relative overflow-hidden"
              >
                <Svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${Math.max(nodeLayout.totalWidth, 500)} ${nodeLayout.totalHeight}`}
                >
                  <Defs>
                    <Marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <Path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06B6D4" />
                    </Marker>
                  </Defs>

                  {/* Connecting Connector Edges */}
                  {edges.map((edge, idx) => {
                    const fromPos = nodeLayout.positions[edge.from];
                    const toPos = nodeLayout.positions[edge.to];
                    if (!fromPos || !toPos) return null;

                    const startX = fromPos.x + fromPos.width;
                    const startY = fromPos.y + fromPos.height / 2;
                    const endX = toPos.x;
                    const endY = toPos.y + toPos.height / 2;

                    return (
                      <React.Fragment key={idx}>
                        <Line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#06B6D4"
                          strokeWidth="2"
                          strokeDasharray="4,3"
                          markerEnd="url(#arrow)"
                        />
                        {Boolean(edge.label) && (
                          <SvgText
                            x={(startX + endX) / 2}
                            y={startY - 6}
                            fill={isDark ? '#A1A1AA' : '#71717A'}
                            fontSize="9"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {edge.label}
                          </SvgText>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Diagram Nodes */}
                  {nodes.map((node) => {
                    const pos = nodeLayout.positions[node.id];
                    if (!pos) return null;
                    const col = node.color || '#38BDF8';

                    return (
                      <React.Fragment key={node.id}>
                        {/* Node Card Box */}
                        <Rect
                          x={pos.x}
                          y={pos.y}
                          width={pos.width}
                          height={pos.height}
                          rx="10"
                          fill={isDark ? '#18181B' : '#FFFFFF'}
                          stroke={col}
                          strokeWidth="1.5"
                        />
                        {/* Status Accent Dot */}
                        <Circle cx={pos.x + 14} cy={pos.y + pos.height / 2} r="4" fill={col} />
                        {/* Node Label Text */}
                        <SvgText
                          x={pos.x + 26}
                          y={pos.y + pos.height / 2 + 4}
                          fill={isDark ? '#F4F4F5' : '#18181B'}
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}
                </Svg>
              </View>
            </ScrollView>

            {/* Inline Node Edit Row & Controls */}
            <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-light-border dark:border-white/5">
              <View className="flex-row items-center gap-2 flex-wrap flex-1">
                <Text className="text-[10px] uppercase font-bold text-light-textMuted dark:text-dark-textMuted">
                  Nodes ({nodes.length}):
                </Text>
                {nodes.map((n) => (
                  <View
                    key={n.id}
                    style={{ borderColor: (n.color || '#38BDF8') + '50' }}
                    className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border"
                  >
                    <View style={{ backgroundColor: n.color || '#38BDF8' }} className="w-1.5 h-1.5 rounded-full" />
                    <TextInput
                      value={n.label}
                      onChangeText={(lbl) => handleUpdateNodeLabel(n.id, lbl)}
                      onFocus={onFocus}
                      className="text-xs text-light-textPrimary dark:text-dark-textPrimary p-0"
                    />
                    {nodes.length > 1 && (
                      <Pressable onPress={() => handleDeleteNode(n.id)} className="opacity-40 hover:opacity-100 ml-1">
                        <Trash2 size={10} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <Pressable
                  onPress={handleAddNode}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 flex-row items-center gap-1"
                >
                  <Plus size={10} color="#06B6D4" />
                  <Text className="text-[10px] font-bold text-cyan-400">Add Node</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* VIEW 2: Raw Mermaid Code Editor */}
        {viewMode === 'code' && (
          <View>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[10px] uppercase font-mono text-light-textMuted dark:text-dark-textMuted">
                Mermaid Syntax Definition
              </Text>
              <Text className="text-[10px] font-mono text-cyan-500">
                Preserved as ```mermaid
              </Text>
            </View>
            <TextInput
              value={localCode}
              onChangeText={(code) => {
                setLocalCode(code);
                commitUpdates({ code });
              }}
              onFocus={onFocus}
              multiline
              numberOfLines={6}
              className="text-xs font-mono text-light-textPrimary dark:text-dark-textPrimary p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
};

