# Workshop Audio Transcription Guide

A comprehensive guide to transcribing difficult audio recordings using WhisperX, based on lessons learned from processing 15+ hours of Makita Masters woodworking workshop recordings.

## Overview

This guide covers transcription of challenging audio environments and how to apply these techniques to D&D session recordings in QuiverDM.

### What Makes Audio "Difficult"?

| Challenge | Workshop Example | D&D Session Example |
|-----------|------------------|---------------------|
| Background noise | Power tools, compressors | HVAC, traffic, pets |
| Multiple speakers | 4-8 workshop participants | 4-6 players + DM |
| Distant microphones | Large workshop space | Table recording |
| Overlapping speech | Interruptions, crosstalk | Combat excitement, roleplay |
| Variable volume | Yelling over noise | Whispered roleplay vs. loud combat |
| Long duration | 2-5 hour sessions | 3-6 hour sessions |

## The Transcription Pipeline

### 1. Audio Preprocessing

The preprocessing step is **critical** for difficult audio. The workshop preset applies:

```
Filters:
- Bandpass filter (200Hz-3000Hz) - isolates human speech frequencies
- Loudness normalization (EBU R128) - consistent volume levels
- Noise reduction - reduces background hum/noise
- Conversion to mono @ 16kHz - optimal for Whisper models
```

### 2. Chunked Processing

Long recordings are split into 10-minute chunks to:
- Prevent GPU memory exhaustion
- Allow progress tracking
- Enable recovery from errors
- Maintain timestamp accuracy

### 3. WhisperX Transcription

WhisperX provides several advantages over vanilla Whisper:
- **Batched inference** - 2-3x faster processing
- **Word-level timestamps** - precise alignment
- **Voice Activity Detection (VAD)** - better silence handling
- **Speaker diarization** - "who said what"

### 4. Output Generation

Each transcription produces 4 files:
- `.json` - Full data with segments, words, timestamps, speakers
- `.txt` - Plain text transcript
- `.speakers.txt` - Text with speaker labels
- `.srt` - Subtitle format for video sync

## Model Selection

### Medium Model (~5GB VRAM)
- **Speed:** ~12x realtime
- **Best for:** Quick review, time-sensitive work, initial passes
- **Accuracy:** Good for clear speech, struggles with accents/technical terms

### Large-v3 Model (~10GB VRAM)
- **Speed:** ~7.7x realtime
- **Best for:** Archival quality, final transcripts, difficult audio
- **Accuracy:** Better numbers, names, locations, technical terms

### Comparison from Testing

| Metric | Medium | Large-v3 |
|--------|--------|----------|
| Processing Speed | ~12.4x realtime | ~7.7x realtime |
| Words Captured | ~101,000 | 126,933 |
| Accuracy | Good | Better |
| VRAM Required | ~5GB | ~10GB |

**Recommendation:** Use medium for quick review, large-v3 for final archive.

## Implementation for D&D Sessions

### Recommended Preset: Session

For typical D&D sessions recorded at a table, use a session preset:

```typescript
// Proposed session preset for src/lib/ffmpeg-workshop.ts
const sessionPreset = {
  name: 'session',
  description: 'Tabletop gaming sessions - multiple speakers, variable volume',
  filters: [
    // Less aggressive bandpass - preserve more vocal range for roleplay
    'highpass=f=150',
    'lowpass=f=4000',
    // Loudness normalization
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    // Light noise reduction
    'anlmdn=s=7:p=0.002:r=0.002',
    // Mono conversion
    'pan=mono|c0=0.5*c0+0.5*c1'
  ]
};
```

### Speaker Diarization for D&D

Speaker diarization is especially valuable for D&D sessions:

1. **Identify players:** Map SPEAKER_00, SPEAKER_01, etc. to actual player names
2. **Track character voices:** Some players use distinct voices for their characters
3. **DM tracking:** Identify when the DM is narrating vs. speaking as NPCs

```typescript
// Example speaker mapping
const speakerMap = {
  'SPEAKER_00': 'DM (Mike)',
  'SPEAKER_01': 'Sarah (Elara the Wizard)',
  'SPEAKER_02': 'John (Grimlock the Barbarian)',
  'SPEAKER_03': 'Emily (Shadowmere the Rogue)',
  'SPEAKER_04': 'Tom (Brother Marcus the Cleric)'
};
```

### Campaign Glossary Integration

QuiverDM's campaign glossary can post-process transcripts to fix:

- Character names: "Grimlock" not "Grim Lock"
- Place names: "Neverwinter" not "never winter"
- Spell names: "Fireball" not "fire ball"
- D&D terms: "d20" not "D 20"

```typescript
// Example glossary corrections
const campaignGlossary = {
  'grim lock': 'Grimlock',
  'shadow mere': 'Shadowmere',
  'never winter': 'Neverwinter',
  'water deep': 'Waterdeep',
  'd 20': 'd20',
  'AC': 'AC', // Preserve abbreviations
  'hit points': 'hit points',
  'natural 20': 'natural 20'
};
```

### Workflow for D&D Sessions

#### Quick Review Workflow (Same Day)
```bash
# Use medium model for fast turnaround
npx tsx scripts/transcribe-workshop.ts \
  --input "./sessions/recording.m4a" \
  --output "./sessions/transcripts/" \
  --preset session \
  --model medium \
  --speakers 4-6
```

#### Archival Workflow (Final Quality)
```bash
# Use large-v3 for permanent archive
npx tsx scripts/transcribe-workshop.ts \
  --input "./sessions/recording.m4a" \
  --output "./sessions/transcripts-archive/" \
  --preset session \
  --model large-v3 \
  --speakers 4-6
```

## Processing Time Estimates

Based on workshop testing results:

| Session Length | Medium Model | Large-v3 Model |
|---------------|--------------|----------------|
| 2 hours | ~10 minutes | ~16 minutes |
| 3 hours | ~15 minutes | ~24 minutes |
| 4 hours | ~20 minutes | ~32 minutes |
| 5 hours | ~25 minutes | ~40 minutes |
| 6 hours | ~30 minutes | ~48 minutes |

*Estimates assume GPU processing with NVIDIA CUDA*

## Hardware Requirements

### Minimum (CPU-only)
- Any modern CPU
- 16GB RAM
- Processing: ~1x realtime (3hr session = 3hr processing)

### Recommended (GPU)
- NVIDIA GPU with 8GB+ VRAM
- 16GB RAM
- Processing: ~7-12x realtime (3hr session = 15-25min processing)

### Optimal
- NVIDIA GPU with 12GB+ VRAM (RTX 3080/4080 or better)
- 32GB RAM
- Processing: ~12x realtime with large-v3 model

## Integration with QuiverDM

### Automatic Session Processing

Future QuiverDM integration will support:

1. **Upload recording** to session in web UI
2. **Automatic transcription** triggered via job queue
3. **Campaign glossary** applied automatically
4. **Speaker mapping** UI to assign names
5. **AI summary** generated from transcript

### n8n Workflow Integration

For automated topic extraction:

1. File watcher monitors transcription output
2. New `.json` files trigger workflow
3. LLM extracts topics, combat encounters, NPC interactions
4. Results saved as `.topics.json`
5. Topics indexed for search

## Troubleshooting

### Common Issues

**"Out of memory" errors:**
- Reduce batch size: `--batch-size 8`
- Use medium model instead of large-v3
- Close other GPU-intensive applications

**Poor transcription quality:**
- Ensure preprocessing is enabled
- Try the workshop preset for noisy environments
- Use large-v3 model for better accuracy

**Missing speakers in diarization:**
- Increase speaker count: `--speakers 6-8`
- Ensure HuggingFace token is configured
- Check that pyannote model agreements are accepted

**Unicode filename errors:**
- Avoid special characters in filenames
- Use PowerShell wildcards for problematic files
- Rename files to ASCII-only characters

### Performance Tips

1. **Process one file at a time** - Maximizes GPU utilization
2. **Use SSD storage** - Faster chunk read/write
3. **Close other applications** - More VRAM available
4. **Monitor GPU temperature** - Long transcriptions generate heat

## Example Output

### Plain Text (.txt)
```
Welcome back everyone. So last session you were in the tavern and the mysterious stranger approached your table.

Right, I remember. Grimlock was suspicious of him.

Yeah, I want to roll insight to see if he's lying about anything.

Okay roll insight.

That's a 14 plus 2, so 16.

You sense that while he's not outright lying, he's definitely holding something back...
```

### With Speakers (.speakers.txt)
```
[SPEAKER_00 - DM]: Welcome back everyone. So last session you were in the tavern and the mysterious stranger approached your table.

[SPEAKER_01 - Sarah]: Right, I remember. Grimlock was suspicious of him.

[SPEAKER_02 - John]: Yeah, I want to roll insight to see if he's lying about anything.

[SPEAKER_00 - DM]: Okay roll insight.

[SPEAKER_02 - John]: That's a 14 plus 2, so 16.

[SPEAKER_00 - DM]: You sense that while he's not outright lying, he's definitely holding something back...
```

## Conclusion

The techniques developed for transcribing challenging workshop audio directly apply to D&D session recording:

1. **Preprocessing is essential** - Filter noise, normalize volume
2. **Chunked processing scales** - Handle any length session
3. **Model choice matters** - Speed vs. accuracy tradeoff
4. **Speaker diarization adds value** - Know who said what
5. **Post-processing improves quality** - Campaign glossary corrections

With GPU acceleration, a typical 4-hour D&D session can be fully transcribed with speaker identification in under 35 minutes using the large-v3 model.

---

*Based on Makita Masters Workshop Transcription Test (November 2025)*
*See: `docs/test-results/makita-masters-transcription-test.md`*
