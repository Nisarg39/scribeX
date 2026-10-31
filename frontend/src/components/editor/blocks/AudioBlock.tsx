import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { Audio as ExpoAudio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme, NoteColors } from '../../../theme';
import { 
  Play, 
  Pause, 
  Mic, 
  Square, 
  Sparkles, 
  Volume2,
  RotateCcw,
  Copy,
  Check,
  Download,
  FileText,
  Trash2,
  AlertCircle
} from 'lucide-react-native';

export interface AudioBlockProps {
  audioUrl?: string;
  assetId?: string;
  durationSec?: number;
  transcription?: string;
  waveform?: number[];
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateContent?: (content: string) => void;
  onUpdateMetadata: (meta: {
    assetId?: string;
    durationSec: number;
    transcription?: string;
    waveform?: number[];
    mimeType?: string;
    url?: string;
  }) => void;
  onInsertAfter?: (type: any, content: string, metadata?: Record<string, any>) => void;
}

const DEFAULT_WAVEFORM = [
  25, 45, 80, 60, 30, 95, 70, 40, 85, 90, 55, 35, 75, 100, 65, 45, 90, 80, 30, 60,
  70, 45, 85, 95, 40, 50, 75, 60, 30, 65, 85, 90, 45, 30, 80, 70, 55, 40, 60, 25,
];

export const AudioBlock: React.FC<AudioBlockProps> = ({
  audioUrl = '',
  assetId,
  durationSec = 0,
  transcription = '',
  waveform = DEFAULT_WAVEFORM,
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateContent,
  onUpdateMetadata,
  onInsertAfter,
}) => {
  const { isDark } = useTheme();

  // Internal audio state
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>(audioUrl);
  const [currentDuration, setCurrentDuration] = useState<number>(durationSec);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackPos, setPlaybackPos] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [textTranscript, setTextTranscript] = useState<string>(transcription);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState<boolean>(!!transcription);
  const [copied, setCopied] = useState<boolean>(false);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordTimer, setRecordTimer] = useState<number>(0);
  const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for audio hardware and playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const nativeSoundRef = useRef<ExpoAudio.Sound | null>(null);
  const nativeRecordingRef = useRef<ExpoAudio.Recording | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const recordIntervalRef = useRef<any>(null);
  const recordStartRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>(transcription);

  // Keep internal state aligned with props
  useEffect(() => {
    if (audioUrl && audioUrl !== currentAudioUrl) {
      setCurrentAudioUrl(audioUrl);
    }
  }, [audioUrl]);

  useEffect(() => {
    if (durationSec !== undefined && durationSec !== currentDuration && durationSec > 0) {
      setCurrentDuration(durationSec);
    }
  }, [durationSec]);

  useEffect(() => {
    if (transcription && transcription !== textTranscript) {
      setTextTranscript(transcription);
      liveTranscriptRef.current = transcription;
      if (!showTranscriptDrawer) setShowTranscriptDrawer(true);
    }
  }, [transcription]);

  // Setup HTML5 Audio element on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const audio = new Audio();
      audioElementRef.current = audio;

      const handleTimeUpdate = () => {
        setPlaybackPos(audio.currentTime);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setPlaybackPos(0);
      };

      const handlePause = () => {
        setIsPlaying(false);
      };

      const handleLoadedMetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          const detected = Math.round(audio.duration);
          if (detected > 0) {
            setCurrentDuration(detected);
            onUpdateMetadata({
              durationSec: detected,
              transcription: textTranscript,
            });
          }
        }
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioElementRef.current = null;
      };
    }
  }, []);

  // Cleanup active streams on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (nativeSoundRef.current) {
        nativeSoundRef.current.unloadAsync().catch(() => {});
      }
      if (nativeRecordingRef.current) {
        nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // Helper to pick optimal recording MIME type
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  // Start real native audio recording
  const handleStartRecording = async () => {
    onFocus?.();
    setErrorMessage(null);
    setInterimTranscript('');
    liveTranscriptRef.current = '';
    setTextTranscript('');

    // Stop existing playback if any
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
    if (nativeSoundRef.current) {
      await nativeSoundRef.current.stopAsync().catch(() => {});
      setIsPlaying(false);
    }

    // Native iOS & Android recording via expo-av
    if (Platform.OS !== 'web') {
      try {
        const perm = await ExpoAudio.requestPermissionsAsync();
        if (!perm.granted) {
          setErrorMessage('Microphone permission denied on mobile device.');
          return;
        }
        await ExpoAudio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await ExpoAudio.Recording.createAsync(
          ExpoAudio.RecordingOptionsPresets.HIGH_QUALITY,
          (status) => {
            if (status.isRecording && status.metering !== undefined) {
              const normalized = Math.max(0, Math.min(100, Math.round(((status.metering + 60) / 60) * 100)));
              setLiveAudioLevel(normalized);
            }
          },
          150
        );
        nativeRecordingRef.current = recording;
        recordStartRef.current = Date.now();
        setRecordTimer(0);
        setIsRecording(true);
        recordIntervalRef.current = setInterval(() => {
          setRecordTimer(Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000)));
        }, 200);
      } catch (nativeErr: any) {
        setErrorMessage(`Mobile microphone error: ${nativeErr?.message || 'Unable to start recording.'}`);
      }
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Audio recording is not supported in this environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setLiveAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization setup warning:', audioCtxErr);
      }

      // Concurrently run SpeechRecognition for live speech transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let finalChunk = '';
            let currentInterim = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalChunk += res[0].transcript;
              } else {
                currentInterim += res[0].transcript;
              }
            }

            if (finalChunk.trim()) {
              liveTranscriptRef.current = liveTranscriptRef.current
                ? `${liveTranscriptRef.current} ${finalChunk.trim()}`
                : finalChunk.trim();
              setTextTranscript(liveTranscriptRef.current);
              setInterimTranscript('');
            } else if (currentInterim.trim()) {
              setInterimTranscript(currentInterim.trim());
            }
          };

          recognition.onerror = (e: any) => {
            console.log('Speech recognition event:', e?.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.warn('SpeechRecognition initialization error:', recErr);
        }
      }

      // Initialize MediaRecorder
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop audio tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        // Stop speech recognition
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (_) {}
          recognitionRef.current = null;
        }
        // Cancel animation frame and close audio context
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch (_) {}
          audioContextRef.current = null;
        }

        const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: recordedMime });
        
        // Zero-latency object URL for instant local playback
        const objectUrl = URL.createObjectURL(audioBlob);
        setCurrentAudioUrl(objectUrl);

        const totalSecs = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        setCurrentDuration(totalSecs);
        setPlaybackPos(0);

        // Convert to base64 Data URL so audio persists with the note in markdown/storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUri = reader.result as string;
          const capturedTranscript = (liveTranscriptRef.current || interimTranscript || 'Voice recording processed.').trim();
          
          setTextTranscript(capturedTranscript);
          setShowTranscriptDrawer(true);

          onUpdateContent?.(dataUri);
          onUpdateMetadata({
            durationSec: totalSecs,
            transcription: capturedTranscript,
            waveform: DEFAULT_WAVEFORM,
            mimeType: recordedMime,
            url: dataUri,
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(100);
      recordStartRef.current = Date.now();
      setRecordTimer(0);
      setIsRecording(true);

      recordIntervalRef.current = setInterval(() => {
        setRecordTimer(Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000)));
      }, 200);

    } catch (err: any) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone blocked. Please click "Allow" in Chrome to enable voice recording.');
      } else {
        setErrorMessage(`Microphone error: ${err.message || 'Unable to access audio device.'}`);
      }
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (Platform.OS !== 'web' && nativeRecordingRef.current) {
      try {
        const rec = nativeRecordingRef.current;
        nativeRecordingRef.current = null;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI() || '';
        const totalSecs = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        setCurrentAudioUrl(uri);
        setCurrentDuration(totalSecs);
        setPlaybackPos(0);
        const mobileTranscriptNote =
          textTranscript.trim() ||
          'Native voice note captured via expo-av. (Cloud Whisper STT transcription will be fixed later when backend is setup)';
        setTextTranscript(mobileTranscriptNote);
        setShowTranscriptDrawer(true);
        onUpdateContent?.(uri);
        onUpdateMetadata({
          durationSec: totalSecs,
          transcription: mobileTranscriptNote,
          waveform: DEFAULT_WAVEFORM,
          mimeType: 'audio/m4a',
          url: uri,
        });
      } catch (err) {
        console.warn('Error stopping native recording:', err);
      }
      setIsRecording(false);
      setLiveAudioLevel(0);
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setLiveAudioLevel(0);
  };

  // Play / Pause toggle
  const handleTogglePlay = async () => {
    onFocus?.();
    if (!currentAudioUrl) {
      // If no audio recorded yet, trigger recording directly
      handleStartRecording();
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        if (nativeSoundRef.current) {
          if (isPlaying) {
            await nativeSoundRef.current.pauseAsync();
            setIsPlaying(false);
          } else {
            await nativeSoundRef.current.setRateAsync(speed, true);
            await nativeSoundRef.current.playAsync();
            setIsPlaying(true);
          }
          return;
        }
        const { sound } = await ExpoAudio.Sound.createAsync(
          { uri: currentAudioUrl },
          { shouldPlay: true, rate: speed, shouldCorrectPitch: true },
          (status) => {
            if (!status.isLoaded) return;
            setPlaybackPos((status.positionMillis || 0) / 1000);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPos(0);
            }
          }
        );
        nativeSoundRef.current = sound;
        setIsPlaying(true);
      } catch (err) {
        console.warn('Native audio playback error:', err);
        setErrorMessage('Playback error on mobile device.');
      }
      return;
    }

    const audio = audioElementRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.src !== currentAudioUrl) {
        audio.src = currentAudioUrl;
      }
      audio.playbackRate = speed;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
        setErrorMessage('Playback error: Audio format not supported or file missing.');
      });
    }
  };

  // Seek on waveform bar click
  const handleSeek = (index: number) => {
    if (!currentAudioUrl || currentDuration <= 0) return;
    const seekPct = index / (waveform.length - 1);
    const seekTime = seekPct * currentDuration;
    if (Platform.OS !== 'web' && nativeSoundRef.current) {
      nativeSoundRef.current.setPositionAsync(seekTime * 1000).catch(() => {});
      setPlaybackPos(seekTime);
      return;
    }
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = seekTime;
    setPlaybackPos(seekTime);
  };

  // Cycle speed (1x -> 1.25x -> 1.5x -> 2x)
  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (Platform.OS !== 'web' && nativeSoundRef.current) {
      nativeSoundRef.current.setRateAsync(nextSpeed, true).catch(() => {});
    }
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextSpeed;
    }
  };

  // Download recorded audio clip
  const handleDownload = async () => {
    if (!currentAudioUrl) return;
    if (Platform.OS !== 'web') {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(currentAudioUrl).catch(() => {});
      }
      return;
    }
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = currentAudioUrl;
    a.download = `voice-note-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = async () => {
    const textToCopy = textTranscript.trim();
    if (!textToCopy) return;
    if (Platform.OS !== 'web') {
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Convert transcript to markdown paragraph block
  const handleInsertAsParagraph = () => {
    const textToInsert = textTranscript.trim();
    if (textToInsert && onInsertAfter) {
      onInsertAfter('paragraph', textToInsert);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = currentDuration > 0 ? (playbackPos / currentDuration) * 100 : 0;
  const hasAudio = !!currentAudioUrl;

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.75)' : '#FFFFFF',
        },
      ]}
      className="my-2 w-full rounded-2xl border p-3.5 transition-all group"
    >
      {/* Top Header Ribbon */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2.5">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              isRecording
                ? 'bg-rose-500/20'
                : hasAudio
                ? 'bg-cyan-500/20'
                : 'bg-zinc-500/20'
            }`}
          >
            {isRecording ? (
              <View className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            ) : (
              <Volume2 size={16} color={hasAudio ? NoteColors.cyan : (isDark ? '#9CA3AF' : '#6B7280')} />
            )}
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                {isRecording ? 'Recording Voice Memo...' : 'Voice Note / Audio Clip'}
              </Text>
              {isRecording && (
                <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/20">
                  <View className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <Text className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                    REC
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted font-mono">
              {isRecording
                ? formatTime(recordTimer)
                : hasAudio
                ? `${formatTime(playbackPos)} / ${formatTime(currentDuration)}`
                : 'Ready to record (00:00)'}
            </Text>
          </View>
        </View>

        {/* Action Controls Header */}
        <View className="flex-row items-center gap-1.5">
          {/* Speed Toggle (only when audio exists and not recording) */}
          {hasAudio && !isRecording && (
            <Pressable
              onPress={handleCycleSpeed}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
            >
              <Text className="text-[10px] font-bold text-light-textSecondary dark:text-dark-textSecondary">
                {speed}x
              </Text>
            </Pressable>
          )}

          {/* Download Audio Button */}
          {hasAudio && !isRecording && (
            <Pressable
              onPress={handleDownload}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="p-1.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
              accessibilityLabel="Download Audio"
            >
              <Download size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </Pressable>
          )}

          {/* Record / Stop Button */}
          {isRecording ? (
            <Pressable
              onPress={handleStopRecording}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 shadow-md shadow-rose-600/30"
            >
              <Square size={11} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Stop</Text>
            </Pressable>
          ) : hasAudio ? (
            <Pressable
              onPress={handleStartRecording}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
            >
              <RotateCcw size={11} color={isDark ? '#F7F7F7' : '#171717'} />
              <Text className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Re-record
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleStartRecording}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600"
            >
              <Mic size={12} color="#FFFFFF" />
              <Text className="text-[11px] font-bold text-white">Record</Text>
            </Pressable>
          )}

          {/* Delete Block */}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
              className="p-1.5 rounded-full hover:bg-rose-500/10 ml-0.5"
            >
              <Trash2 size={13} color={isDark ? '#71717A' : '#A1A1AA'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Error Message Alert */}
      {errorMessage && (
        <View className="mb-2.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center gap-2">
          <AlertCircle size={14} color="#F43F5E" />
          <Text className="text-xs text-rose-400 flex-1">{errorMessage}</Text>
        </View>
      )}

      {/* Waveform Bar Visualizer */}
      <View className="flex-row items-center justify-between h-12 my-2 px-1 gap-[2px]">
        {waveform.map((heightPct, idx) => {
          const barPct = (idx / (waveform.length - 1)) * 100;
          const isPassed = barPct <= progressPct && hasAudio;

          // Reactive dynamic height during recording
          let dynamicHeight = heightPct;
          if (isRecording) {
            const waveOffset = Math.sin((idx * 0.4) + (Date.now() / 150));
            dynamicHeight = Math.max(15, Math.min(100, (liveAudioLevel * 0.7) + (waveOffset * 30)));
          }

          return (
            <Pressable
              key={idx}
              onPress={() => handleSeek(idx)}
              disabled={isRecording || !hasAudio}
              style={{
                height: `${Math.max(15, dynamicHeight)}%`,
                backgroundColor: isRecording
                  ? (liveAudioLevel > 15 ? '#F43F5E' : isDark ? '#3F3F46' : '#D1D5DB')
                  : isPassed
                  ? NoteColors.cyan
                  : isDark
                  ? '#27272A'
                  : '#E4E4E7',
              }}
              className="flex-1 rounded-full transition-all"
            />
          );
        })}
      </View>

      {/* Playback & Controls Ribbon */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-light-border/40 dark:border-white/5">
        <Pressable
          onPress={handleTogglePlay}
          disabled={isRecording}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : undefined)}
          className={`flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full ${
            hasAudio
              ? 'bg-light-iconBg dark:bg-white'
              : 'bg-rose-600'
          }`}
        >
          {isPlaying ? (
            <Pause size={12} color={isDark ? '#111111' : '#FFFFFF'} />
          ) : hasAudio ? (
            <Play
              size={12}
              color={isDark ? '#111111' : '#FFFFFF'}
              fill={isDark ? '#111111' : '#FFFFFF'}
            />
          ) : (
            <Mic size={12} color="#FFFFFF" />
          )}
          <Text
            className={`text-xs font-bold ${
              hasAudio ? 'text-white dark:text-[#111111]' : 'text-white'
            }`}
          >
            {isPlaying ? 'Pause' : hasAudio ? 'Play Audio' : 'Start Recording'}
          </Text>
        </Pressable>

        {/* Transcription drawer toggle */}
        <Pressable
          onPress={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/5"
        >
          <Sparkles size={11} color={textTranscript ? NoteColors.lavender : (isDark ? '#71717A' : '#A1A1AA')} />
          <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
            {textTranscript ? 'Transcribed' : 'AI Speech to Text'}
          </Text>
        </Pressable>
      </View>

      {/* Live Interim Transcript Bubble while recording */}
      {isRecording && interimTranscript ? (
        <View className="mt-2.5 p-2 rounded-xl bg-black/[0.03] dark:bg-black/30 border border-light-border/30 dark:border-white/5">
          <Text className="text-[11px] italic text-light-textMuted dark:text-dark-textMuted">
            "{interimTranscript}..."
          </Text>
        </View>
      ) : null}

      {/* Transcription Drawer */}
      {showTranscriptDrawer && (
        <View className="mt-3 p-3 rounded-xl bg-black/[0.02] dark:bg-black/30 border border-light-border/30 dark:border-white/5">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={11} color={NoteColors.lavender} />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
                Speech Transcription
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              {textTranscript ? (
                <>
                  <Pressable
                    onPress={handleCopyTranscript}
                    className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-light-appBg dark:bg-dark-raised border border-light-border/50 dark:border-white/10"
                  >
                    {copied ? (
                      <Check size={10} color="#10B981" />
                    ) : (
                      <Copy size={10} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    )}
                    <Text className="text-[9px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>

                  {onInsertAfter && (
                    <Pressable
                      onPress={handleInsertAsParagraph}
                      className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-light-appBg dark:bg-dark-raised border border-light-border/50 dark:border-white/10"
                    >
                      <FileText size={10} color={NoteColors.cyan} />
                      <Text className="text-[9px] font-semibold text-cyan-400">
                        Insert as Text
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : null}
            </View>
          </View>

          <TextInput
            multiline
            value={textTranscript}
            onChangeText={(t) => {
              setTextTranscript(t);
              liveTranscriptRef.current = t;
              onUpdateMetadata({
                durationSec: currentDuration,
                transcription: t,
              });
            }}
            placeholder={isRecording ? 'Listening and transcribing speech...' : 'No transcript available. Spoken words will appear here.'}
            placeholderTextColor={isDark ? '#52525B' : '#9CA3AF'}
            className="text-[11px] leading-relaxed text-light-textPrimary dark:text-dark-textPrimary p-0"
          />
        </View>
      )}
    </Pressable>
  );
};
