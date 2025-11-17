# Ollama Setup for QuiverDM

Ollama provides local LLM inference for parsing D&D homebrew content from PDFs without needing external API keys.

## Why Ollama?

- **Free & Local**: No API costs, runs on your machine
- **Privacy**: Data never leaves your computer
- **No API Keys**: No configuration needed beyond installation
- **Fast**: Optimized for local inference
- **Great for Structured Extraction**: Excellent at extracting D&D content from markdown

## Installation

### Windows

1. Download Ollama from https://ollama.com/download/windows
2. Run the installer
3. Ollama will start automatically as a service

### Mac

```bash
brew install ollama
ollama serve  # Start the Ollama service
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## Verify Installation

```bash
ollama --version
```

You should see output like: `ollama version is 0.x.x`

## Download Required Model

QuiverDM uses `llama3.2` for homebrew content extraction:

```bash
ollama pull llama3.2
```

This will download the model (~2GB). The model is optimized for:
- Fast inference (~1-2 seconds per request on modern hardware)
- Structured output (JSON extraction)
- Good instruction following for D&D content

### Alternative Models

If you have more VRAM/RAM available, you can use larger models:

```bash
# Larger, more accurate (requires ~8GB RAM)
ollama pull llama3.2:latest

# Smaller, faster (requires ~4GB RAM)
ollama pull llama3.2:1b
```

To use a different model, update `src/lib/ollama.ts` and change the default model name.

## Verify Ollama is Running

Test that Ollama is accessible:

```bash
curl http://localhost:11434/api/tags
```

You should see JSON output listing your installed models.

Or use the QuiverDM test script:

```bash
npx tsx scripts/test-ollama.ts
```

## How QuiverDM Uses Ollama

1. **PDF Upload**: User uploads a D&D homebrew PDF
2. **Marker Conversion**: PDF → Markdown (no LLM needed)
3. **Ollama Parsing**: Markdown → Structured D&D content
   - Extracts spells, monsters, magic items, etc.
   - Identifies stat blocks, descriptions, and mechanics
   - Returns structured JSON for database storage

### Fallback Behavior

If Ollama isn't running, QuiverDM automatically falls back to regex-based parsing. This is less accurate but still functional.

## Performance

**Typical processing times:**
- Small PDF (1-5 pages): ~5-10 seconds total
- Medium PDF (10-20 pages): ~15-30 seconds total
- Large PDF (50+ pages): ~1-2 minutes total

Breakdown:
- PDF → Markdown (Marker): 70-80% of time
- Markdown → Structured Data (Ollama): 20-30% of time

## Troubleshooting

### Ollama not responding

Check if the service is running:

**Windows:**
```powershell
# Check if ollama.exe is running
tasklist | findstr ollama

# Restart Ollama (run as admin)
net stop ollama
net start ollama
```

**Mac/Linux:**
```bash
# Check status
pgrep -fl ollama

# Start manually if needed
ollama serve
```

### Model not found

```bash
ollama list  # List installed models
ollama pull llama3.2  # Download if missing
```

### Out of memory errors

Use a smaller model:

```bash
ollama pull llama3.2:1b
```

Then update `src/lib/ollama.ts`:
```typescript
model = 'llama3.2:1b'  // Change default
```

## Environment Variables (Optional)

```env
# .env.local
OLLAMA_BASE_URL=http://localhost:11434  # Default
OLLAMA_MODEL=llama3.2  # Default model for parsing
```

## API Keys NOT Required

Unlike Gemini, Claude, or OpenAI, Ollama **does not require any API keys**. Everything runs locally.

## Next Steps

1. Install Ollama
2. Pull the llama3.2 model
3. Upload a D&D PDF to test
4. Check the console logs to see Ollama in action

The system will automatically detect Ollama and use it for intelligent parsing!
