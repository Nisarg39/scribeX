import React, { useState, useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, NoteColors } from '../../../theme';
import { 
  PenTool, 
  Highlighter, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2
} from 'lucide-react-native';

interface StrokePath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
  opacity: number;
}

interface DrawingBlockProps {
  initialPaths?: StrokePath[];
  caption?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateDrawing: (paths: StrokePath[], caption?: string) => void;
  onUpdateCaption?: (caption: string) => void;
}

const PALETTE = [
  { name: 'dark', lightColor: '#191919', darkColor: '#F7F7F7' },
  { name: 'lime', lightColor: NoteColors.lime, darkColor: NoteColors.lime },
  { name: 'cyan', lightColor: NoteColors.cyan, darkColor: NoteColors.cyan },
  { name: 'coral', lightColor: NoteColors.coral, darkColor: NoteColors.coral },
  { name: 'apricot', lightColor: NoteColors.apricot, darkColor: NoteColors.apricot },
  { name: 'lavender', lightColor: NoteColors.lavender, darkColor: NoteColors.lavender },
  { name: 'pink', lightColor: NoteColors.pink, darkColor: NoteColors.pink },
];

export const DrawingBlock: React.FC<DrawingBlockProps> = ({
  initialPaths = [],
  caption = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateDrawing,
  onUpdateCaption,
}) => {
  const { isDark } = useTheme();
  const [paths, setPaths] = useState<StrokePath[]>(initialPaths);
  const pathsRef = useRef<StrokePath[]>(initialPaths);
  const [sketchCaption, setSketchCaption] = useState<string>(caption);
  const captionRef = useRef<string>(caption);
  const [redoStack, setRedoStack] = useState<StrokePath[][]>([]);
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

  React.useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  React.useEffect(() => {
    captionRef.current = sketchCaption;
  }, [sketchCaption]);

  React.useEffect(() => {
    if (caption !== undefined && caption !== captionRef.current) {
      setSketchCaption(caption);
      captionRef.current = caption;
    }
  }, [caption]);

  const currentPathRef = useRef<{ points: Array<{ x: number; y: number }> } | null>(null);
  const [currentStroke, setCurrentStroke] = useState<string | null>(null);

  const currentColor = useMemo(() => {
    const item = PALETTE[selectedColorIdx] || PALETTE[0];
    return isDark ? item.darkColor : item.lightColor;
  }, [selectedColorIdx, isDark]);

  const activeOpacity = tool === 'highlighter' ? 0.45 : 1;
  const activeWidth = tool === 'highlighter' ? strokeWidth * 3.5 : strokeWidth;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          onFocus?.();
          const { locationX, locationY } = evt.nativeEvent;
          currentPathRef.current = {
            points: [{ x: locationX, y: locationY }],
          };
          setCurrentStroke(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          if (!currentPathRef.current) return;
          const { locationX, locationY } = evt.nativeEvent;
          currentPathRef.current.points.push({ x: locationX, y: locationY });

          const pts = currentPathRef.current.points;
          let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
          for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
          }
          setCurrentStroke(d);
        },
        onPanResponderRelease: () => {
          if (!currentPathRef.current || currentPathRef.current.points.length === 0) {
            currentPathRef.current = null;
            setCurrentStroke(null);
            return;
          }

          const pts = currentPathRef.current.points;
          let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
          for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
          }

          if (tool === 'eraser') {
            // Remove the last stroke or near stroke
            const next = pathsRef.current.slice(0, -1);
            pathsRef.current = next;
            setPaths(next);
            onUpdateDrawing(next, captionRef.current);
          } else {
            const newStroke: StrokePath = {
              id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              d,
              color: currentColor,
              strokeWidth: activeWidth,
              opacity: activeOpacity,
            };

            const next = [...pathsRef.current, newStroke];
            pathsRef.current = next;
            setPaths(next);
            setRedoStack([]);
            onUpdateDrawing(next, captionRef.current);
          }

          currentPathRef.current = null;
          setCurrentStroke(null);
        },
      }),
    [currentColor, activeWidth, activeOpacity, tool, onUpdateDrawing]
  );

  const handleUndo = () => {
    if (paths.length === 0) return;
    const last = paths[paths.length - 1];
    const next = paths.slice(0, -1);
    setRedoStack((prev) => [...prev, [last]]);
    pathsRef.current = next;
    setPaths(next);
    onUpdateDrawing(next, captionRef.current);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    const nextRedo = redoStack.slice(0, -1);
    const next = [...paths, ...lastRedo];
    setRedoStack(nextRedo);
    pathsRef.current = next;
    setPaths(next);
    onUpdateDrawing(next, captionRef.current);
  };

  const handleClear = () => {
    if (paths.length === 0) return;
    setRedoStack((prev) => [...prev, paths]);
    pathsRef.current = [];
    setPaths([]);
    onUpdateDrawing([], captionRef.current);
  };

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
        },
      ]}
      className="my-1.5 w-full rounded-2xl border overflow-hidden transition-all group"
    >
      {/* Top Toolbar */}
      <View className="p-2.5 bg-light-appBg dark:bg-dark-raised border-b border-light-border/60 dark:border-white/5">
        <View className="flex-row items-center justify-between">
          {/* Tool Selectors */}
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => { onFocus?.(); setTool('pen'); }}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
              className={`p-1.5 rounded-lg ${
                tool === 'pen' ? 'bg-light-iconBg dark:bg-white' : 'bg-black/5 dark:bg-white/5'
              }`}
              accessibilityLabel="Pen Tool"
            >
              <PenTool 
                size={13} 
                color={tool === 'pen' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} 
              />
            </Pressable>

            <Pressable
              onPress={() => { onFocus?.(); setTool('highlighter'); }}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
              className={`p-1.5 rounded-lg ${
                tool === 'highlighter' ? 'bg-light-iconBg dark:bg-white' : 'bg-black/5 dark:bg-white/5'
              }`}
              accessibilityLabel="Highlighter Tool"
            >
              <Highlighter 
                size={13} 
                color={tool === 'highlighter' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} 
              />
            </Pressable>

            <Pressable
              onPress={() => { onFocus?.(); setTool('eraser'); }}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
              className={`p-1.5 rounded-lg ${
                tool === 'eraser' ? 'bg-light-iconBg dark:bg-white' : 'bg-black/5 dark:bg-white/5'
              }`}
              accessibilityLabel="Eraser Tool"
            >
              <Eraser 
                size={13} 
                color={tool === 'eraser' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} 
              />
            </Pressable>

            {/* Stroke Width Selector */}
            <View className="flex-row items-center ml-2 gap-1 border-l border-light-border/60 dark:border-white/10 pl-2">
              {[2, 4, 8].map((w) => (
                <Pressable
                  key={w}
                  onPress={() => { onFocus?.(); setStrokeWidth(w); }}
                  className={`w-5 h-5 rounded-md items-center justify-center ${
                    strokeWidth === w ? 'bg-black/10 dark:bg-white/20' : ''
                  }`}
                >
                  <View
                    style={{
                      width: w * 1.5,
                      height: w * 1.5,
                      borderRadius: (w * 1.5) / 2,
                      backgroundColor: isDark ? '#FFFFFF' : '#191919',
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Color Palette Swatches */}
          <View className="flex-row items-center gap-1.5">
            {PALETTE.map((item, idx) => {
              const color = isDark ? item.darkColor : item.lightColor;
              const isColorSelected = selectedColorIdx === idx;
              return (
                <Pressable
                  key={item.name}
                  onPress={() => { onFocus?.(); setSelectedColorIdx(idx); }}
                  style={{ backgroundColor: color }}
                  className={`w-4 h-4 rounded-full ${
                    isColorSelected ? 'border-2 border-black dark:border-white scale-125' : 'border border-black/20'
                  }`}
                />
              );
            })}
          </View>

          {/* Right Actions: Undo, Redo, Clear */}
          <View className="flex-row items-center gap-1">
          <Pressable
            onPress={handleUndo}
            disabled={paths.length === 0}
            className={`p-1 rounded opacity-60 active:opacity-70 hover:opacity-100 ${paths.length === 0 ? 'opacity-20' : ''}`}
            accessibilityLabel="Undo"
          >
            <RotateCcw size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>

          <Pressable
            onPress={handleRedo}
            disabled={redoStack.length === 0}
            className={`p-1 rounded opacity-60 active:opacity-70 hover:opacity-100 ${redoStack.length === 0 ? 'opacity-20' : ''}`}
            accessibilityLabel="Redo"
          >
            <RotateCw size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>

          <Pressable
            onPress={handleClear}
            disabled={paths.length === 0}
            className={`p-1 rounded opacity-60 active:opacity-70 hover:opacity-100 ${paths.length === 0 ? 'opacity-20' : ''}`}
            accessibilityLabel="Clear Canvas"
          >
            <Trash2 size={13} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>

      {/* Drawing Canvas Area */}
      <View
        {...panResponder.panHandlers}
        className="w-full h-[240px] bg-white dark:bg-[#121212] cursor-crosshair relative"
      >
        <Svg width="100%" height="100%">
          {/* Committed paths */}
          {paths.map((p) => (
            <Path
              key={p.id}
              d={p.d}
              stroke={p.color}
              strokeWidth={p.strokeWidth}
              strokeOpacity={p.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}

          {/* Current drawing path */}
          {currentStroke && (
            <Path
              d={currentStroke}
              stroke={currentColor}
              strokeWidth={activeWidth}
              strokeOpacity={activeOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>

        {paths.length === 0 && !currentStroke && (
          <View className="absolute inset-0 items-center justify-center pointer-events-none opacity-30">
            <Text className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted">
              Freehand sketch canvas. Draw with mouse or finger...
            </Text>
          </View>
        )}
      </View>

      {/* Editable Sketch Title / Caption for Search */}
      <View className="px-3 py-2 bg-light-appBg dark:bg-dark-raised border-t border-light-border/60 dark:border-white/5">
        <TextInput
          value={sketchCaption}
          onChangeText={(text) => {
            setSketchCaption(text);
            if (onUpdateCaption) {
              onUpdateCaption(text);
            } else {
              onUpdateDrawing(paths, text);
            }
          }}
          onFocus={onFocus}
          placeholder="Add sketch title or caption for search..."
          placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
          className="text-xs text-center italic text-light-textSecondary dark:text-dark-textSecondary p-0"
        />
      </View>
    </Pressable>
  );
};
