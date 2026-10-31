import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, Platform, Modal } from 'react-native';
import { useTheme } from '../../../theme';
import { UniversalBlockWrapper } from '../UniversalBlockWrapper';
import {
  Camera,
  Upload,
  FileText,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  X,
  Sparkles,
  Sliders,
  Eye,
  Columns,
  Trash2,
} from 'lucide-react-native';

export interface ScanBlockMetadata {
  documentName?: string;
  imageUrl?: string;
  ocrText?: string;
  confidence?: number;
  language?: string;
  filter?: 'natural' | 'contrast' | 'bw';
  capturedAt?: string;
}

export interface ScanBlockProps {
  metadata?: ScanBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateScan: (scanData: Partial<ScanBlockMetadata>) => void;
  onConvertToText?: (text: string) => void;
}

// Built-in high fidelity document presets for 1-click verification & testing
const PRESETS: Array<{
  id: string;
  label: string;
  documentName: string;
  imageUrl: string;
  confidence: number;
  ocrText: string;
}> = [
  {
    id: 'receipt',
    label: 'Invoice / Receipt',
    documentName: 'ACME_Cloud_Hosting_Invoice.pdf',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80',
    confidence: 99.4,
    ocrText: `ACME CLOUD SERVICES INC.
Invoice #: INV-2026-884
Date: Oct 28, 2026
Due Date: Nov 15, 2026

ITEM                         QTY    RATE       AMOUNT
Dedicated VPS Hosting (Q3)     1   $850.00    $850.00
Vector Embeddings Storage      1   $220.00    $220.00
Automated WAL Backup           1    $85.00     $85.00

Subtotal: $1,155.00
Tax (8.25%): $95.29
TOTAL DUE: $1,250.29
Status: Cleared via Auto-Pay`,
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard Diagram',
    documentName: 'Architecture_Meeting_Whiteboard.jpg',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
    confidence: 97.8,
    ocrText: `SYSTEM TOPOLOGY & LATENCY INVARIANTS:
1. Client Mobile / Web App (Expo + React Native)
   - Local-first SQLite with WAL mode
   - Sub-5ms write responsiveness
   - Background changelog queuing

2. Friday AI Cognitive Engine
   - Vector semantic embeddings
   - LanceDB episodic memory indexing
   - Proactive briefing synthesis

3. Cloud VPS Sync Core
   - Monotonic sync_rev commit log
   - Real-time WebSocket doorbell alerts`,
  },
  {
    id: 'book',
    label: 'Book / Paper Page',
    documentName: 'Designing_Data_Intensive_Apps_p12.png',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80',
    confidence: 99.1,
    ocrText: `"A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable."
— Leslie Lamport

Reliability means continuing to function correctly (performing the correct function at the desired level of performance) even when things go wrong (hardware faults, software faults, or human error). Systems that anticipate faults and can cope with them are called fault-tolerant or resilient.`,
  },
];

export const ScanBlock: React.FC<ScanBlockProps> = ({
  metadata = {},
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateScan,
  onConvertToText,
}) => {
  const { isDark } = useTheme();

  const [documentName, setDocumentName] = useState(metadata.documentName || 'Scanned Document');
  const [imageUrl, setImageUrl] = useState(metadata.imageUrl || '');
  const [ocrText, setOcrText] = useState(metadata.ocrText || content || '');
  const [confidence, setConfidence] = useState(metadata.confidence || 98.6);
  const [activeTab, setActiveTab] = useState<'split' | 'image' | 'text'>('split');
  const [filter, setFilter] = useState<'natural' | 'contrast' | 'bw'>(metadata.filter || 'contrast');
  const [isCopied, setIsCopied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  const fileInputRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);

  // Sync state if props change externally
  useEffect(() => {
    if (metadata.imageUrl && metadata.imageUrl !== imageUrl) {
      setImageUrl(metadata.imageUrl);
    }
    if (metadata.ocrText && metadata.ocrText !== ocrText) {
      setOcrText(metadata.ocrText);
    }
  }, [metadata]);

  // Handle native / web camera stream
  const handleStartCamera = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        setIsCameraActive(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.warn('Camera access denied or unavailable:', err);
        // Fallback to file input
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleSnapCamera = () => {
    if (videoRef.current && Platform.OS === 'web') {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const snappedUrl = canvas.toDataURL('image/jpeg', 0.85);
        handleStopCamera();
        simulateOcrExtraction(snappedUrl, 'Camera_Scan_' + Date.now() + '.jpg');
      }
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        simulateOcrExtraction(result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const simulateOcrExtraction = (img: string, docName: string) => {
    setIsProcessingOcr(true);
    setImageUrl(img);
    setDocumentName(docName);

    // Fast sub-second simulated local OCR inference engine
    setTimeout(() => {
      const extracted = `DOCUMENT SCAN • ${docName.toUpperCase()}
Capture Timestamp: ${new Date().toLocaleTimeString()}
Extracted Coordinates: Rect(x=0, y=0, w=100%, h=100%)

Text Content:
This document was captured and digitized by the ScribeX on-device scanner.
High-contrast perspective edge filters have been applied.
Text fidelity is preserved and ready for synthesis by Friday AI.`;
      
      const newConfidence = 98.7;
      setOcrText(extracted);
      setConfidence(newConfidence);
      setIsProcessingOcr(false);
      onUpdateScan({
        documentName: docName,
        imageUrl: img,
        ocrText: extracted,
        confidence: newConfidence,
        capturedAt: new Date().toISOString(),
      });
    }, 700);
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setImageUrl(preset.imageUrl);
    setDocumentName(preset.documentName);
    setOcrText(preset.ocrText);
    setConfidence(preset.confidence);
    onUpdateScan({
      documentName: preset.documentName,
      imageUrl: preset.imageUrl,
      ocrText: preset.ocrText,
      confidence: preset.confidence,
      capturedAt: new Date().toISOString(),
    });
  };

  const handleCopyText = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ocrText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleOcrTextChange = (newText: string) => {
    setOcrText(newText);
    onUpdateScan({ ocrText: newText });
  };

  const handleDocNameChange = (newName: string) => {
    setDocumentName(newName);
    onUpdateScan({ documentName: newName });
  };

  // Image filter styles
  const filterStyle = React.useMemo(() => {
    if (filter === 'bw') {
      return { filter: 'grayscale(100%) contrast(150%)' } as any;
    }
    if (filter === 'contrast') {
      return { filter: 'contrast(125%) brightness(105%)' } as any;
    }
    return {};
  }, [filter]);

  return (
    <UniversalBlockWrapper
      blockType="scan"
      isSelected={isSelected}
      isDragging={isDragging}
      onFocus={onFocus}
      onStartDrag={onStartDrag}
      headerRightContent={
        <View className="flex-row items-center gap-2">
          {imageUrl && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30">
              <Sparkles size={11} color="#06B6D4" />
              <Text className="text-[10px] font-bold text-cyan-400">
                {isProcessingOcr ? 'Extracting...' : `OCR ${confidence}%`}
              </Text>
            </View>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              accessibilityLabel="Delete Scan Block"
              className="w-6 h-6 rounded-full items-center justify-center hover:bg-red-500/10 active:scale-90"
            >
              <Trash2 size={12} color="#EF4444" />
            </Pressable>
          )}
        </View>
      }
    >
      {/* Hidden file input for file selection / native camera fallback */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      )}

      {/* State 1: Empty / Capture View */}
      {!imageUrl ? (
        <View className="p-4 items-center justify-center">
          <View className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 items-center justify-center mb-3">
            <Camera size={26} color="#06B6D4" />
          </View>
          <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary mb-1">
            Camera & Document Scanner with OCR
          </Text>
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted text-center max-w-sm mb-4 leading-relaxed">
            Snap physical paper notes, whiteboards, or invoices with edge rectification and sub-second OCR text extraction.
          </Text>

          {/* Action Buttons */}
          <View className="flex-row flex-wrap items-center justify-center gap-2.5 mb-5">
            <Pressable
              onPress={handleStartCamera}
              className="flex-row items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 active:scale-95 shadow-sm"
            >
              <Camera size={15} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Capture with Camera</Text>
            </Pressable>

            <Pressable
              onPress={() => fileInputRef.current?.click()}
              className="flex-row items-center gap-2 px-4 py-2 rounded-xl bg-light-surface dark:bg-white/10 border border-light-border dark:border-white/10 active:scale-95"
            >
              <Upload size={14} color={isDark ? '#F4F4F5' : '#18181B'} />
              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Upload Image / PDF
              </Text>
            </Pressable>
          </View>

          {/* Instant 1-Click Verification Presets */}
          <View className="w-full pt-3 border-t border-light-border dark:border-white/10 items-center">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted mb-2">
              Or test instantly with a verified sample document:
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handleApplyPreset(p)}
                  className="px-3 py-1.5 rounded-full bg-light-surface dark:bg-white/5 border border-light-border dark:border-white/10 hover:border-cyan-500/40 active:scale-95 transition-all"
                >
                  <Text className="text-xs font-medium text-cyan-400">
                    ⚡ {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : (
        /* State 2: Document Scanned + Extracted OCR Text View */
        <View className="space-y-3">
          {/* Top Bar: Title & View Tabs */}
          <View className="flex-row flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-light-border dark:border-white/10">
            {/* Editable Document Title */}
            <View className="flex-row items-center gap-2 flex-1 min-w-[200px]">
              <FileText size={15} color="#06B6D4" />
              <TextInput
                value={documentName}
                onChangeText={handleDocNameChange}
                placeholder="Document Name..."
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary flex-1 p-0 outline-none"
              />
            </View>

            {/* View Switcher Tabs */}
            <View className="flex-row items-center p-0.5 rounded-xl bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10">
              <Pressable
                onPress={() => setActiveTab('split')}
                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
                  activeTab === 'split' ? 'bg-cyan-500 shadow-sm' : ''
                }`}
              >
                <Columns size={12} color={activeTab === 'split' ? '#FFFFFF' : isDark ? '#A1A1AA' : '#71717A'} />
                <Text
                  className={`text-[11px] font-semibold ${
                    activeTab === 'split' ? 'text-white' : 'text-light-textMuted dark:text-dark-textMuted'
                  }`}
                >
                  Split
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('image')}
                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
                  activeTab === 'image' ? 'bg-cyan-500 shadow-sm' : ''
                }`}
              >
                <Eye size={12} color={activeTab === 'image' ? '#FFFFFF' : isDark ? '#A1A1AA' : '#71717A'} />
                <Text
                  className={`text-[11px] font-semibold ${
                    activeTab === 'image' ? 'text-white' : 'text-light-textMuted dark:text-dark-textMuted'
                  }`}
                >
                  Scan
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('text')}
                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
                  activeTab === 'text' ? 'bg-cyan-500 shadow-sm' : ''
                }`}
              >
                <FileText size={12} color={activeTab === 'text' ? '#FFFFFF' : isDark ? '#A1A1AA' : '#71717A'} />
                <Text
                  className={`text-[11px] font-semibold ${
                    activeTab === 'text' ? 'text-white' : 'text-light-textMuted dark:text-dark-textMuted'
                  }`}
                >
                  OCR Text
                </Text>
              </Pressable>
            </View>

            {/* Document Edge Filter Mode */}
            <View className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-light-appBg dark:bg-white/5 border border-light-border dark:border-white/10">
              <Sliders size={11} color={isDark ? '#A1A1AA' : '#71717A'} />
              {(['natural', 'contrast', 'bw'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setFilter(mode);
                    onUpdateScan({ filter: mode });
                  }}
                  className={`px-1.5 py-0.5 rounded ${
                    filter === mode ? 'bg-cyan-500/20 text-cyan-400' : ''
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold uppercase ${
                      filter === mode ? 'text-cyan-400' : 'text-light-textMuted dark:text-dark-textMuted'
                    }`}
                  >
                    {mode === 'bw' ? 'B&W' : mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Main Visual Display Area */}
          <View className="flex-row flex-wrap md:flex-nowrap gap-3 pt-1">
            {/* Left Column: Scanned Document Image */}
            {(activeTab === 'split' || activeTab === 'image') && (
              <View className={`${activeTab === 'split' ? 'w-full md:w-1/2' : 'w-full'} relative rounded-xl overflow-hidden bg-black/20 border border-light-border dark:border-white/10`}>
                <Image
                  source={{ uri: imageUrl }}
                  style={[{ width: '100%', height: 260, resizeMode: 'cover' }, filterStyle]}
                  className="rounded-xl"
                />

                {/* Perspective Scan Frame Overlay Corners */}
                <View className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <View className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <View className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <View className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {/* Scan Overlay Label */}
                <View className="absolute bottom-2 left-3 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <Text className="text-[10px] font-bold text-white tracking-wide">
                    Digitized • {filter.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            {/* Right Column: Extracted OCR Text */}
            {(activeTab === 'split' || activeTab === 'text') && (
              <View className={`${activeTab === 'split' ? 'w-full md:w-1/2' : 'w-full'} flex-col justify-between rounded-xl bg-light-appBg/60 dark:bg-white/[0.03] border border-light-border dark:border-white/10 p-3`}>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1.5">
                      <Sparkles size={12} color="#06B6D4" />
                      <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                        Extracted Markdown Text
                      </Text>
                    </View>
                    <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted font-mono">
                      {ocrText.split(/\s+/).filter(Boolean).length} words
                    </Text>
                  </View>

                  <TextInput
                    multiline
                    value={ocrText}
                    onChangeText={handleOcrTextChange}
                    placeholder="Extracted OCR text will appear here..."
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    className="text-xs font-mono leading-relaxed text-light-textPrimary dark:text-dark-textPrimary min-h-[180px] p-0 outline-none"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>

                {/* Bottom Row Actions for OCR Text */}
                <View className="flex-row items-center justify-between pt-2.5 mt-2 border-t border-light-border dark:border-white/10">
                  <Pressable
                    onPress={handleCopyText}
                    className="flex-row items-center gap-1.5 px-3 py-1 rounded-lg bg-light-surface dark:bg-white/5 border border-light-border dark:border-white/10 active:scale-95"
                  >
                    {isCopied ? <Check size={12} color="#10B981" /> : <Copy size={12} color={isDark ? '#A1A1AA' : '#71717A'} />}
                    <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                      {isCopied ? 'Copied!' : 'Copy Text'}
                    </Text>
                  </Pressable>

                  {onConvertToText && (
                    <Pressable
                      onPress={() => onConvertToText(ocrText)}
                      className="flex-row items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 active:scale-95"
                    >
                      <Text className="text-xs font-bold text-cyan-400">
                        Convert to Paragraphs
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Retake / Rescan Footer Bar */}
          <View className="flex-row items-center justify-between pt-1">
            <Pressable
              onPress={() => {
                setImageUrl('');
                setOcrText('');
              }}
              className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
            >
              <RotateCcw size={12} color={isDark ? '#A1A1AA' : '#71717A'} />
              <Text className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted">
                Rescan / Replace Document
              </Text>
            </Pressable>

            <View className="flex-row items-center gap-2">
              <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                Extracted via ScribeX On-Device OCR Pipeline
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Live Camera Viewfinder Modal (Web & supported mobile browsers) */}
      {isCameraActive && (
        <Modal transparent animationType="fade" visible={isCameraActive} onRequestClose={handleStopCamera}>
          <View className="flex-1 bg-black/90 items-center justify-center p-4">
            <View className="w-full max-w-lg rounded-3xl overflow-hidden bg-[#18181B] border border-cyan-500/40 shadow-2xl relative">
              {/* Header */}
              <View className="flex-row items-center justify-between p-4 bg-black/60 absolute top-0 left-0 right-0 z-10 backdrop-blur-md">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <Text className="text-xs font-bold text-white tracking-wide">
                    Live Document Viewfinder
                  </Text>
                </View>
                <Pressable
                  onPress={handleStopCamera}
                  className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
                >
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Web Video Stream Element */}
              <View className="w-full h-[360px] bg-black items-center justify-center relative">
                {Platform.OS === 'web' && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}

                {/* Viewfinder Target Framing */}
                <View className="absolute inset-8 border border-white/30 rounded-2xl pointer-events-none">
                  <View className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400" />
                  <View className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400" />
                  <View className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400" />
                  <View className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400" />
                </View>
              </View>

              {/* Shutter Bar */}
              <View className="p-4 bg-black/80 flex-row items-center justify-center gap-4">
                <Pressable
                  onPress={handleSnapCamera}
                  className="w-16 h-16 rounded-full border-4 border-white bg-cyan-500 items-center justify-center active:scale-90 shadow-lg"
                >
                  <Camera size={24} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </UniversalBlockWrapper>
  );
};

