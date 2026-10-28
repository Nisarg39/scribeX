import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { 
  Play, 
  Pause, 
  Mic, 
  Square, 
  Sparkles, 
  Volume2
} from 'lucide-react-native';

interface AudioBlockProps {
  assetId?: string;
  durationSec?: number;
  transcription?: string;
  isSelected?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateMetadata: (meta: { assetId?: string; durationSec: number; transcription?: string }) => void;
}

const SAMPLE_WAVEFORM = [
  25, 45, 80, 60, 30, 95, 70, 40, 85, 90, 55, 35, 75, 100, 65, 45, 90, 80, 30, 60,
  70, 45, 85, 95, 40, 50, 75, 60, 30, 65, 85, 90, 45, 30, 80, 70, 55, 40, 60, 25,
];

export const AudioBlock: React.FC<AudioBlockProps> = ({
  durationSec = 94,
  transcription = '',
  isSelected = false,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
  onUpdateMetadata,
}) => {
  const { isDark } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [textTranscript, setTextTranscript] = useState(transcription);

  const timerRef = useRef<any>(null);

  // Playback timer simulation
  useEffect(() => {
    let playInterval: any;
    if (isPlaying) {
      playInterval = setInterval(() => {
        setPlaybackPos((prev) => {
          if (prev >= durationSec) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / speed);
    }
    return () => clearInterval(playInterval);
  }, [isPlaying, durationSec, speed]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordTimer(0);
      timerRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleStopRecording = () => {
    setIsRecording(false);
    const newDuration = Math.max(recordTimer, 5);
    onUpdateMetadata({
      durationSec: newDuration,
      transcription: textTranscript || 'Voice recording processed. Key topics extracted.',
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = durationSec > 0 ? (playbackPos / durationSec) * 100 : 0;

  return (
    <View>
      {/* Top Header: Recording Status or Audio Title */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-full bg-note-cyan/20 items-center justify-center">
            <Volume2 size={16} color={NoteColors.cyan} />
          </View>
          <View>
            <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
              {isRecording ? 'Recording Voice Memo...' : 'Voice Note / Audio Clip'}
            </Text>
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
              {isRecording ? formatTime(recordTimer) : `${formatTime(playbackPos)} / ${formatTime(durationSec)}`}
            </Text>
          </View>
        </View>

        {/* Speed Toggle & Record Button */}
        <View className="flex-row items-center gap-1.5">
          {!isRecording && (
            <Pressable
              onPress={() => {
                const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
                setSpeed(nextSpeed);
              }}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
            >
              <Text className="text-[10px] font-bold text-light-textSecondary dark:text-dark-textSecondary">
                {speed}x
              </Text>
            </Pressable>
          )}

          {isRecording ? (
            <Pressable
              onPress={handleStopRecording}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 animate-pulse"
            >
              <Square size={11} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setIsRecording(true)}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
            >
              <Mic size={12} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Record
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Waveform Bar Visualizer */}
      <View className="flex-row items-center justify-between h-12 my-2 px-1 gap-[2px]">
        {SAMPLE_WAVEFORM.map((heightPct, idx) => {
          const barPct = (idx / SAMPLE_WAVEFORM.length) * 100;
          const isPassed = barPct <= progressPct;
          return (
            <View
              key={idx}
              style={{
                height: `${Math.max(15, heightPct)}%`,
                backgroundColor: isPassed ? NoteColors.cyan : isDark ? '#333333' : '#E0E0E0',
              }}
              className="flex-1 rounded-full"
            />
          );
        })}
      </View>

      {/* Playback Controls Ribbon */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-light-border/40 dark:border-white/5">
        <Pressable
          onPress={() => setIsPlaying(!isPlaying)}
          disabled={isRecording}
          style={({ pressed }) => [
            { backgroundColor: NoteColors.cyan },
            pressed ? { transform: [{ scale: 0.9 }] } : undefined,
          ]}
          className="w-9 h-9 rounded-full items-center justify-center"
        >
          {isPlaying ? (
            <Pause size={16} color="#191919" fill="#191919" />
          ) : (
            <Play size={16} color="#191919" fill="#191919" className="ml-0.5" />
          )}
        </Pressable>

        {/* Friday AI Transcription Badge & Field */}
        <View className="flex-1 ml-3">
          <View className="flex-row items-center gap-1 mb-0.5">
            <Sparkles size={11} color={NoteColors.lavender} />
            <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider">
              Friday AI Whisper Transcript
            </Text>
          </View>
          <TextInput
            value={textTranscript}
            onFocus={onFocus}
            onChangeText={(text) => {
              setTextTranscript(text);
              onUpdateMetadata({ durationSec, transcription: text });
            }}
            placeholder="Auto-transcription appears here or type notes..."
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="text-xs text-light-textSecondary dark:text-dark-textSecondary py-0"
          />
        </View>
      </View>
    </View>
  );
};
