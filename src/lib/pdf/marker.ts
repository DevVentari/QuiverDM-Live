import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
export interface MarkerProgressUpdate {
  stage: 'ocr_detection' | 'text_extraction' | 'layout_analysis' | 'block_processing' | 'llm_processing';
  stageProgress: number;
  detail?: string;
  currentPage?: number;
  totalPages?: number;
}

const execAsync = promisify(exec);

export interface MarkerOptions {
  useLLM?: boolean; // Use LLM enhancement for better table/layout extraction
  llmProvider?: 'gemini' | 'anthropic' | 'openai'; // Which LLM to use (default: gemini)
  useGPU?: boolean; // Use GPU if available (default: auto-detect)
  forceOCR?: boolean; // Force OCR even if text is extractable
  outputDir?: string; // Where to save output (default: temp dir)
}

export interface MarkerResult {
  markdown: string;
  metadata: {
    pages: number;
    processingTime: number; // in seconds
    imagesExtracted?: number;
    llmUsed: boolean;
    llmProvider?: string;
    tokensUsed?: number;
    estimatedCost?: number;
  };
}

export interface MarkerError {
  code: string;
  message: string;
  stderr?: string;
}

/**
 * Convert PDF to Markdown using Marker
 * @param pdfPath Absolute path to the PDF file
 * @param options Processing options
 * @returns Markdown content and metadata
 */
export async function convertPdfToMarkdown(
  pdfPath: string,
  options: MarkerOptions = {}
): Promise<MarkerResult> {
  const startTime = Date.now();

  // Validate PDF exists
  try {
    await fs.access(pdfPath);
  } catch (error) {
    throw {
      code: 'FILE_NOT_FOUND',
      message: `PDF file not found: ${pdfPath}`,
    } as MarkerError;
  }

  // Create temp output directory if not specified
  const outputDir = options.outputDir || await fs.mkdtemp(path.join(os.tmpdir(), 'marker-'));

  // Create config file for LLM if needed
  let configPath: string | undefined;
  if (options.useLLM) {
    const config = createLLMConfig(options.llmProvider || 'gemini');
    if (config) {
      configPath = path.join(outputDir, 'marker-config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.log(`[Marker] Created config file at: ${configPath}`);
    }
  }

  try {
    // Build marker_single command
    const command = buildMarkerCommand(pdfPath, outputDir, options, configPath);

    console.log(`[Marker] Running: ${command}`);

    // Execute marker
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      timeout: 5400000, // 90 minute timeout for very large PDFs (40+ MB)
    });

    if (stderr) {
      console.warn('[Marker] Warnings:', stderr);
    }

    // Read the generated markdown file
    // Marker can output with different structures, try multiple paths
    const pdfBasename = path.basename(pdfPath, '.pdf');
    const possiblePaths = [
      path.join(outputDir, `${pdfBasename}.md`),
      path.join(outputDir, pdfBasename, `${pdfBasename}.md`),
      path.join(outputDir, `${pdfBasename}_output.md`),
    ];

    let markdown: string | undefined;
    let markdownPath: string | undefined;

    for (const testPath of possiblePaths) {
      try {
        markdown = await fs.readFile(testPath, 'utf-8');
        markdownPath = testPath;
        console.log(`[Marker] Found markdown at: ${testPath}`);
        break;
      } catch (error) {
        // Try next path
      }
    }

    if (!markdown || !markdownPath) {
      // List what files were actually created
      let actualFiles: string[] = [];
      try {
        actualFiles = await fs.readdir(outputDir);
      } catch (error) {
        // Directory might not exist
      }

      throw {
        code: 'MARKDOWN_NOT_FOUND',
        message: `Marker did not generate markdown file. Tried: ${possiblePaths.join(', ')}. Found files: ${actualFiles.join(', ')}`,
        stderr: stderr || undefined,
      } as MarkerError;
    }

    // Parse metadata from Marker output
    const metadata = parseMarkerOutput(stdout, stderr, startTime, options);

    // Clean up temp directory if we created it
    if (!options.outputDir) {
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }

    return {
      markdown,
      metadata,
    };
  } catch (error: any) {
    // Clean up temp directory on error
    if (!options.outputDir) {
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }

    if (error.code === 'FILE_NOT_FOUND' || error.code === 'MARKDOWN_NOT_FOUND') {
      throw error;
    }

    throw {
      code: 'MARKER_EXECUTION_FAILED',
      message: error.message || 'Marker execution failed',
      stderr: error.stderr,
    } as MarkerError;
  }
}

/**
 * Create configuration JSON for LLM provider
 * Marker requires API keys to be passed via config file
 */
function createLLMConfig(provider: string): Record<string, string> | null {
  const config: Record<string, string> = {};

  switch (provider) {
    case 'gemini':
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        console.warn('[Marker] GEMINI_API_KEY not set, LLM will not be used');
        return null;
      }
      config.gemini_api_key = geminiKey;
      break;
    case 'anthropic':
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        console.warn('[Marker] ANTHROPIC_API_KEY not set, LLM will not be used');
        return null;
      }
      config.anthropic_api_key = anthropicKey;
      break;
    case 'openai':
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.warn('[Marker] OPENAI_API_KEY not set, LLM will not be used');
        return null;
      }
      config.openai_api_key = openaiKey;
      break;
    default:
      console.warn(`[Marker] Unknown LLM provider: ${provider}`);
      return null;
  }

  return config;
}

/**
 * Build the marker_single command with all options
 */
function buildMarkerCommand(
  pdfPath: string,
  outputDir: string,
  options: MarkerOptions,
  configPath?: string
): string {
  // Escape paths for Windows
  const escapedPdfPath = `"${pdfPath}"`;
  const escapedOutputDir = `"${outputDir}"`;

  let command = `marker_single ${escapedPdfPath} --output_dir ${escapedOutputDir}`;

  // Add config file if provided
  if (configPath) {
    command += ` --config_json "${configPath}"`;
  }

  // Add options
  if (options.useLLM) {
    command += ' --use_llm';

    if (options.llmProvider) {
      // Marker expects --llm_service with full module path like "marker.services.gemini.GoogleGeminiService"
      let llmService: string;
      switch (options.llmProvider) {
        case 'gemini':
          llmService = 'marker.services.gemini.GoogleGeminiService';
          break;
        case 'anthropic':
          llmService = 'marker.services.anthropic.AnthropicService';
          break;
        case 'openai':
          llmService = 'marker.services.openai.OpenAIService';
          break;
        default:
          llmService = 'marker.services.gemini.GoogleGeminiService'; // Default to Gemini
      }
      command += ` --llm_service "${llmService}"`;
    }
  }

  if (options.forceOCR) {
    command += ' --force_ocr';
  }

  if (options.useGPU === false) {
    // Force CPU mode — also disable multiprocessing to reduce peak memory
    command += ' --disable_multiprocessing';
  }

  return command;
}

/**
 * Parse Marker output to extract metadata
 */
function parseMarkerOutput(
  stdout: string,
  stderr: string,
  startTime: number,
  options: MarkerOptions
): MarkerResult['metadata'] {
  const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds

  // Initially set llmUsed to false - we'll set to true only if we confirm LLM was actually used
  const metadata: MarkerResult['metadata'] = {
    pages: 0,
    processingTime,
    llmUsed: false, // Default to false, we'll verify if LLM was actually used
    llmProvider: options.useLLM ? (options.llmProvider || 'gemini') : undefined,
  };

  // Try to extract page count from output
  const pageMatch = stdout.match(/(\d+)\s+pages?/i) || stderr.match(/(\d+)\s+pages?/i);
  if (pageMatch) {
    metadata.pages = parseInt(pageMatch[1]);
  }

  // Check if LLM was actually used (not just requested)
  if (options.useLLM) {
    const combinedOutput = stdout + stderr;

    // Look for evidence that LLM was actually used
    const llmIndicators = [
      /tokens?:\s*(\d+)/i,                    // Token count in output
      /llm\s+processing/i,                    // LLM processing message
      /gemini|anthropic|openai/i,             // Provider name in output
      /api\s+call/i,                          // API call messages
      /model.*response/i,                     // Model response
      /enhanced.*extraction/i,                // Enhanced extraction messages
    ];

    let llmWasUsed = false;
    let tokensFound = 0;

    // Check for token usage (strongest indicator)
    const tokenMatch = combinedOutput.match(/tokens?:\s*(\d+)/i);
    if (tokenMatch) {
      tokensFound = parseInt(tokenMatch[1]);
      if (tokensFound > 0) {
        llmWasUsed = true;
        metadata.tokensUsed = tokensFound;
      }
    }

    // Check for other LLM indicators if no tokens found
    if (!llmWasUsed) {
      for (const indicator of llmIndicators) {
        if (indicator.test(combinedOutput)) {
          llmWasUsed = true;
          console.log(`[Marker] LLM usage detected via pattern: ${indicator}`);
          break;
        }
      }
    }

    // Check for LLM failure indicators (API key not set, auth errors, etc.)
    const failureIndicators = [
      /api\s+key\s+(not|missing|invalid)/i,
      /authentication\s+(failed|error)/i,
      /unauthorized/i,
      /could\s+not\s+connect/i,
    ];

    for (const failure of failureIndicators) {
      if (failure.test(combinedOutput)) {
        console.warn(`[Marker] LLM authentication failure detected: ${failure}`);
        llmWasUsed = false;
        break;
      }
    }

    metadata.llmUsed = llmWasUsed;

    if (llmWasUsed) {
      console.log(`[Marker] LLM was successfully used with provider: ${metadata.llmProvider}`);
      if (tokensFound > 0) {
        console.log(`[Marker] Tokens used: ${tokensFound}`);
      }

      // Estimate cost based on provider
      if (metadata.tokensUsed) {
        if (options.llmProvider === 'gemini' || !options.llmProvider) {
          // Gemini 2.0 Flash: $0.075/1M input, $0.30/1M output
          // Rough estimate: 80% input, 20% output
          const inputTokens = Math.floor(metadata.tokensUsed * 0.8);
          const outputTokens = Math.floor(metadata.tokensUsed * 0.2);
          metadata.estimatedCost =
            (inputTokens / 1_000_000) * 0.075 +
            (outputTokens / 1_000_000) * 0.30;
        } else if (options.llmProvider === 'anthropic') {
          // Claude Sonnet: $3/1M input, $15/1M output
          const inputTokens = Math.floor(metadata.tokensUsed * 0.8);
          const outputTokens = Math.floor(metadata.tokensUsed * 0.2);
          metadata.estimatedCost =
            (inputTokens / 1_000_000) * 3.0 +
            (outputTokens / 1_000_000) * 15.0;
        }
      }
    } else {
      console.warn(`[Marker] LLM enhancement was requested but not detected in output. Check API key configuration.`);
    }
  }

  // Try to extract image count
  const imageMatch = stdout.match(/(\d+)\s+images?/i) || stderr.match(/(\d+)\s+images?/i);
  if (imageMatch) {
    metadata.imagesExtracted = parseInt(imageMatch[1]);
  }

  return metadata;
}

/**
 * Test if Marker is installed and accessible
 */
export async function testMarkerInstallation(): Promise<boolean> {
  try {
    // marker_single doesn't support --version; use --help which exits 0
    await execAsync('marker_single --help');
    return true;
  } catch (error) {
    console.error('[Marker] Not installed or not in PATH');
    return false;
  }
}

/**
 * Progress callback type for streaming conversion
 */
export type MarkerProgressCallback = (update: MarkerProgressUpdate) => void;

/**
 * Parse tqdm progress bar output from Marker
 * Examples:
 * - "Running OCR Error Detection: 78%|#######7 | 7/9"
 * - "Running Layout Analysis: 100%|##########| 9/9 [00:02<00:00,  3.51it/s]"
 * - "Processing blocks:  45%|####5     | 9/20 [00:01<00:01,  5.43it/s]"
 */
function parseTqdmOutput(line: string): MarkerProgressUpdate | null {
  // Pattern for tqdm progress bars
  // Match: "Task Name: XX%|..." or "Task Name:  XX%|..."
  // Unicode progress bars use characters like ▎█▌▍▏▊▋▉ etc.
  const tqdmPattern = /^(.+?):\s*(\d+)%\|[^\|]+\|\s*(\d+)\/(\d+)/;
  const match = line.match(tqdmPattern);

  if (match) {
    const taskName = match[1].trim();
    const percentage = parseInt(match[2]);
    const current = parseInt(match[3]);
    const total = parseInt(match[4]);

    // Map task names to stages
    let stage: MarkerProgressUpdate['stage'] = 'text_extraction';

    if (taskName.toLowerCase().includes('ocr')) {
      stage = 'ocr_detection';
    } else if (taskName.toLowerCase().includes('layout')) {
      stage = 'layout_analysis';
    } else if (taskName.toLowerCase().includes('block')) {
      stage = 'block_processing';
    } else if (taskName.toLowerCase().includes('llm') || taskName.toLowerCase().includes('table')) {
      stage = 'llm_processing';
    } else if (taskName.toLowerCase().includes('text') || taskName.toLowerCase().includes('extract')) {
      stage = 'text_extraction';
    }

    return {
      stage,
      stageProgress: percentage,
      detail: taskName,
      currentPage: current,
      totalPages: total,
    };
  }

  // Also check for simpler progress patterns
  // "Processing page 5/10" or "Page 5 of 10"
  const pagePattern = /(?:page|processing)\s*(\d+)\s*(?:of|\/)\s*(\d+)/i;
  const pageMatch = line.match(pagePattern);

  if (pageMatch) {
    const current = parseInt(pageMatch[1]);
    const total = parseInt(pageMatch[2]);
    const percentage = Math.round((current / total) * 100);

    return {
      stage: 'text_extraction',
      stageProgress: percentage,
      detail: 'Processing pages',
      currentPage: current,
      totalPages: total,
    };
  }

  return null;
}

/**
 * Convert PDF to Markdown using Marker with real-time progress streaming
 * Uses spawn instead of exec to capture tqdm progress output
 * @param pdfPath Absolute path to the PDF file
 * @param options Processing options
 * @param onProgress Callback for progress updates
 * @returns Markdown content and metadata
 */
export interface MarkerConversionHandle {
  promise: Promise<MarkerResult>;
  abort: () => void;
}

export async function convertPdfToMarkdownWithProgress(
  pdfPath: string,
  options: MarkerOptions = {},
  onProgress?: MarkerProgressCallback
): Promise<MarkerResult> {
  const handle = startPdfToMarkdownConversion(pdfPath, options, onProgress);
  return handle.promise;
}

/**
 * Start PDF conversion with ability to abort mid-process
 * Returns a handle with promise and abort function
 */
export function startPdfToMarkdownConversion(
  pdfPath: string,
  options: MarkerOptions = {},
  onProgress?: MarkerProgressCallback
): MarkerConversionHandle {
  let childProcess: ReturnType<typeof spawn> | null = null;
  let aborted = false;

  const promise = (async () => {
    const startTime = Date.now();

    // Validate PDF exists
    try {
      await fs.access(pdfPath);
    } catch (error) {
      throw {
        code: 'FILE_NOT_FOUND',
        message: `PDF file not found: ${pdfPath}`,
      } as MarkerError;
    }

    // Create temp output directory if not specified
    const outputDir = options.outputDir || await fs.mkdtemp(path.join(os.tmpdir(), 'marker-'));

    // Create config file for LLM if needed
    let configPath: string | undefined;
    if (options.useLLM) {
      const config = createLLMConfig(options.llmProvider || 'gemini');
      if (config) {
        configPath = path.join(outputDir, 'marker-config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(`[Marker] Created config file at: ${configPath}`);
      }
    }

    try {
      // Build marker_single command arguments
      const args = buildMarkerArgs(pdfPath, outputDir, options, configPath);

      console.log(`[Marker] Running: marker_single ${args.join(' ')}`);

      // Use spawn for real-time output streaming
      return await new Promise<MarkerResult>((resolve, reject) => {
        if (aborted) {
          reject({
            code: 'MARKER_ABORTED',
            message: 'Conversion was aborted before starting',
          } as MarkerError);
          return;
        }

        let stdout = '';
        let stderr = '';
        let lastProgressUpdate = Date.now();

        const child = spawn('marker_single', args, {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          // Set environment to force UTF-8, unbuffered output, and memory management
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
            // Memory management for PyTorch/CUDA (RTX 4070 SUPER = 12GB VRAM)
            PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:1024,garbage_collection_threshold:0.8',
            TORCH_DEVICE: 'cuda', // Enable GPU acceleration
            // Optimize for GPU processing
            OMP_NUM_THREADS: '4',
            MKL_NUM_THREADS: '4',
            // CUDA optimization
            CUDA_LAUNCH_BLOCKING: '0', // Async kernel launches for performance
          },
        });

        // Store reference for abort
        childProcess = child;

      // Handle stdout (usually minimal for marker)
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log(`[Marker stdout] ${text.trim()}`);
      });

      // Handle stderr (this is where tqdm output goes)
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;

        // Parse each line for progress updates
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) {
            // Log all stderr for debugging
            console.log(`[Marker stderr] ${line.trim()}`);

            // Try to parse as tqdm progress
            const progress = parseTqdmOutput(line);
            if (progress && onProgress) {
              // Throttle updates to avoid flooding (max every 100ms)
              const now = Date.now();
              if (now - lastProgressUpdate >= 100) {
                onProgress(progress);
                lastProgressUpdate = now;
              }
            }
          }
        }
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject({
          code: 'MARKER_TIMEOUT',
          message: 'Marker conversion timed out after 90 minutes',
          stderr,
        } as MarkerError);
      }, 5400000); // 90 minutes for very large PDFs (40+ MB)

      child.on('close', async (code) => {
        clearTimeout(timeout);
        childProcess = null;

        // Check if aborted
        if (aborted) {
          // Clean up temp directory
          if (!options.outputDir) {
            await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
          }

          reject({
            code: 'MARKER_ABORTED',
            message: 'Conversion was aborted',
          } as MarkerError);
          return;
        }

        if (code !== 0) {
          // Clean up temp directory on error
          if (!options.outputDir) {
            await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
          }

          reject({
            code: 'MARKER_EXECUTION_FAILED',
            message: `Marker exited with code ${code}`,
            stderr,
          } as MarkerError);
          return;
        }

        // Read the generated markdown file
        const pdfBasename = path.basename(pdfPath, '.pdf');
        const possiblePaths = [
          path.join(outputDir, `${pdfBasename}.md`),
          path.join(outputDir, pdfBasename, `${pdfBasename}.md`),
          path.join(outputDir, `${pdfBasename}_output.md`),
        ];

        let markdown: string | undefined;

        for (const testPath of possiblePaths) {
          try {
            markdown = await fs.readFile(testPath, 'utf-8');
            console.log(`[Marker] Found markdown at: ${testPath}`);
            break;
          } catch (error) {
            // Try next path
          }
        }

        if (!markdown) {
          let actualFiles: string[] = [];
          try {
            actualFiles = await fs.readdir(outputDir);
          } catch (error) {
            // Directory might not exist
          }

          // Clean up temp directory on error
          if (!options.outputDir) {
            await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
          }

          reject({
            code: 'MARKDOWN_NOT_FOUND',
            message: `Marker did not generate markdown file. Tried: ${possiblePaths.join(', ')}. Found files: ${actualFiles.join(', ')}`,
            stderr,
          } as MarkerError);
          return;
        }

        // Parse metadata from output
        const metadata = parseMarkerOutput(stdout, stderr, startTime, options);

        // Clean up temp directory if we created it
        if (!options.outputDir) {
          await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
        }

        resolve({
          markdown,
          metadata,
        });
      });

      child.on('error', async (error) => {
        clearTimeout(timeout);
        childProcess = null;

        // Clean up temp directory on error
        if (!options.outputDir) {
          await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
        }

        reject({
          code: 'MARKER_SPAWN_FAILED',
          message: error.message,
        } as MarkerError);
      });
    });
  } catch (error: any) {
    if (error.code && error.message) {
      throw error; // Already a MarkerError
    }

    // Clean up temp directory on error
    if (!options.outputDir) {
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }

    throw {
      code: 'MARKER_EXECUTION_FAILED',
      message: error.message || 'Marker execution failed',
      stderr: error.stderr,
    } as MarkerError;
  }
  })();

  // Return handle with promise and abort function
  return {
    promise,
    abort: () => {
      aborted = true;
      if (childProcess) {
        console.log('[Marker] Aborting conversion - killing process');
        childProcess.kill('SIGTERM');
      }
    },
  };
}

/**
 * Build marker_single command arguments as array (for spawn)
 */
function buildMarkerArgs(
  pdfPath: string,
  outputDir: string,
  options: MarkerOptions,
  configPath?: string
): string[] {
  const args: string[] = [pdfPath, '--output_dir', outputDir];

  // Add config file if provided
  if (configPath) {
    args.push('--config_json', configPath);
  }

  // Add options
  if (options.useLLM) {
    args.push('--use_llm');

    if (options.llmProvider) {
      let llmService: string;
      switch (options.llmProvider) {
        case 'gemini':
          llmService = 'marker.services.gemini.GoogleGeminiService';
          break;
        case 'anthropic':
          llmService = 'marker.services.anthropic.AnthropicService';
          break;
        case 'openai':
          llmService = 'marker.services.openai.OpenAIService';
          break;
        default:
          llmService = 'marker.services.gemini.GoogleGeminiService';
      }
      args.push('--llm_service', llmService);
    }
  }

  if (options.forceOCR) {
    args.push('--force_ocr');
  }

  if (options.useGPU === false) {
    args.push('--disable_multiprocessing');
  }

  return args;
}
