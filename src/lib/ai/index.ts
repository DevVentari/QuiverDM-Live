/**
 * AI Content Extraction Module
 *
 * Provides multi-provider AI extraction for D&D content.
 */

// Primary extraction orchestrator (the main entry point)
export {
  type ExtractionProvider,
  type ExtractedContent,
  type ExtractionResult,
  extractContent,
  getAvailableProviders,
} from './extraction';

// Gemini-specific exports
export {
  extractContentWithGemini,
  saveExtractedContent,
} from './gemini';

// Ollama extraction exports
export {
  type OllamaExtractionOptions,
  extractContent as extractContentWithOllamaExtraction,
  extractBatch as extractBatchWithOllama,
  testOllama,
} from './ollama-extraction';

// Ollama client exports
export {
  type OllamaOptions,
  type OllamaMessage,
  type OllamaResponse,
  isOllamaAvailable,
  listOllamaModels,
  chatWithOllama,
  generateWithOllama,
  extractStructuredData,
} from './ollama';
