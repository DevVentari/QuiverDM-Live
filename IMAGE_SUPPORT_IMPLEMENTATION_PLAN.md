# QuiverDM Image Support - Master Implementation Plan

## Overview

Complete image support for homebrew content across 4 phases:

1. **Phase 1:** PDF Image Extraction (Week 1-2) - **READY FOR IMPLEMENTATION**
2. **Phase 2:** ComfyUI Integration (Week 3-4) - Planning complete
3. **Phase 3:** Cloud AI Fallback (Week 5) - Planning complete
4. **Phase 4:** UI Components (Week 6-7) - Planning complete

## Phase 1: PDF Image Extraction (READY TO START)

### Agents Ready to Deploy

Three Codex agents are configured with detailed handoff documents:

#### Agent A: Schema + Docling Integration
- **Branch:** `feature/image-schema-docling`
- **Worktree:** `E:\Projects\quiverdm-worktrees\codex-image-a`
- **Handoff:** `CODEX_AGENT_IMAGE_A.md`
- **Tasks:**
  - Update Prisma schema (imageMetadata, extractionPageNumber)
  - Extend Docling to extract images from PDFs
- **Duration:** ~4-6 hours

**Launch command:**
```bash
codex exec --full-auto -C E:\Projects\quiverdm-worktrees\codex-image-a "Implement image extraction support as specified in CODEX_AGENT_IMAGE_A.md"
```

#### Agent B: Worker Image Storage
- **Branch:** `feature/image-worker-storage`
- **Worktree:** `E:\Projects\quiverdm-worktrees\codex-image-b`
- **Handoff:** `CODEX_AGENT_IMAGE_B.md`
- **Tasks:**
  - Store extracted images using storage abstraction
  - Pass images to extraction phase
- **Duration:** ~3-4 hours
- **Depends on:** Agent A completion (Docling returns images)

**Launch command:**
```bash
codex exec --full-auto -C E:\Projects\quiverdm-worktrees\codex-image-b "Implement image storage in PDF worker as specified in CODEX_AGENT_IMAGE_B.md"
```

#### Agent C: Repository + API
- **Branch:** `feature/image-repository-api`
- **Worktree:** `E:\Projects\quiverdm-worktrees\codex-image-c`
- **Handoff:** `CODEX_AGENT_IMAGE_C.md`
- **Tasks:**
  - Match images to items by page number
  - Create manual upload API route
- **Duration:** ~4-5 hours
- **Depends on:** Agent B completion (extractedImages in queue)

**Launch command:**
```bash
codex exec --full-auto -C E:\Projects\quiverdm-worktrees\codex-image-c "Implement image matching and upload API as specified in CODEX_AGENT_IMAGE_C.md"
```

### Execution Strategy

**Sequential (Safe):**
1. Launch Agent A → wait for completion
2. Launch Agent B → wait for completion
3. Launch Agent C → wait for completion
4. Merge all branches to main

**Parallel (Fast, if you trust dependencies):**
1. Launch Agent A immediately
2. After A reports Docling changes, launch Agent B
3. After B reports worker changes, launch Agent C
4. Merge all branches to main

### Phase 1 Success Criteria

- ✅ PDF uploads extract images automatically
- ✅ Images stored in `homebrew-images/extracted/`
- ✅ HomebrewContent.images array populated
- ✅ Manual upload API works
- ✅ Images matched to items by page number

## Phase 2: ComfyUI Integration (Planning Complete)

### Planning Document
- **File:** `CODEX_PHASE2_COMFYUI_PLANNING.md`
- **Status:** Ready for agent planning

### Key Deliverables
- ComfyUI REST client (`src/lib/ai/comfyui.ts`)
- Image generation abstraction (`src/lib/ai/image-generation.ts`)
- BullMQ queue + worker
- tRPC router for generation
- Docker Compose integration

### Launch Planning Agent

```bash
codex exec --full-auto -C E:\Projects\QuiverDM "Read CODEX_PHASE2_COMFYUI_PLANNING.md and create a detailed implementation plan with sub-tasks, breaking down each deliverable into specific code changes with file paths and function signatures. Output the plan as CODEX_PHASE2_DETAILED_PLAN.md"
```

After planning, split into agents:
- Agent D: ComfyUI client + queue
- Agent E: Worker + service
- Agent F: tRPC router + Docker

## Phase 3: Cloud AI Fallback (Planning Complete)

### Planning Document
- **File:** `CODEX_PHASE3_CLOUD_FALLBACK_PLANNING.md`
- **Status:** Ready for agent planning

### Key Deliverables
- Replicate SDXL integration
- DALL-E 3 integration
- Usage tracking service
- Tier limits enforcement

### Launch Planning Agent

```bash
codex exec --full-auto -C E:\Projects\QuiverDM "Read CODEX_PHASE3_CLOUD_FALLBACK_PLANNING.md and create a detailed implementation plan with sub-tasks. Output as CODEX_PHASE3_DETAILED_PLAN.md"
```

After planning, split into agents:
- Agent G: Replicate + DALL-E
- Agent H: Usage tracking + limits

## Phase 4: UI Components (Planning Complete)

### Planning Document
- **File:** `CODEX_PHASE4_UI_PLANNING.md`
- **Status:** Ready for agent planning

### Key Deliverables
- ImageGallery component
- ImageLightbox component
- ImageUploadDialog component
- ImageGenerationDialog component
- Integration into detail pages

### Launch Planning Agent

```bash
codex exec --full-auto -C E:\Projects\QuiverDM "Read CODEX_PHASE4_UI_PLANNING.md and create a detailed implementation plan with sub-tasks. Output as CODEX_PHASE4_DETAILED_PLAN.md"
```

After planning, split into agents:
- Agent I: Gallery + Lightbox
- Agent J: Upload + Generation dialogs
- Agent K: Integration + testing

## Recommended Execution Flow

### Week 1: Phase 1 Implementation
**Monday-Tuesday:**
- Launch Agent A (Schema + Docling)
- Monitor progress, verify completion

**Wednesday-Thursday:**
- Launch Agent B (Worker storage)
- Monitor progress, verify completion

**Friday:**
- Launch Agent C (Repository + API)
- End-to-end testing
- Merge to main

### Week 2: Phase 1 Polish + Phase 2 Planning
**Monday-Tuesday:**
- Bug fixes from Phase 1 testing
- Launch planning agent for Phase 2

**Wednesday-Friday:**
- Create detailed Phase 2 sub-tasks
- Create worktrees for Phase 2 agents
- Write handoff documents

### Week 3-4: Phase 2 Implementation
- Execute Phase 2 agents
- Integration testing
- Launch Phase 3 planning

### Week 5: Phase 3 Implementation
- Execute Phase 3 agents
- Usage tracking testing
- Launch Phase 4 planning

### Week 6-7: Phase 4 Implementation
- Execute Phase 4 agents
- UI/UX testing
- Final integration testing
- Production deployment

## Progress Tracking

Update this checklist as phases complete:

### Phase 1: PDF Image Extraction
- [ ] Agent A: Schema + Docling (Task #2)
- [ ] Agent B: Worker Storage (Task #3)
- [ ] Agent C: Repository + API (Task #4, #5)
- [ ] End-to-end testing (Task #6)
- [ ] Merged to main

### Phase 2: ComfyUI Integration
- [ ] Planning complete
- [ ] Agents deployed
- [ ] Implementation complete
- [ ] Testing complete
- [ ] Merged to main

### Phase 3: Cloud AI Fallback
- [ ] Planning complete
- [ ] Agents deployed
- [ ] Implementation complete
- [ ] Testing complete
- [ ] Merged to main

### Phase 4: UI Components
- [ ] Planning complete
- [ ] Agents deployed
- [ ] Implementation complete
- [ ] Testing complete
- [ ] Merged to main

## Cost Estimates

### Development Time
- Phase 1: 12-15 hours (3 agents × 4-5 hours)
- Phase 2: 20-25 hours (3 agents × 6-8 hours)
- Phase 3: 8-10 hours (2 agents × 4-5 hours)
- Phase 4: 30-35 hours (3 agents × 10-12 hours)
- **Total:** ~70-85 hours

### Cloud Costs (Post-Implementation)
- Free tier: $0.23/month (10 images via Replicate)
- Pro tier: $2.30/month (100 images via Replicate)
- Team tier: $23/month (1000 images via Replicate)
- ComfyUI: $0 (local GPU, free)

## Risk Mitigation

### Phase 1 Risks
- **Docling doesn't support image extraction:** Return empty array, document limitation
- **Storage fails:** Already has error handling in storage abstraction
- **Page matching inaccurate:** Expected, not all items have page numbers

### Phase 2 Risks
- **No GPU available:** Phase 3 cloud providers are fallback
- **ComfyUI API unstable:** Implement robust error handling + retries
- **Model downloads fail:** Pre-download models in Docker image

### Phase 3 Risks
- **API costs exceed budget:** Set hard limits in Replicate/OpenAI dashboards
- **API keys exposed:** Use environment variables, never commit
- **Rate limits hit:** Implement exponential backoff

### Phase 4 Risks
- **Performance issues with many images:** Lazy loading, virtualization
- **Mobile UX poor:** Prioritize responsive design testing
- **Accessibility gaps:** Automated a11y testing + manual review

## Next Steps

1. **Review Phase 1 handoff documents:**
   - `codex-image-a/CODEX_AGENT_IMAGE_A.md`
   - `codex-image-b/CODEX_AGENT_IMAGE_B.md`
   - `codex-image-c/CODEX_AGENT_IMAGE_C.md`

2. **Launch Agent A:**
   ```bash
   codex exec --full-auto -C E:\Projects\quiverdm-worktrees\codex-image-a "Implement CODEX_AGENT_IMAGE_A.md"
   ```

3. **Monitor progress:**
   - Check Codex output logs
   - Verify commits to `feature/image-schema-docling`
   - Test Prisma schema changes

4. **After Agent A completes:**
   - Launch Agent B
   - Continue sequential or parallel execution

## Questions?

Contact main Claude instance for:
- Clarification on handoff documents
- Adjustments to agent task split
- Emergency bug fixes during implementation
- Architecture decision guidance
