# Phase 2: ComfyUI Integration - Implementation Decisions

## User Decisions (2026-02-18)

### 1. AI Model Selection ✅
**Decision:** Support all 3 models with user choice

**Models to implement:**
- **SD 1.5** - Fast generation (20-30 sec), 4GB VRAM
- **SDXL** - Balanced quality/speed (30-60 sec), 8GB VRAM ⭐ *Default*
- **Flux** - Best quality (60-120 sec), 12GB+ VRAM

**Implementation notes:**
- Add model selector in UI (ImageGenerationDialog)
- Store model preference per generation job
- ComfyUI client needs to support multiple workflow templates
- Display estimated generation time based on model

### 2. Auto-Download Models ✅
**Decision:** Yes - automatic model downloading

### 3. Progress Updates ✅
**Decision:** WebSocket (preferred)

### 4. Custom Workflows ✅
**Decision:** Allow later (not in MVP)

### 5. NSFW Content Filtering ✅
**Decision:** None for now

## Updated Phase 2 Scope

### Core Features
- ✅ ComfyUI client with 3 model support (SD15, SDXL, Flux)
- ✅ Auto-download models on first run
- ✅ WebSocket real-time progress
- ✅ Preset workflows only (no custom)
- ✅ No NSFW filtering

### Timeline Estimate
- **Agent D:** ComfyUI client + workflows + queue (8-10 hours)
- **Agent E:** Worker + service + WebSocket (10-12 hours)
- **Agent F:** tRPC router + Docker (6-8 hours)
- **Total:** ~24-30 hours
