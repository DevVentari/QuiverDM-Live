/**
 * Type definitions for PDF processing progress tracking
 */

export interface MarkerProgressUpdate {
  stage: 'ocr_detection' | 'text_extraction' | 'layout_analysis' | 'block_processing' | 'llm_processing';
  stageProgress: number; // 0-100 within this stage
  detail?: string; // Human-readable description
  currentPage?: number;
  totalPages?: number;
}

export interface PDFProcessingStage {
  id: string;
  label: string;
  progressRange: [number, number]; // [start, end] percentage
}

export const PDF_STAGES: PDFProcessingStage[] = [
  { id: 'downloading', label: 'Downloading PDF', progressRange: [0, 20] },
  { id: 'preprocessing', label: 'Preparing for conversion', progressRange: [20, 40] },
  { id: 'marker_processing', label: 'Converting to markdown', progressRange: [40, 85] },
  { id: 'postprocessing', label: 'Post-processing', progressRange: [85, 90] },
  { id: 'extraction', label: 'Extracting D&D content', progressRange: [90, 100] },
];

export interface PDFProgressMessage {
  type: 'pdf_progress' | 'pdf_status' | 'pdf_stage_detail';
  pdfId: string;
  progress?: number; // Overall 0-100
  status?: string; // Current processing stage
  stageProgress?: number; // Progress within current stage
  detail?: string; // Detailed description
  timestamp: number;
}

export interface WebSocketMessage {
  type: string;
  jobId?: string;
  progress?: number;
  status?: string;
  data?: Record<string, unknown>;
}

export function getStageLabel(status?: string): string {
  switch (status) {
    case 'downloading':
      return 'Downloading PDF...';
    case 'preprocessing':
      return 'Preparing...';
    case 'marker_ocr':
    case 'ocr_detection':
      return 'Running OCR...';
    case 'marker_text':
    case 'text_extraction':
      return 'Extracting text...';
    case 'marker_layout':
    case 'layout_analysis':
      return 'Analyzing layout...';
    case 'block_processing':
      return 'Processing blocks...';
    case 'llm_processing':
      return 'AI Enhancement...';
    case 'extracting':
    case 'extracting_content':
      return 'Extracting D&D content...';
    case 'completed':
      return 'Complete!';
    default:
      return 'Processing...';
  }
}
