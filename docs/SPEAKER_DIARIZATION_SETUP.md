# Speaker Diarization Setup

Speaker diarization identifies "who spoke when" in your audio. This is incredibly useful for D&D sessions to automatically label which player is speaking.

## Quick Setup (5 minutes)

### 1. Get a HuggingFace Token

1. Go to [HuggingFace](https://huggingface.co/) and create an account (free)
2. Navigate to [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Click "New token"
   - Name: `quiverdm-diarization`
   - Type: **Read**
4. Copy the token

### 2. Accept the Model Agreement

1. Visit [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
2. Click "Agree and access repository"
3. Also accept: [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)

### 3. Set Your Token

**Option A: Environment Variable (Temporary)**
```bash
# Windows PowerShell
$env:HF_TOKEN="your-token-here"

# Windows CMD
set HF_TOKEN=your-token-here

# Linux/Mac
export HF_TOKEN="your-token-here"
```

**Option B: Save to File (Permanent)**
```bash
# Windows
mkdir "%USERPROFILE%\.huggingface"
echo your-token-here > "%USERPROFILE%\.huggingface\token"

# Linux/Mac
mkdir -p ~/.huggingface
echo "your-token-here" > ~/.huggingface/token
```

**Option C: Add to .env file**
```env
HF_TOKEN="your-token-here"
```

## Testing

Test that speaker diarization works:

```bash
python scripts/transcribe_with_speakers.py "test-documents/2025-11-08 18-30-31.mp4" --model small --speaker-names "DM" "Player1" "Player2"
```

You should see:
```
Loading speaker diarization model...
Running speaker diarization...
Detected N unique speakers
```

If you see "Speaker diarization not available", check:
1. Token is set correctly
2. You accepted the model agreements
3. Token has `read` permission

## How It Works

### Without Speaker Diarization
```
[0:23] now you're on like the very tallest part of the ship
[0:28] I cast fireball
[0:31] roll for initiative
```

### With Speaker Diarization
```
[0:23] [DM] now you're on like the very tallest part of the ship
[0:28] [Blam Bam Bigglesworth] I cast fireball
[0:31] [DM] roll for initiative
```

## Speaker Mapping

The system maps detected speakers to your player names in order of first appearance:

```typescript
const SPEAKER_NAMES = [
  'DM',                        // First speaker detected
  'Blam Bam Bigglesworth',     // Second speaker detected
  'Gwark',                     // Third speaker detected
  'Abdull',                    // etc...
  'Adam Sandleberg',
  'Player 6',
  'Player 7',
];
```

**Tips for Better Accuracy:**
1. List the DM first (they usually speak first)
2. List most talkative players earlier
3. You can adjust the mapping after transcription

## Performance Impact

- **Without diarization**: ~30-40 minutes for 3-hour session (GPU)
- **With diarization**: ~45-60 minutes for 3-hour session (GPU)

The extra time is worth it for automatically labeled speakers!

## Advanced Options

### Specify Exact Number of Speakers

If you know exactly how many speakers are in your session:

```bash
python scripts/transcribe_with_speakers.py audio.mp3 --num-speakers 5 --speaker-names "DM" "Player1" "Player2" "Player3" "Player4"
```

### Speaker Range

If you're unsure:

```bash
python scripts/transcribe_with_speakers.py audio.mp3 --min-speakers 3 --max-speakers 7
```

## Troubleshooting

### "Speaker diarization not available"
- Check HF_TOKEN is set
- Verify you accepted model agreements
- Ensure token has read permissions

### "Failed to load model"
- Check internet connection
- Model will download on first run (~300 MB)
- Subsequent runs use cached model

### Speakers mislabeled
- Adjust speaker order in `SPEAKER_NAMES` array
- Try specifying `--num-speakers` exactly
- Consider re-recording with better mic placement

### Too many/few speakers detected
- Adjust `--min-speakers` and `--max-speakers`
- Check audio quality (background noise can create "ghost" speakers)
- Single speaker with varying volume might be split

## Usage in Application

Once you have your HuggingFace token set up, you can use speaker diarization through the tRPC API:

```typescript
import { trpc } from '@/lib/trpc';

// Use the speaker diarization endpoint
const transcribeMutation = trpc.sessionTranscription.transcribeSessionWithSpeakers.useMutation();

transcribeMutation.mutate({
  sessionId: 'session-id',
  filePath: 'c:/path/to/session-video.mp4',
  modelSize: 'medium',
  useGPU: true,
  // Speaker options:
  numSpeakers: 4, // If you know the exact number
  minSpeakers: 1, // Minimum number to detect
  maxSpeakers: 8, // Maximum number to detect
  speakerNames: ['DM', 'Alice', 'Bob', 'Charlie'], // Map detected speakers to names
});

// The result includes speaker labels:
// {
//   success: true,
//   transcription: "Hello everyone...",
//   transcriptionWithSpeakers: "[DM] Hello everyone...\n[Alice] Hi!...",
//   segments: [{ start: 0, end: 2.5, text: "Hello everyone", speaker: "DM" }, ...],
//   hasSpeakers: true
// }
```

### Database Integration

Speaker-identified transcripts are automatically saved to the database with full speaker information:

```typescript
// Retrieve a transcript with speaker data
const { data: transcript } = trpc.transcript.getTranscript.useQuery({
  transcriptId: 'transcript-id',
});

// transcript includes:
// - rawText: Plain transcription
// - correctedText: Transcription with speaker labels
// - speakers: Array of unique speakers and their segment counts
// - timestamps: Full segment data with speaker info
// - hasSpeakers: Boolean indicating if diarization was successful
```

### Progress Tracking

Track speaker diarization progress in real-time:

```typescript
const { data: progress } = trpc.sessionTranscription.getTranscriptionProgress.useQuery({
  jobId: jobId,
});

// When currentStep === 'diarizing', speaker identification is running
```

## Privacy & Security

- Your HuggingFace token is stored locally
- Audio is processed locally on your machine
- No audio is uploaded to HuggingFace
- Only the model weights are downloaded from HuggingFace

## References

- [pyannote.audio Documentation](https://github.com/pyannote/pyannote-audio)
- [Speaker Diarization Paper](https://arxiv.org/abs/2104.04045)
- [HuggingFace Model Card](https://huggingface.co/pyannote/speaker-diarization-3.1)
