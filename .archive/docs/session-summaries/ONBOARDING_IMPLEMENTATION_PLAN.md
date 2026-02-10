# New User Onboarding Implementation Plan

## Overview
Create a comprehensive onboarding experience for new users including:
- Welcome wizard
- Campaign creation walkthrough
- D&D Beyond integration guide
- Cobalt cookie helper

## Current Issue
**Create Campaign button not working** - No onClick handler attached to buttons

## Implementation Plan

### Phase 1: Fix Create Campaign Button (IMMEDIATE)
**File:** `src/app/campaigns/page.tsx`

Add onClick handlers:
```typescript
// Line 30-33 (Empty state)
<Button size="3" onClick={() => router.push('/campaigns/new')}>
  <Plus size={20} />
  Create Campaign
</Button>

// Line 45-48 (With campaigns)
<Button size="3" onClick={() => router.push('/campaigns/new')}>
  <Plus size={20} />
  New Campaign
</Button>
```

### Phase 2: Create Campaign Creation Page
**File:** `src/app/campaigns/new/page.tsx`

Multi-step form:
1. Basic Info (name, description)
2. Players (import from D&D Beyond or manual)
3. Settings (system, starting level, etc.)

### Phase 3: Onboarding Wizard Components

**Structure:**
```
src/components/Onboarding/
├── OnboardingWizard.tsx          # Main wizard dialog
├── steps/
│   ├── WelcomeStep.tsx           # Welcome & overview
│   ├── CreateCampaignStep.tsx    # Campaign creation
│   ├── DNDBeyondStep.tsx         # D&D Beyond setup
│   └── CompleteStep.tsx          # Completion & next steps
└── CobaltCookieHelper.tsx        # Cookie extraction helper
```

### Phase 4: User Onboarding State

**Database:**
Add to User model:
```prisma
model User {
  // ... existing fields
  onboardingCompleted Boolean @default(false)
  onboardingStep      String? // 'welcome' | 'campaign' | 'dndbeyond' | 'complete'
  onboardingSkipped   Boolean @default(false)
}
```

**tRPC Router:**
```typescript
// src/server/routers/onboarding.ts
export const onboardingRouter = router({
  getStatus: publicProcedure.query(async ({ ctx }) => {
    // Return user's onboarding status
  }),

  updateProgress: publicProcedure
    .input(z.object({
      step: z.string(),
      completed: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Update onboarding progress
    }),

  skip: publicProcedure.mutation(async ({ ctx }) => {
    // Mark onboarding as skipped
  }),
});
```

### Phase 5: D&D Beyond Integration Guide

**Components:**

1. **DNDBeyondStep.tsx**
   - Explains what cobalt cookie is
   - Shows where to find it
   - Auto-detection if possible

2. **CobaltCookieHelper.tsx**
   - Step-by-step guide with screenshots
   - Browser extension detection
   - Manual entry fallback
   - Test connection button

**Content:**
```markdown
# D&D Beyond Integration

## What is a Cobalt Cookie?
The cobalt cookie is your authentication token for D&D Beyond.
It allows QuiverDM to import your character data.

## How to Get Your Cobalt Cookie

### Method 1: Auto-Detection (Easiest)
1. Make sure you're logged into D&D Beyond in this browser
2. Click "Auto-Detect" below
3. We'll try to find your cookie automatically

### Method 2: Browser Extension
1. Install "EditThisCookie" or "Cookie-Editor"
2. Visit dndbeyond.com
3. Find cookie named "CobaltSession"
4. Copy the value
5. Paste below

### Method 3: Developer Tools
1. Go to dndbeyond.com
2. Press F12 (Developer Tools)
3. Go to Application > Cookies
4. Find "CobaltSession"
5. Copy the value
```

### Phase 6: Auto Cookie Detection

**Implementation:**
```typescript
// src/lib/dndbeyond-cookie-helper.ts

export async function detectCobaltCookie(): Promise<string | null> {
  try {
    // Method 1: Check if user is on dndbeyond.com
    if (window.location.hostname.includes('dndbeyond.com')) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'CobaltSession') {
          return value;
        }
      }
    }

    // Method 2: Try fetching from dndbeyond API
    // (Only works if user is logged in and CORS allows)
    const response = await fetch('https://www.dndbeyond.com/api/config/json', {
      credentials: 'include',
    });

    if (response.ok) {
      // Cookie exists and is valid
      return 'detected'; // Signal successful detection
    }

    return null;
  } catch (error) {
    console.error('Cookie detection failed:', error);
    return null;
  }
}

export async function testCobaltCookie(cookie: string): Promise<boolean> {
  try {
    // Test the cookie by making an API call
    const response = await fetch('/api/dndbeyond/test-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
```

### Phase 7: Wizard Flow

**Trigger:**
- After successful signup/signin
- Check if `onboardingCompleted === false`
- Show OnboardingWizard dialog

**Steps:**

1. **Welcome Step**
   - Brief intro to QuiverDM
   - Key features highlight
   - "Let's get started" button

2. **Create Campaign Step**
   - Inline campaign creation form
   - Name, description, system
   - Import from D&D Beyond option
   - Cannot proceed without creating

3. **D&D Beyond Step**
   - Optional but recommended
   - Cobalt cookie helper
   - Import characters option
   - Skip button available

4. **Complete Step**
   - Congratulations message
   - Quick tour of features
   - "Go to Campaign" button

### Phase 8: Campaign Creation Form

**File:** `src/app/campaigns/new/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  system: z.string().default('5e'),
  bannerUrl: z.string().url().optional(),
});

export default function NewCampaignPage() {
  const router = useRouter();
  const createMutation = trpc.campaigns.create.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system: '5e',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const campaign = await createMutation.mutateAsync(formData);
      router.push(`/campaigns/${campaign.slug}`);
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  return (
    <Container>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
    </Container>
  );
}
```

### Phase 9: Integration Points

**After Signup:**
```typescript
// src/app/auth/signup/page.tsx
// After successful signup, redirect to campaigns with onboarding flag
router.push('/campaigns?onboarding=true');
```

**Campaigns Page:**
```typescript
// src/app/campaigns/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { OnboardingWizard } from '@/components/Onboarding/OnboardingWizard';

export default function CampaignsPage() {
  const searchParams = useSearchParams();
  const showOnboarding = searchParams.get('onboarding') === 'true';
  const { data: user } = trpc.user.getCurrent.useQuery();

  const shouldShowOnboarding = showOnboarding ||
    (user && !user.onboardingCompleted && campaigns?.length === 0);

  return (
    <>
      {shouldShowOnboarding && (
        <OnboardingWizard
          open={true}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Rest of page */}
    </>
  );
}
```

## Implementation Order

1. ✅ Fix Create Campaign buttons (IMMEDIATE)
2. Create `/campaigns/new` page
3. Build OnboardingWizard component
4. Create individual step components
5. Add cobalt cookie helper
6. Add onboarding fields to database
7. Create onboarding tRPC router
8. Integrate with auth flow
9. Test complete flow
10. Add analytics tracking

## Features to Include

### Welcome Step
- QuiverDM logo and tagline
- "What you can do" list
- Estimated setup time
- Privacy note

### Campaign Creation
- Campaign name (required)
- Description (optional)
- D&D system dropdown (5e, Pathfinder, etc.)
- Starting level
- Banner image upload

### D&D Beyond Import
- Cookie helper with visual guide
- Test connection button
- Character import list
- Save cookie for future use

### Completion
- Success animation
- "What's next" checklist:
  - [ ] Upload session recording
  - [ ] Add homebrew content
  - [ ] Import characters
  - [ ] Create first session

## Security Considerations

1. **Cobalt Cookie Storage**
   - Encrypt in database
   - Store per-user
   - Allow deletion
   - Auto-expire after 30 days

2. **Rate Limiting**
   - Limit D&D Beyond API calls
   - Prevent abuse
   - Cache character data

3. **Validation**
   - Validate cookie format
   - Test before saving
   - Handle expired cookies

## User Experience

1. **Progress Persistence**
   - Save progress at each step
   - Allow resuming later
   - Don't lose data on refresh

2. **Skip Option**
   - Always available
   - Can return later from settings
   - Mark as completed to not show again

3. **Help & Support**
   - Help icon on each step
   - Link to detailed docs
   - Video tutorials

## Analytics Events

Track:
- `onboarding_started`
- `onboarding_step_completed` (with step name)
- `onboarding_completed`
- `onboarding_skipped`
- `campaign_created_in_onboarding`
- `dndbeyond_configured_in_onboarding`

---

## Next Steps

Start with fixing the Create Campaign button, then build out the campaign creation page, followed by the onboarding wizard components.
