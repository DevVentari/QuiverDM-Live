# QuiverDM Workflow Testing Log
**Date:** 2026-02-09
**Environment:** Local development (fresh database)
**Invite Code:** `TEST2026`

## Test Sequence

### 1. Authentication & Registration
- [ ] Register new user with invite code `TEST2026`
- [ ] Sign in with new account
- [ ] Sign out
- [ ] Sign back in

**Errors:**

---

### 2. Campaign Management
- [ ] Create new campaign
- [ ] View campaign dashboard
- [ ] Edit campaign details
- [ ] Generate campaign invite code
- [ ] Invite member to campaign
- [ ] View campaign members list

**Errors:**

---

### 3. Session Management
- [ ] Create new session
- [ ] View session detail
- [ ] Add session quick notes
- [ ] Edit session
- [ ] Delete session

**Errors:**

---

### 4. Session Recording & Transcription
- [ ] Upload audio recording (.mp3/.wav)
- [ ] Upload video recording (.mp4)
- [ ] View transcription progress
- [ ] View completed transcript
- [ ] View speaker diarization

**Errors:**

---

### 5. PDF Processing & Homebrew
- [ ] Upload homebrew PDF
- [ ] View real-time processing progress (new feature!)
- [ ] Verify WebSocket connection shows page counts
- [ ] Verify discovered items display (spells, creatures, etc.)
- [ ] View processed markdown content
- [ ] Browse extracted homebrew items

**Errors:**

---

### 6. Character Management
- [ ] Create player character
- [ ] View character sheet
- [ ] Edit character stats
- [ ] Delete character

**Errors:**

---

### 7. NPC Management
- [ ] Create NPC
- [ ] View NPC stat block
- [ ] Edit NPC
- [ ] Upload NPC image
- [ ] Delete NPC

**Errors:**

---

### 8. Search & Discovery
- [ ] Search for homebrew content
- [ ] Search for spells
- [ ] Search for creatures
- [ ] Filter search results

**Errors:**

---

### 9. Settings & Profile
- [ ] View user settings
- [ ] Update profile information
- [ ] Manage API keys (if applicable)

**Errors:**

---

## Summary

**Total Workflows:** 9
**Tests Passed:** 0
**Tests Failed:** 0
**Critical Errors:** 0
**Minor Issues:** 0

---

## Notes

- Real-time PDF progress component is NEW - first time testing in production-like scenario
- WebSocket connection at ws://localhost:3004
- Fresh database, no existing data

---

## Next Steps

1. Start with Authentication workflow
2. Proceed sequentially through each workflow
3. Document ALL errors (even minor UI issues)
4. Note performance issues
5. Test edge cases
