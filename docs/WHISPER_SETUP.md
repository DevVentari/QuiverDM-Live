# WhisperX Transcription Setup Guide

QuiverDM uses WhisperX for enhanced transcription with batching, word-level alignment, and integrated speaker diarization. WhisperX is 2-3x faster than vanilla Whisper and provides better accuracy.

## Prerequisites

### 1. Node.js Dependencies (Already Installed)
- `openai` - OpenAI API client
- `@ffmpeg-installer/ffmpeg` - Bundled ffmpeg binaries
- `fluent-ffmpeg` - ffmpeg wrapper for Node.js

### 2. Python Setup for WhisperX

#### Install Python
- **Windows**: Download from [python.org](https://www.python.org/downloads/)
- **Recommended**: Python 3.8, 3.9, 3.10, or 3.11
- Make sure to check "Add Python to PATH" during installation

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- `whisperx` - Enhanced Whisper with batching and alignment
- `faster-whisper` - Used internally by WhisperX
- `pyannote.audio` - Integrated speaker diarization
- `torch` & `torchaudio` - PyTorch for deep learning
- CUDA support (if you have an NVIDIA GPU)

#### GPU Support (NVIDIA GPUs)

For GPU acceleration, you need:
1. **NVIDIA GPU** with CUDA Compute Capability 3.5+
2. **CUDA Toolkit** 11.8 or 12.1
3. **cuDNN** compatible with your CUDA version

Download CUDA from: https://developer.nvidia.com/cuda-downloads

To install PyTorch with CUDA support:
```bash
# For CUDA 11.8
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.1
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

#### Verify GPU Setup
```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available())"
```

Should output: `CUDA available: True`

## Configuration

### Environment Variables

Rename `.env.example` to `.env` and configure:

```env
# For OpenAI API (cloud transcription)
OPENAI_API_KEY="your-api-key-here"

# Optional: Anthropic for AI summaries
ANTHROPIC_API_KEY="your-api-key-here"
```

## WhisperX Models

WhisperX supports multiple model sizes with batched processing:

| Model | Size | VRAM (batch=16) | Speed (3hr session) | Quality |
|-------|------|-----------------|---------------------|---------|
| tiny | ~75 MB | ~2 GB | ~10-15 min | Lowest |
| base | ~150 MB | ~2 GB | ~15-20 min | Low |
| small | ~500 MB | ~3 GB | ~20-25 min | Medium |
| **medium** | ~1.5 GB | ~6 GB | **~25-35 min** | **Good** ⭐ |
| large-v2 | ~3 GB | ~12 GB | ~40-50 min | Best |
| large-v3 | ~3 GB | ~12 GB | ~40-50 min | Best |

**Recommended**: `medium` with `batch_size=16` for the best balance of speed and quality.

**Performance Comparison**:
- **WhisperX medium**: ~25-35 min for 3hr session (GPU)
- **faster-whisper medium**: ~45-60 min for 3hr session (GPU)
- **Speedup**: 30-40% faster with WhisperX

The first time you run transcription, the model will be downloaded to `./models/whisper/`.

### Batch Size Settings

- **batch_size=8**: Conservative, works on 4-6GB VRAM GPUs
- **batch_size=16**: Balanced (default), recommended for 8-12GB VRAM
- **batch_size=24-32**: Aggressive, requires 16GB+ VRAM

## Testing the Workflow

### Quick Test (60 seconds)

```bash
npm run test:quick
```

This will:
1. ✅ Check if WhisperX is available
2. 📹 Extract first 60 seconds of test video
3. 🎵 Pre-process audio (normalize, noise reduction, mono @ 16kHz)
4. 🤖 Transcribe with WhisperX (small model for speed)
5. 💾 Save transcription
6. 🧹 Clean up

### Full Workflow Test

```bash
npm run test:transcribe
```

This will:
1. ✅ Check if WhisperX is available
2. 📹 Load the test video from `test-documents/`
3. 🎵 Extract audio with pre-processing and split into 10-minute chunks
4. 🤖 Transcribe each chunk using WhisperX with batching
5. 📐 Align timestamps to word level
6. 💾 Save the full transcription to `test-documents/`
7. 🧹 Clean up temporary files

### Full Session with Speaker Diarization

```bash
npm run transcribe:full
```

Includes everything above plus:
- 🎭 Speaker diarization
- 👥 Maps speakers to player names
- 📊 Generates multiple output formats

### Manual Test with Python Script

```bash
# Transcribe a single audio file
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium --device cuda --batch-size 16

# CPU-only transcription
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium --device cpu

# With speaker diarization
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium --speaker-names DM Alice Bob Charlie

# Specify exact number of speakers
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium --num-speakers 4 --speaker-names DM Alice Bob Charlie

# Save to file
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --output transcription.json
```

## Usage in Application

### Using tRPC API

```typescript
import { trpc } from '@/lib/trpc';

// Check if WhisperX is available
const { data } = trpc.sessionTranscription.checkLocalWhisper.useQuery();

// Transcribe a session (basic)
const transcribeMutation = trpc.sessionTranscription.transcribeSession.useMutation();

transcribeMutation.mutate({
  sessionId: 'session-id',
  filePath: 'c:/path/to/session-video.mp4',
  modelSize: 'medium',
  useGPU: true,
  batchSize: 16, // Optional, defaults to 16
});

// Transcribe with speaker diarization
transcribeMutation.mutate({
  sessionId: 'session-id',
  filePath: 'c:/path/to/session-video.mp4',
  modelSize: 'medium',
  useGPU: true,
  useSpeakers: true,
  speakerNames: ['DM', 'Alice', 'Bob', 'Charlie'],
  maxSpeakers: 4,
});
```

## Workflow Overview

### Large Video File Processing (WhisperX)

1. **Video Upload**: User uploads a large D&D session video (can be several GB)
2. **Audio Pre-processing**: ffmpeg extracts and processes audio:
   - Loudness normalization (EBU R128)
   - Noise reduction (bandpass filter 200Hz-3000Hz)
   - Convert to mono @ 16kHz
3. **Chunking**: Audio is split into 10-minute chunks
4. **WhisperX Transcription**: Each chunk is transcribed with:
   - Batched inference (2-3x speedup)
   - Word-level timestamp alignment
   - Optional speaker diarization
5. **Combination**: Transcriptions are combined with proper timestamp offsets
6. **Cleanup**: Temporary files are automatically removed

### Performance

For a 3-hour D&D session:
- **Audio extraction + pre-processing**: ~3-6 minutes
- **Transcription (GPU)**: ~25-35 minutes with medium model + batching
- **Transcription (CPU)**: ~1.5-2 hours with medium model
- **With speaker diarization**: Add ~5-10 minutes
- **Total size reduction**: 9 GB video → ~200 MB audio → ~50 KB text

### Cost Comparison

- **WhisperX (Local)**: FREE (one-time model download ~1.5 GB)
- **OpenAI API**: $0.006/minute → ~$1.08 for 3-hour session

**Savings**: 100% free for unlimited sessions after setup

## Troubleshooting

### Python not found
```
Error: Python not found
```
**Solution**: Install Python and add to PATH

### whisperx not installed
```
Error: whisperx not installed
```
**Solution**: Run `pip install -r requirements.txt`

### CUDA not available
```
CUDA available: False
```
**Solution**:
- Install NVIDIA drivers
- Install CUDA toolkit
- Reinstall PyTorch with CUDA support

### Out of memory
```
Error: CUDA out of memory
```
**Solution**:
- Reduce batch size (try batch_size=8 instead of 16)
- Use smaller model (small instead of medium)
- Use CPU instead of GPU
- Close other GPU applications

### CPU Fallback

If you don't have a GPU, the system will automatically use CPU:

```typescript
transcribeMutation.mutate({
  filePath: 'path/to/video.mp4',
  modelSize: 'small', // Use smaller model for CPU
  useGPU: false,
});
```

## Database Setup

After installing dependencies, run the Prisma migration to create the necessary database tables:

```bash
npx prisma migrate dev --name add_transcription_models
npx prisma generate
```

This creates the following models:
- `Transcript` - Stores transcription results with speaker data
- `TranscriptionJob` - Tracks progress of ongoing transcriptions
- `SessionRecording` - Links recordings to sessions

## Progress Tracking

The transcription system includes real-time progress tracking:

```typescript
// Start a transcription job
const { jobId } = await transcribeMutation.mutateAsync({
  sessionId: 'session-id',
  filePath: 'path/to/video.mp4',
  modelSize: 'medium',
  useGPU: true,
});

// Check progress
const { data: progress } = trpc.sessionTranscription.getTranscriptionProgress.useQuery({
  jobId,
});

// Progress includes:
// - status: 'queued' | 'processing' | 'completed' | 'failed'
// - progress: 0-100 (percentage)
// - currentChunk: Current chunk being processed
// - totalChunks: Total number of chunks
// - currentStep: 'extracting_audio' | 'splitting_chunks' | 'transcribing' | 'diarizing' | 'saving'
```

## Completed Features

1. ✅ WhisperX with batched inference (2-3x faster)
2. ✅ Word-level timestamp alignment
3. ✅ Audio pre-processing (normalization, noise reduction)
4. ✅ Speaker diarization with integrated pyannote
5. ✅ Database integration with Prisma
6. ✅ Real-time progress tracking
7. ✅ Chunk-based processing for large files
8. ✅ Automatic cleanup of temporary files
9. ✅ Voice Activity Detection (VAD)

## Next Steps

1. 🎯 Add progress tracking UI component
2. 🎯 Build AI summary generation with Claude
3. 🎯 Extract NPCs, locations, and events automatically
4. 🎯 Implement glossary-based corrections
5. 🎯 Add transcript export formats (Discord, Table, Web)

## References

- [WhisperX Documentation](https://github.com/m-bain/whisperX)
- [faster-whisper Documentation](https://github.com/SYSTRAN/faster-whisper)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [pyannote.audio](https://github.com/pyannote/pyannote-audio)
- [PyTorch CUDA Installation](https://pytorch.org/get-started/locally/)
