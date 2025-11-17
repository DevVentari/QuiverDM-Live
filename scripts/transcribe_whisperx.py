#!/usr/bin/env python3
"""
Unified transcription using WhisperX with batching, alignment, and optional speaker diarization
Combines functionality of both transcribe_local.py and transcribe_with_speakers.py
"""
import sys
import json
import argparse
import os
import time
from pathlib import Path
import torch

try:
    import whisperx
except ImportError:
    print("Error: whisperx not installed. Run: pip install whisperx", file=sys.stderr)
    sys.exit(1)


def emit_progress(stage: str, percentage: float = None, message: str = None, details: dict = None):
    """
    Emit structured progress event to stderr for TypeScript to parse

    Args:
        stage: Current stage (loading_model, transcribing, aligning, diarizing)
        percentage: Progress percentage (0-100)
        message: Human-readable message
        details: Additional metadata
    """
    progress_event = {
        "type": "progress",
        "stage": stage,
        "percentage": percentage,
        "message": message,
        "timestamp": time.time(),
        "details": details or {}
    }
    print(f"__PROGRESS__{json.dumps(progress_event)}__END__", file=sys.stderr, flush=True)


def transcribe_audio(
    audio_path: str,
    model_size: str = "medium",
    language: str = None,
    device: str = "cuda",
    compute_type: str = "float16",
    batch_size: int = 16,
    speaker_names: list = None,
    num_speakers: int = None,
    min_speakers: int = 1,
    max_speakers: int = 8,
):
    """
    Transcribe audio using WhisperX with optional speaker diarization

    Args:
        audio_path: Path to audio file
        model_size: Model size (tiny, base, small, medium, large-v2, large-v3)
        language: Language code (e.g., 'en', 'es') or None for auto-detection
        device: Device to use ('cuda' for GPU, 'cpu' for CPU)
        compute_type: Computation type ('float16' for GPU, 'int8' for CPU)
        batch_size: Batch size for processing (higher = faster, more VRAM)
        speaker_names: List of speaker names for diarization mapping
        num_speakers: Exact number of speakers (if known)
        min_speakers: Minimum number of speakers to detect
        max_speakers: Maximum number of speakers to detect
    """
    try:
        # Auto-select compute type based on device
        if device == "cpu" and compute_type == "float16":
            compute_type = "int8"

        emit_progress("loading_model", 0, f"Loading WhisperX model: {model_size} on {device}...",
                     {"model": model_size, "device": device, "compute_type": compute_type})

        # Load WhisperX model
        model = whisperx.load_model(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root="./models/whisper"
        )

        emit_progress("loading_model", 100, "Model loaded successfully")

        # Transcribe with batching for 2-3x speedup
        emit_progress("transcribing", 0, f"Starting transcription with batch_size={batch_size}...",
                     {"batch_size": batch_size, "audio_path": audio_path})
        audio = whisperx.load_audio(audio_path)
        result = model.transcribe(audio, batch_size=batch_size, language=language)

        # Get language info
        detected_language = result.get("language", language or "en")

        emit_progress("transcribing", 100, "Transcription complete",
                     {"language": detected_language, "segments": len(result.get("segments", []))})

        # Word-level timestamp alignment
        emit_progress("aligning", 0, "Loading alignment model...",
                     {"language": detected_language})
        model_a, metadata = whisperx.load_align_model(
            language_code=detected_language,
            device=device
        )

        emit_progress("aligning", 33, "Aligning timestamps to word level...")
        result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False
        )

        emit_progress("aligning", 100, "Alignment complete")

        # Speaker diarization (optional)
        has_speakers = False
        speaker_segments = None

        if speaker_names and len(speaker_names) > 0:
            try:
                # Get HuggingFace token
                hf_token = os.environ.get("HF_TOKEN")
                if not hf_token:
                    # Try to read from file
                    token_path = Path.home() / ".huggingface" / "token"
                    if token_path.exists():
                        hf_token = token_path.read_text().strip()

                if hf_token:
                    emit_progress("diarizing", 0, "Loading diarization model...")
                    diarize_model = whisperx.DiarizationPipeline(
                        use_auth_token=hf_token,
                        device=device
                    )

                    emit_progress("diarizing", 25, "Running speaker diarization...",
                                 {"min_speakers": min_speakers, "max_speakers": max_speakers})

                    # Run diarization with speaker constraints
                    diarize_kwargs = {}
                    if num_speakers:
                        diarize_kwargs["num_speakers"] = num_speakers
                    else:
                        diarize_kwargs["min_speakers"] = min_speakers
                        diarize_kwargs["max_speakers"] = max_speakers

                    diarize_segments = diarize_model(audio, **diarize_kwargs)

                    emit_progress("diarizing", 75, "Assigning speakers to segments...")

                    # Assign speakers to words
                    result = whisperx.assign_word_speakers(diarize_segments, result)

                    has_speakers = True
                    speaker_segments = diarize_segments

                    num_unique_speakers = len(set(s['speaker'] for s in result['segments'] if 'speaker' in s))
                    emit_progress("diarizing", 100, f"Detected {num_unique_speakers} unique speakers",
                                 {"speakers_detected": num_unique_speakers})
                else:
                    emit_progress("diarizing", 0, "Warning: HF_TOKEN not found. Skipping speaker diarization.")
            except Exception as e:
                emit_progress("diarizing", 0, f"Warning: Speaker diarization failed: {e}")

        # Build segment list with speaker information
        transcription_segments = []
        full_text = []
        text_with_speakers = []

        # Create speaker mapping if names provided
        speaker_mapping = {}
        if has_speakers and speaker_names:
            unique_speakers = sorted(set(
                s.get('speaker', 'UNKNOWN')
                for s in result['segments']
                if 'speaker' in s
            ))
            for i, speaker_id in enumerate(unique_speakers):
                if i < len(speaker_names):
                    speaker_mapping[speaker_id] = speaker_names[i]
                else:
                    speaker_mapping[speaker_id] = f"Speaker {i + 1}"

        current_speaker = None
        for segment in result['segments']:
            segment_text = segment['text'].strip()

            segment_data = {
                "start": segment['start'],
                "end": segment['end'],
                "text": segment_text,
            }

            # Add speaker if available
            if 'speaker' in segment:
                speaker_id = segment['speaker']
                speaker_label = speaker_mapping.get(speaker_id, speaker_id)
                segment_data["speaker"] = speaker_label

                # Build text with speaker labels
                if speaker_label != current_speaker:
                    text_with_speakers.append(f"\n[{speaker_label}] {segment_text}")
                    current_speaker = speaker_label
                else:
                    text_with_speakers.append(f" {segment_text}")
            else:
                text_with_speakers.append(f" {segment_text}")

            transcription_segments.append(segment_data)
            full_text.append(segment_text)

        # Calculate speaker statistics
        speakers_info = None
        if has_speakers and speaker_segments:
            speaker_counts = {}
            for seg in transcription_segments:
                if 'speaker' in seg:
                    speaker = seg['speaker']
                    speaker_counts[speaker] = speaker_counts.get(speaker, 0) + 1

            speakers_info = [
                {"name": speaker, "segmentCount": count}
                for speaker, count in speaker_counts.items()
            ]

        # Calculate total duration
        duration = result['segments'][-1]['end'] if result['segments'] else 0.0

        output = {
            "success": True,
            "text": " ".join(full_text),
            "textWithSpeakers": "".join(text_with_speakers).strip() if has_speakers else None,
            "segments": transcription_segments,
            "language": detected_language,
            "language_probability": 1.0,  # WhisperX doesn't provide this
            "duration": duration,
            "hasSpeakers": has_speakers,
            "speakers": speakers_info,
        }

        return output

    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio with WhisperX (batching + alignment + optional speaker diarization)"
    )
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("--model", default="medium", help="Model size (tiny/base/small/medium/large-v2/large-v3)")
    parser.add_argument("--language", default=None, help="Language code (e.g., 'en', 'es')")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="Device")
    parser.add_argument("--compute-type", default="float16", help="Compute type (float16/int8)")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for processing")
    parser.add_argument("--output", help="Output JSON file path")

    # Speaker diarization options
    parser.add_argument("--speaker-names", nargs="+", help="List of speaker names (e.g., DM Player1 Player2)")
    parser.add_argument("--num-speakers", type=int, help="Exact number of speakers (if known)")
    parser.add_argument("--min-speakers", type=int, default=1, help="Minimum speakers to detect")
    parser.add_argument("--max-speakers", type=int, default=8, help="Maximum speakers to detect")

    args = parser.parse_args()

    # Auto-select compute type based on device
    if args.device == "cpu" and args.compute_type == "float16":
        args.compute_type = "int8"

    result = transcribe_audio(
        args.audio_path,
        model_size=args.model,
        language=args.language,
        device=args.device,
        compute_type=args.compute_type,
        batch_size=args.batch_size,
        speaker_names=args.speaker_names,
        num_speakers=args.num_speakers,
        min_speakers=args.min_speakers,
        max_speakers=args.max_speakers,
    )

    # Output result
    output_json = json.dumps(result, indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
    else:
        print(output_json)

    # Exit with error code if transcription failed
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
