/**
 * PDF.js Viewer Library
 *
 * Client-side PDF viewing with:
 * - Table of Contents extraction
 * - Full-text search
 * - Page navigation
 * - Zoom controls
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Set worker source for PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface TOCItem {
  title: string;
  page: number;
  level: number;
  items?: TOCItem[];
}

export interface SearchResult {
  page: number;
  context: string;
  position: number;
  matchText: string;
}

export interface PDFViewerConfig {
  pdfUrl: string;
  enableSearch?: boolean;
  enableTOC?: boolean;
}

export class PDFViewer {
  private pdf: PDFDocumentProxy | null = null;
  private textContent: string[] = [];
  private toc: TOCItem[] = [];
  private currentPage: number = 1;
  private scale: number = 1.0;

  /**
   * Load a PDF document
   */
  async loadPDF(url: string): Promise<{
    numPages: number;
    toc: TOCItem[];
    searchIndex: string[];
  }> {
    try {
      console.log('[PDFViewer] Loading PDF:', url);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(url);
      this.pdf = await loadingTask.promise;

      console.log(`[PDFViewer] PDF loaded with ${this.pdf.numPages} pages`);

      // Extract text from all pages for search
      await this.extractAllText();

      // Build table of contents from PDF outline
      await this.buildTOC();

      return {
        numPages: this.pdf.numPages,
        toc: this.toc,
        searchIndex: this.textContent,
      };
    } catch (error) {
      console.error('[PDFViewer] Error loading PDF:', error);
      throw error;
    }
  }

  /**
   * Extract text content from all pages
   */
  private async extractAllText(): Promise<void> {
    if (!this.pdf) throw new Error('PDF not loaded');

    this.textContent = [];

    for (let pageNum = 1; pageNum <= this.pdf.numPages; pageNum++) {
      try {
        const page = await this.pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine all text items into a single string
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        this.textContent.push(pageText);
      } catch (error) {
        console.warn(`[PDFViewer] Error extracting text from page ${pageNum}:`, error);
        this.textContent.push('');
      }
    }

    console.log(`[PDFViewer] Extracted text from ${this.textContent.length} pages`);
  }

  /**
   * Build table of contents from PDF outline
   */
  private async buildTOC(): Promise<void> {
    if (!this.pdf) throw new Error('PDF not loaded');

    try {
      const outline = await this.pdf.getOutline();

      if (!outline || outline.length === 0) {
        console.log('[PDFViewer] No table of contents found in PDF');
        this.toc = [];
        return;
      }

      // Convert outline to TOC structure
      this.toc = await this.convertOutlineToTOC(outline);

      console.log(`[PDFViewer] Built TOC with ${this.toc.length} top-level entries`);
    } catch (error) {
      console.warn('[PDFViewer] Error building TOC:', error);
      this.toc = [];
    }
  }

  /**
   * Convert PDF outline to TOC structure
   */
  private async convertOutlineToTOC(outline: any[], level: number = 0): Promise<TOCItem[]> {
    if (!this.pdf) return [];

    const items: TOCItem[] = [];

    for (const item of outline) {
      try {
        // Get page number from destination
        let pageNum = 1;

        if (item.dest) {
          if (typeof item.dest === 'string') {
            const dest = await this.pdf.getDestination(item.dest);
            if (dest && dest[0]) {
              pageNum = await this.pdf.getPageIndex(dest[0]) + 1;
            }
          } else if (Array.isArray(item.dest) && item.dest[0]) {
            pageNum = await this.pdf.getPageIndex(item.dest[0]) + 1;
          }
        }

        const tocItem: TOCItem = {
          title: item.title,
          page: pageNum,
          level,
        };

        // Recursively process child items
        if (item.items && item.items.length > 0) {
          tocItem.items = await this.convertOutlineToTOC(item.items, level + 1);
        }

        items.push(tocItem);
      } catch (error) {
        console.warn('[PDFViewer] Error processing TOC item:', item.title, error);
      }
    }

    return items;
  }

  /**
   * Search for text in the PDF
   */
  search(query: string, caseSensitive: boolean = false): SearchResult[] {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    this.textContent.forEach((text, pageIndex) => {
      const matches = [...text.matchAll(regex)];

      matches.forEach(match => {
        const position = match.index!;
        const contextStart = Math.max(0, position - 50);
        const contextEnd = Math.min(text.length, position + match[0].length + 50);

        results.push({
          page: pageIndex + 1,
          context: text.substring(contextStart, contextEnd),
          position,
          matchText: match[0],
        });
      });
    });

    console.log(`[PDFViewer] Found ${results.length} matches for "${query}"`);
    return results;
  }

  /**
   * Render a specific page to a canvas
   */
  async renderPage(pageNum: number, canvas: HTMLCanvasElement, scale: number = 1.0): Promise<void> {
    if (!this.pdf) throw new Error('PDF not loaded');

    if (pageNum < 1 || pageNum > this.pdf.numPages) {
      throw new Error(`Invalid page number: ${pageNum}`);
    }

    const page = await this.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    } as any).promise;

    this.currentPage = pageNum;
    this.scale = scale;
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Get total number of pages
   */
  getTotalPages(): number {
    return this.pdf?.numPages || 0;
  }

  /**
   * Get table of contents
   */
  getTOC(): TOCItem[] {
    return this.toc;
  }

  /**
   * Get text content for all pages
   */
  getTextContent(): string[] {
    return this.textContent;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.pdf) {
      await this.pdf.destroy();
      this.pdf = null;
    }
    this.textContent = [];
    this.toc = [];
  }
}
