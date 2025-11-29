# Transcription System

QuiverDM uses WhisperX for local transcription with speaker diarization. This guide covers setup and usage.

## Prerequisites

- **Python 3.8-3.11** with pip
- **NVIDIA GPU** with CUDA (optional, but 10x faster)
- **HuggingFace account** (free, for speaker diarization)

## Quick Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs WhisperX, PyTorch, and pyannote.audio for speaker diarization.

### 2. GPU Setup (Optional but Recommended)

For NVIDIA GPUs:

```bash
# Check CUDA availability
python -c "import torch; print('CUDA:', torch.cuda.is_available())"

# Install PyTorch with CUDA if needed
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 3. Speaker Diarization Setup

Speaker diarization identifies "who spoke when" - essential for D&D sessions.

1. Create account at [HuggingFace](https://huggingface.co/)
2. Get token from [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Accept model agreements:
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
4. Set your token:

```bash
# Option A: Environment variable
export HF_TOKEN="your-token-here"

# Option B: Save to file (permanent)
mkdir -p ~/.huggingface
echo "your-token-here" > ~/.huggingface/token

# Option C: Add to .env.local
HF_TOKEN="your-token-here"
```

## Testing

### Quick Test (60 seconds)

```bash
npm run test:quick
```

### Full Workflow Test

```bash
npm run test:transcribe
```

### Full Session with Speakers

```bash
npm run transcribe:full
```

### Manual Python Test

```bash
# Basic transcription
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium

# With speaker diarization
python scripts/transcribe_whisperx.py "path/to/audio.mp3" --model medium --speaker-names DM Alice Bob Charlie
```

## Model Selection

| Model | VRAM | Speed (3hr session) | Quality |
|-------|------|---------------------|---------|
| tiny | ~2 GB | ~10-15 min | Lowest |
| small | ~3 GB | ~20-25 min | Medium |
| **medium** | ~6 GB | **~25-35 min** | **Good** ⭐ |
| large-v3 | ~12 GB | ~40-50 min | Best |

**Recommended:** `medium` with `batch_size=16`

## Usage in Application

### Check WhisperX Availability

```typescript
const { data } = trpc.sessionTranscription.checkLocalWhisper.useQuery();
```

### Transcribe a Session

```typescript
const transcribeMutation = trpc.sessionTranscription.transcribeSession.useMutation();

// Basic transcription
transcribeMutation.mutate({
  sessionId: 'session-id',
  filePath: 'c:/path/to/session-video.mp4',
  modelSize: 'medium',
  useGPU: true,
});

// With speaker diarization
transcribeMutation.mutate({
  sessionId: 'session-id',
  filePath: 'c:/path/to/session-video.mp4',
  modelSize: 'medium',
  useGPU: true,
  useSpeakers: true,
  speakerNames: ['DM', 'Alice', 'Bob', 'Charlie'],
});
```

### Track Progress

```typescript
const { data: progress } = trpc.sessionTranscription.getTranscriptionProgress.useQuery({
  jobId,
});

// progress.status: 'queued' | 'processing' | 'completed' | 'failed'
// progress.progress: 0-100
// progress.currentStep: 'extracting_audio' | 'transcribing' | 'diarizing'
```

## Performance

**3-hour D&D session:**
- Audio extraction: ~3-6 minutes
- Transcription (GPU): ~25-35 minutes
- Transcription (CPU): ~1.5-2 hours
- Speaker diarization: +5-10 minutes

**File size reduction:** 9 GB video → ~200 MB audio → ~50 KB text

## Speaker Mapping

Detected speakers are mapped to player names in order of first appearance:

```typescript
const speakerNames = [
  'DM',                    // First speaker detected
  'Blam Bam Bigglesworth', // Second speaker
  'Gwark',                 // Third speaker
  // ...
];
```

**Tips:**
- List DM first (usually speaks first)
- List most talkative players earlier
- You can adjust mapping after transcription

## Troubleshooting

### Python not found

Install Python 3.8-3.11 and add to PATH.

### whisperx not installed

```bash
pip install -r requirements.txt
```

### CUDA not available

- Install NVIDIA drivers
- Install CUDA toolkit 11.8+
- Reinstall PyTorch with CUDA support

### Out of memory

- Reduce batch size: `--batch-size 8`
- Use smaller model: `--model small`
- Use CPU: `--device cpu`

### Speaker diarization not available

- Verify HF_TOKEN is set
- Accept model agreements on HuggingFace
- Check token has read permissions

## CPU Fallback

If you don't have a GPU:

```bash
USE_GPU=false npm run test:quick
```

CPU transcription is 5-10x slower but works without CUDA.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/whisperx.ts` | WhisperX transcription interface |
| `src/lib/ffmpeg.ts` | Audio pre-processing and extraction |
| `scripts/transcribe_whisperx.py` | Python WhisperX script |
| `src/server/routers/session-transcription.ts` | tRPC endpoints |
