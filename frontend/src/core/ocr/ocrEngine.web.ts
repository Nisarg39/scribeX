import * as pdfjsLib from 'pdfjs-dist';
import { createWorker, Worker } from 'tesseract.js';
import {
  IOcrEngine,
  OcrExtractionOptions,
  OcrExtractionResult,
  OcrFilterMode,
  OcrPageResult,
} from './types';

// Configure PDF.js worker for browser environments
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

class WebOcrEngine implements IOcrEngine {
  private worker: Worker | null = null;
  private workerInitPromise: Promise<Worker> | null = null;
  private currentLanguage: string = 'eng';
  private activeProgressCallback: ((status: string, progress: number) => void) | null = null;

  /**
   * Initializes or returns a cached singleton Tesseract Web Worker.
   */
  private async getWorker(language: string = 'eng'): Promise<Worker> {
    if (this.worker && this.currentLanguage === language) {
      return this.worker;
    }

    if (this.workerInitPromise) {
      return this.workerInitPromise;
    }

    this.workerInitPromise = (async () => {
      if (this.worker) {
        try {
          await this.worker.terminate();
        } catch (_) {}
        this.worker = null;
      }

      const worker = await createWorker(language, 1, {
        logger: (m: any) => {
          if (this.activeProgressCallback && m) {
            const status = m.status || 'processing';
            const progress = typeof m.progress === 'number' ? m.progress : 0;
            this.activeProgressCallback(status, progress);
          }
        },
      });

      this.worker = worker;
      this.currentLanguage = language;
      this.workerInitPromise = null;
      return worker;
    })();

    return this.workerInitPromise;
  }

  /**
   * Helper to load an image source into an HTMLImageElement
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Failed to load image for OCR preprocessing'));
      img.src = src;
    });
  }

  /**
   * Converts data URLs or web blobs into ArrayBuffer for PDF.js
   */
  private async convertToArrayBuffer(source: string): Promise<ArrayBuffer> {
    if (source.startsWith('data:')) {
      const base64Index = source.indexOf(';base64,');
      if (base64Index !== -1) {
        const base64 = source.substring(base64Index + 8);
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    }

    const response = await fetch(source);
    return await response.arrayBuffer();
  }

  /**
   * Preprocesses image on an offscreen HTML Canvas:
   * - Downscales large documents to maxDimension (default 1600px)
   * - Applies Natural, High-Contrast, or B&W thresholding filters
   */
  async preprocessImage(
    uriOrDataUrl: string,
    filter: OcrFilterMode = 'natural',
    maxDimension: number = 1600
  ): Promise<string> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return uriOrDataUrl;
    }

    try {
      const img = await this.loadImage(uriOrDataUrl);
      let width = img.naturalWidth || img.width || 800;
      let height = img.naturalHeight || img.height || 600;

      // Maintain aspect ratio while bounding max dimensions
      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return uriOrDataUrl;

      // Draw original image scaled
      ctx.drawImage(img, 0, 0, width, height);

      if (filter === 'natural') {
        return canvas.toDataURL('image/jpeg', 0.88);
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      if (filter === 'contrast') {
        // High Contrast: Boost text contrast against background paper
        const contrastFactor = 1.35;
        const brightnessOffset = 10;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrastFactor + 128 + brightnessOffset));
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrastFactor + 128 + brightnessOffset));
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrastFactor + 128 + brightnessOffset));
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.88);
      }

      if (filter === 'bw') {
        // B&W Document Scan: Otsu-style adaptive luminance binarization
        let totalLum = 0;
        const totalPixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          totalLum += lum;
        }
        const avgLum = totalLum / totalPixels;
        const threshold = Math.max(75, Math.min(190, avgLum * 0.90));

        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = lum >= threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.88);
      }

      return canvas.toDataURL('image/jpeg', 0.88);
    } catch (err) {
      console.warn('Preprocessing canvas error, falling back to original:', err);
      return uriOrDataUrl;
    }
  }

  /**
   * Extracts text from an image using Web Tesseract.js
   */
  async extractFromImage(
    uriOrDataUrl: string,
    options?: OcrExtractionOptions
  ): Promise<OcrExtractionResult> {
    const filter = options?.filter || 'natural';
    const language = options?.language || 'eng';

    options?.onProgress?.({ status: 'preprocessing', progress: 0.1 });
    const processedUrl = await this.preprocessImage(uriOrDataUrl, filter, options?.maxDimension || 1600);

    options?.onProgress?.({ status: 'loading engine', progress: 0.25 });
    const worker = await this.getWorker(language);

    this.activeProgressCallback = (status, prog) => {
      // Map internal tesseract progress (0..1) to overall progress (0.25..0.95)
      const mappedProg = Math.min(0.95, 0.25 + prog * 0.7);
      options?.onProgress?.({ status: `OCR: ${status}`, progress: mappedProg });
    };

    try {
      const result = await worker.recognize(processedUrl);
      this.activeProgressCallback = null;

      const rawText = result.data.text || '';
      // Clean up multiple trailing empty lines
      const cleanedText = rawText
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const confidence = Math.round((result.data.confidence || 95) * 10) / 10;

      options?.onProgress?.({ status: 'complete', progress: 1 });

      return {
        text: cleanedText,
        confidence,
        language,
        pageCount: 1,
        processedImageUrl: processedUrl,
        filter,
        pages: [
          {
            pageIndex: 1,
            text: cleanedText,
            confidence,
            thumbnailUrl: processedUrl,
          },
        ],
      };
    } catch (err) {
      this.activeProgressCallback = null;
      console.error('Tesseract Web OCR recognition error:', err);
      throw err;
    }
  }

  /**
   * Extracts text from a PDF file using PDF.js + Canvas OCR for scanned pages
   */
  async extractFromPdf(
    uriOrDataUrl: string,
    options?: OcrExtractionOptions
  ): Promise<OcrExtractionResult> {
    options?.onProgress?.({ status: 'loading PDF document', progress: 0.05 });

    const arrayBuffer = await this.convertToArrayBuffer(uriOrDataUrl);
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });

    const pdf = await loadingTask.promise;
    const maxPages = options?.maxPages || 10;
    const totalPages = Math.min(pdf.numPages, maxPages);
    const pageResults: OcrPageResult[] = [];
    let firstPageThumbnail = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageProgressBase = 0.1 + (pageNum - 1) * (0.85 / totalPages);
      options?.onProgress?.({
        status: `Processing PDF page ${pageNum} of ${totalPages}`,
        progress: pageProgressBase,
      });

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const digitalTextItems = textContent.items.map((item: any) => item.str || '');
      const digitalText = digitalTextItems.join(' ').trim();

      // Render page to canvas to generate thumbnail and for OCR if needed
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      }

      const pageThumbnail = canvas.toDataURL('image/jpeg', 0.85);
      if (pageNum === 1) {
        firstPageThumbnail = pageThumbnail;
      }

      // If page has rich digital text (> 30 characters), use digital text directly!
      if (digitalText.length >= 30) {
        // Format digital text nicely
        const formattedDigitalText = digitalText
          .replace(/\s{2,}/g, ' ')
          .replace(/([.!?])\s+/g, '$1\n\n')
          .trim();

        pageResults.push({
          pageIndex: pageNum,
          text: formattedDigitalText,
          confidence: 99.8,
          thumbnailUrl: pageThumbnail,
        });
      } else {
        // Scanned photocopy page: run OCR on rendered canvas
        options?.onProgress?.({
          status: `Running OCR on scanned page ${pageNum}...`,
          progress: pageProgressBase + 0.4 * (0.85 / totalPages),
        });

        const preprocessed = await this.preprocessImage(
          pageThumbnail,
          options?.filter || 'contrast',
          options?.maxDimension || 1600
        );
        const ocrResult = await this.extractFromImage(preprocessed, {
          ...options,
          onProgress: (p) => {
            options?.onProgress?.({
              status: `Page ${pageNum}: ${p.status}`,
              progress: pageProgressBase + p.progress * (0.85 / totalPages),
            });
          },
        });

        pageResults.push({
          pageIndex: pageNum,
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          thumbnailUrl: preprocessed,
        });
      }
    }

    // Combine page texts with clear markdown page headings
    const combinedText =
      pageResults.length > 1
        ? pageResults.map((p) => `### Page ${p.pageIndex}\n\n${p.text}`).join('\n\n---\n\n')
        : pageResults[0]?.text || '';

    const avgConfidence =
      pageResults.length > 0
        ? Math.round(
            (pageResults.reduce((sum, p) => sum + (p.confidence || 95), 0) / pageResults.length) * 10
          ) / 10
        : 98.0;

    options?.onProgress?.({ status: 'complete', progress: 1 });

    return {
      text: combinedText,
      confidence: avgConfidence,
      language: options?.language || 'eng',
      pageCount: totalPages,
      processedImageUrl: firstPageThumbnail,
      filter: options?.filter || 'natural',
      pages: pageResults,
    };
  }
}

export const ocrEngine = new WebOcrEngine();
export default ocrEngine;
