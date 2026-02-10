# CRITICAL SECURITY FIX PLAN

## ⚠️ IMMEDIATE ISSUE

**Your test campaigns are showing up for the new account because there is NO user filtering in the queries.**

The application has **critical security vulnerabilities** where users can access, modify, and delete each other's data.

### Security Audit Results
- **76 total tRPC procedures** across 11 routers
- **64 CRITICAL vulnerabilities** - no ownership verification
- **11 MEDIUM risk** - client-controlled userId
- **1 properly secured** (homebrew.createContent)
- **Overall Security Score: 1.3%**

---

## ✅ COMPLETED FIXES

### 1. user-settings.ts (CRITICAL - API KEY EXPOSURE)
**Status**: ✅ FIXED

All 4 procedures secured:
- `getSettings` - now uses protectedProcedure, no userId input
- `getDecryptedKey` - secured with session auth
- `updateApiKeys` - secured with session auth
- `deleteApiKey` - secured with session auth

**File**: `src/server/routers/user-settings.ts`

### 2. Ownership Verification Helpers
**Status**: ✅ CREATED

**File**: `src/server/lib/ownership.ts`

Helper functions created:
- `verifyCampaignOwnership()`
- `verifySessionOwnership()`
- `verifyNPCOwnership()`
- `verifyPlayerOwnership()`
- `verifyRecordingOwnership()`
- `verifyHomebrewOwnership()`
- `verifyHomebrewPDFOwnership()`
- `verifyTranscriptOwnership()`

### 3. campaigns.ts Template
**Status**: ✅ TEMPLATE CREATED

**File**: `src/server/routers/campaigns-fixed.ts`

Fully secured version showing the pattern:
- All procedures use `protectedProcedure`
- No userId in input schemas
- Uses `ctx.session.user.id` exclusively
- Ownership verification on all get/update/delete operations

---

## 🔴 REMAINING CRITICAL FIXES NEEDED

### Priority 1: Core Data Access (Most Important)

#### 1. campaigns.ts
**File**: `src/server/routers/campaigns.ts`
**Action**: Replace with `campaigns-fixed.ts` content
**Impact**: Fixes the issue you're experiencing - users seeing each other's campaigns

```bash
# Quick fix:
cp src/server/routers/campaigns-fixed.ts src/server/routers/campaigns.ts
```

#### 2. homebrew.ts (22 procedures)
**File**: `src/server/routers/homebrew.ts`
**Status**: Only `createContent` is secure

**Vulnerable procedures**:
- `getContent` - anyone can query any user's homebrew
- `getContentById` - no ownership check
- `updateContent` - can modify other users' content
- `deleteContent` - can delete other users' content
- `getPDFs` - client-controlled userId
- `deletePDF` - no ownership verification
- And 16 more...

**Pattern to apply**:
```typescript
// BEFORE (vulnerable)
getContent: publicProcedure
  .input(z.object({ userId: z.string(), ... }))
  .query(async ({ input }) => {
    return prisma.homebrewContent.findMany({
      where: { userId: input.userId }
    });
  })

// AFTER (secure)
getContent: protectedProcedure
  .input(z.object({ ... })) // Remove userId
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    return prisma.homebrewContent.findMany({
      where: { userId }
    });
  })
```

### Priority 2: Related Campaign Data

#### 3. npcs.ts (7 procedures)
**File**: `src/server/routers/npcs.ts`

All procedures need campaign ownership verification:
```typescript
// Add to each procedure:
await verifyCampaignOwnership(input.campaignId, ctx.session.user.id);
```

#### 4. players.ts (5 procedures)
**File**: `src/server/routers/players.ts`

Same pattern - verify campaign ownership before accessing players.

#### 5. sessions.ts (7 procedures)
**File**: `src/server/routers/sessions.ts`

Verify campaign ownership for all operations.

#### 6. session-recordings.ts (6 procedures)
**File**: `src/server/routers/session-recordings.ts`

Verify session → campaign ownership chain.

#### 7. transcript.ts (4 procedures)
**File**: `src/server/routers/transcript.ts`

Verify session → campaign ownership.

#### 8. session-transcription.ts (3 procedures)
**File**: `src/server/routers/session-transcription.ts`

Verify ownership before transcription operations.

### Priority 3: Additional Content

#### 9. homebrew-dndbeyond.ts (4 procedures)
**File**: `src/server/routers/homebrew-dndbeyond.ts`

Switch to protectedProcedure, verify homebrew ownership.

#### 10. docling.ts (6 procedures)
**File**: `src/server/routers/docling.ts`

Verify PDF ownership before processing.

---

## 🚀 QUICK FIX FOR YOUR IMMEDIATE ISSUE

To fix the problem where you're seeing test campaigns in the new account:

**Option A: Quick Fix (campaigns only)**
```bash
# Replace campaigns.ts with the fixed version
cp src/server/routers/campaigns-fixed.ts src/server/routers/campaigns.ts

# Also need to update any pages that call campaigns.getAll
# Remove userId from the tRPC call
```

**Option B: Use Empty Database for New Account**
```bash
# Clear all test data and start fresh
npm run db:studio
# Manually delete test campaigns/data via Prisma Studio
```

---

## 📝 SYSTEMATIC FIX PROCEDURE

For each router file, follow this pattern:

### Step 1: Update Imports
```typescript
// OLD
import { router, publicProcedure } from '../trpc';

// NEW
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { verifyCampaignOwnership } from '../lib/ownership'; // or appropriate helper
```

### Step 2: Convert Procedures

**For queries that list user's own data:**
```typescript
// OLD
getAll: publicProcedure
  .input(z.object({ userId: z.string() }))
  .query(async ({ input }) => {
    return prisma.model.findMany({ where: { userId: input.userId } });
  })

// NEW
getAll: protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return prisma.model.findMany({ where: { userId } });
  })
```

**For queries that access specific resources:**
```typescript
// OLD
getById: publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    return prisma.model.findUnique({ where: { id: input.id } });
  })

// NEW
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;
    await verifyModelOwnership(input.id, userId); // Verify first
    return prisma.model.findUnique({ where: { id: input.id } });
  })
```

**For mutations (create/update/delete):**
```typescript
// OLD
create: publicProcedure
  .input(z.object({ userId: z.string(), ... }))
  .mutation(async ({ input }) => {
    return prisma.model.create({ data: input });
  })

// NEW
create: protectedProcedure
  .input(z.object({ ... })) // Remove userId
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;
    return prisma.model.create({ data: { ...input, userId } });
  })
```

### Step 3: Update Client Calls

In your React components, remove userId from tRPC calls:

```typescript
// OLD
const { data } = trpc.campaigns.getAll.useQuery({
  userId: 'temp-user-id'
});

// NEW
const { data } = trpc.campaigns.getAll.useQuery();
```

---

## 🔍 FILES THAT NEED CLIENT UPDATES

After fixing routers, these files likely call the old APIs:

1. Campaign pages:
   - `src/app/page.tsx` (homepage)
   - `src/app/campaigns/[slug]/page.tsx`
   - Any components that list campaigns

2. Homebrew pages:
   - `src/app/homebrew/page.tsx`
   - `src/app/homebrew/[id]/page.tsx`
   - Homebrew list components

3. NPC/Player/Session pages:
   - Search for `.useQuery({ userId:` or `.useMutation({ userId:`
   - Remove those userId parameters

---

## ⚡ AUTOMATED FIX SCRIPT

I can create a script to automatically fix most of these issues. However, **manual review is critical** for security.

Would you like me to:

**Option 1**: Fix them all programmatically (faster but needs review)
**Option 2**: Fix them one router at a time with your approval
**Option 3**: Provide you with detailed instructions for each router

---

## 🧪 TESTING PLAN

After fixes:

1. **Create two test accounts**:
   - test1@example.com
   - test2@example.com

2. **Test data isolation**:
   - Create campaign as test1
   - Sign in as test2
   - Verify test2 CANNOT see test1's campaign
   - Verify test2 CANNOT access test1's campaign by ID
   - Verify test2 CANNOT modify test1's campaign

3. **Test each resource type**:
   - Campaigns
   - Homebrew
   - NPCs
   - Players
   - Sessions
   - Recordings

4. **Test attack scenarios**:
   - Try to access `/campaigns/test1-campaign-id` as test2
   - Try to call mutations with test1's resource IDs
   - Verify FORBIDDEN errors

---

## 📊 CURRENT STATUS SUMMARY

| Router | Status | Procedures Fixed | Procedures Remaining |
|--------|--------|------------------|---------------------|
| user-settings.ts | ✅ COMPLETE | 4/4 | 0 |
| campaigns.ts | ⏳ TEMPLATE READY | 0/7 | 7 |
| homebrew.ts | 🔴 CRITICAL | 1/23 | 22 |
| npcs.ts | 🔴 CRITICAL | 0/7 | 7 |
| players.ts | 🔴 CRITICAL | 0/5 | 5 |
| sessions.ts | 🔴 CRITICAL | 0/7 | 7 |
| session-recordings.ts | 🔴 CRITICAL | 0/6 | 6 |
| transcript.ts | 🔴 CRITICAL | 0/4 | 4 |
| session-transcription.ts | 🔴 CRITICAL | 0/3 | 3 |
| homebrew-dndbeyond.ts | 🟡 MEDIUM | 0/4 | 4 |
| docling.ts | 🟡 MEDIUM | 0/6 | 6 |

**Total Progress**: 5/76 procedures secured (6.6%)

---

## 🎯 RECOMMENDED IMMEDIATE ACTION

1. **URGENT**: Replace `campaigns.ts` with `campaigns-fixed.ts` to fix your immediate issue
2. **HIGH**: Fix `homebrew.ts` (your main feature)
3. **MEDIUM**: Fix NPC/Player/Session routers
4. **LOW**: Fix transcription/docling routers

Do you want me to proceed with fixing all the routers programmatically, or would you prefer to do them manually with the template I provided?
