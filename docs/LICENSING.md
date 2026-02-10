# QuiverDM Third-Party Licenses

## Commercial Safety Statement

All dependencies in QuiverDM are compatible with commercial SaaS deployment. There are **zero AGPLv3 dependencies** in the codebase or Docker images.

## Key Dependencies

### PDF Processing

- **Marker (GPL-3.0-or-later)**: Server-side PDF to Markdown conversion
  - GPL permits SaaS use without source code disclosure
  - Used as primary PDF processor
  - Repository: https://github.com/VikParuchuri/marker

- **pdfplumber (MIT)**: Fallback PDF extractor
  - Fully commercial-friendly MIT license
  - Automatically used if Marker crashes
  - Repository: https://github.com/jsvine/pdfplumber

### AI & Machine Learning

- **WhisperX (BSD)**: Speech recognition and speaker diarization
  - Commercial use allowed
  - Repository: https://github.com/m-bain/whisperX

- **PyTorch (BSD)**: Deep learning framework
  - Commercial use allowed
  - Used by WhisperX and Marker

- **Ollama (MIT)**: Local LLM runtime
  - Commercial use allowed
  - Repository: https://github.com/ollama/ollama

### Backend Stack

- **Next.js (MIT)**: React framework
- **tRPC (MIT)**: Type-safe API layer
- **Prisma (Apache-2.0)**: Database ORM
- **BullMQ (MIT)**: Job queue
- **Redis (BSD)**: Cache and queue backend
- **PostgreSQL (PostgreSQL License)**: Database

## Removed Dependencies

- **PyMuPDF (AGPLv3)**: Removed 2026-02-10
  - Previously used as PDF fallback
  - Replaced with pdfplumber (MIT)
  - No traces remain in codebase

## License Compliance

### SaaS Deployment
- ✅ No AGPL dependencies
- ✅ GPL dependencies used server-side only (SaaS-safe)
- ✅ All client-side code is permissively licensed

### Open Source Contributions
If you modify GPL-licensed components (Marker), you must:
1. Publish modifications under GPL-3.0-or-later
2. Provide source code to users who receive the software

For SaaS deployment (no distribution), these requirements do not apply.

## Audit History

- **2026-02-10**: Removed PyMuPDF (AGPLv3), added pdfplumber (MIT)
- **2025-11-XX**: Initial architecture with GPL-3.0 Marker (SaaS-safe)

## Questions?

For licensing concerns, consult your legal team. This document is informational only and does not constitute legal advice.

**Last Updated**: 2026-02-10
