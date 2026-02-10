# Quick Start: GPU-Accelerated PDF Processing

## ✅ Setup Complete!

Your system is now optimized for **10x faster PDF processing** with GPU acceleration.

---

## 🚀 Start Processing PDFs (3 Steps)

### Step 1: Start Services
```bash
# Start Docker services (Postgres, Redis, MeiliSearch, etc.)
docker-compose up -d

# Start PDF worker (with GPU enabled)
npm run worker:pdf
```

**Look for this in the logs:**
```
[Worker] PDF processing worker started with concurrency: 2
[Worker] Environment check:
  GEMINI_API_KEY: ✓ Set
```

### Step 2: Start Dev Server (New Terminal)
```bash
npm run dev
```

Open: http://localhost:3847

### Step 3: Upload a PDF

**Via API:**
```bash
curl -X POST http://localhost:3847/api/homebrew/upload-pdf \
  -F "file=@/path/to/sourcebook.pdf" \
  -F "useAIExtraction=true" \
  -F "llmProvider=gemini"
```

**Via UI:**
1. Navigate to Homebrew section
2. Click "Upload PDF"
3. Select a D&D sourcebook
4. Enable "AI Extraction"
5. Select "Gemini" as provider

---

## 📊 Monitor Progress

### Watch Worker Logs
```bash
# You should see:
[Worker] Processing PDF: sourcebook.pdf (ID: abc123)
[Worker] Marker progress: text_extraction - 45% (22/50)
[Worker] Successfully processed PDF in 147s  # ~3 seconds per page!
[Worker] Extracted 87 items, saved 85 to homebrew
```

### Watch GPU Usage (Real-time)
```bash
nvidia-smi -l 1
# GPU utilization should spike to 80-100% during processing
```

---

## 💡 Performance Expectations

| PDF Size | Pages | Time (GPU) | Cost (Gemini) |
|----------|-------|------------|---------------|
| Small | 10 | ~30 sec | $0.10 |
| Medium | 30 | ~2.5 min | $0.30 |
| Large | 80 | ~6.5 min | $0.80 |

---

## 🎯 Processing Modes

### Mode 1: Fast & Free (GPU OCR Only)
```typescript
{
  useLLM: false,              // No vision model
  useAIExtraction: false      // No content extraction
}
```
- **Cost:** $0
- **Output:** Clean markdown only
- **Use for:** Just converting PDFs to text

### Mode 2: Smart Extraction (Recommended)
```typescript
{
  useLLM: false,              // GPU OCR
  useAIExtraction: true,      // Extract D&D content
  llmProvider: 'gemini'
}
```
- **Cost:** ~$0.01 per page
- **Output:** Markdown + structured content (spells, items, creatures)
- **Use for:** Most D&D sourcebooks

### Mode 3: Premium Quality (Complex PDFs)
```typescript
{
  useLLM: true,               // Vision model for tables
  useAIExtraction: true,
  llmProvider: 'gemini'
}
```
- **Cost:** ~$0.05-0.10 per page
- **Output:** High-quality markdown + structured content
- **Use for:** PDFs with complex tables/diagrams

---

## 🔍 Verify Setup

Run this quick test:
```bash
python -c "
import torch
print('GPU:', torch.cuda.get_device_name(0))
print('CUDA:', torch.cuda.is_available())
print('VRAM:', f'{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
"
```

**Expected output:**
```
GPU: NVIDIA GeForce RTX 4070 SUPER
CUDA: True
VRAM: 12.0 GB
```

---

## 📝 Configuration Reference

All optimizations are in:
- `src/lib/pdf/marker.ts` - GPU settings
- `.env.local` - Environment variables
- Worker concurrency: 2 PDFs parallel

To adjust concurrency:
```bash
# Process 1 PDF at a time (safer for huge PDFs)
PDF_WORKER_CONCURRENCY=1 npm run worker:pdf

# Process 2 PDFs (default, optimal)
PDF_WORKER_CONCURRENCY=2 npm run worker:pdf
```

---

## 🐛 Common Issues

### "CUDA out of memory"
- Reduce concurrency: `PDF_WORKER_CONCURRENCY=1`
- Close browser tabs or other GPU apps
- Restart worker

### "Marker execution failed"
- Automatic fallback to PyMuPDF will trigger
- Check worker logs for details

### Slow processing
- Verify GPU is actually being used: `nvidia-smi`
- Check `marker.ts` line 682: should say `TORCH_DEVICE: 'cuda'`

---

## 📚 Next Actions

1. **Test with a small PDF first** (10-20 pages)
2. **Monitor worker logs** for success
3. **Check GPU usage** with `nvidia-smi`
4. **Review extracted content** in database
5. **Scale up** to larger PDFs

---

## 🎉 You're Ready!

Your RTX 4070 SUPER is now processing D&D sourcebooks at **10x the speed** of CPU-only mode.

**Start processing:** `npm run worker:pdf`

See `GPU_OPTIMIZATION_COMPLETE.md` for detailed benchmarks and cost analysis.
