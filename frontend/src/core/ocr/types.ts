export type OcrFilterMode = 'natural' | 'contrast' | 'bw';

export interface OcrProgressInfo {
  status: string;
  progress: number; // 0 to 1
}

export interface OcrExtractionOptions {
  filter?: OcrFilterMode;
  language?: string; // e.g. 'eng', 'hin+eng'
  maxDimension?: number;
  maxPages?: number;
  onProgress?: (info: OcrProgressInfo) => void;
}

export interface OcrPageResult {
  pageIndex: number;
  text: string;
  confidence?: number;
  thumbnailUrl?: string;
}

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  language?: string;
  pageCount: number;
  processedImageUrl?: string;
  pages?: OcrPageResult[];
  filter?: OcrFilterMode;
}

export interface IOcrEngine {
  extractFromImage(
    uriOrDataUrl: string,
    options?: OcrExtractionOptions
  ): Promise<OcrExtractionResult>;

  extractFromPdf(
    uriOrDataUrl: string,
    options?: OcrExtractionOptions
  ): Promise<OcrExtractionResult>;

  preprocessImage(
    uriOrDataUrl: string,
    filter: OcrFilterMode,
    maxDimension?: number
  ): Promise<string>;
}

