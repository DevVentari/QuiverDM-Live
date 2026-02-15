# Codex Agent A — Production Readiness & Polish

> **Branch**: `codex/production-readiness`
> **Worktree**: `.worktrees/codex-agent-a/`
> **Scope**: Frontend cleanup, accessibility, logging, no backend logic changes
> **DO NOT touch**: `src/server/services/`, `src/server/routers/`, `prisma/schema.prisma`

---

## Tasks

### Task 1: Console Log Cleanup (Priority: High)

Replace debug `console.log`/`console.error` calls in frontend pages with proper error handling or remove them. Keep server-side logging in API routes but ensure it's structured.

**Files to clean:**
- `src/app/(app)/homebrew/pdfs/page.tsx` — remove console.error, use toast instead
- `src/app/(app)/campaigns/[slug]/homebrew/page.tsx` — remove console.error, use toast
- `src/app/(app)/campaigns/[slug]/npcs/[npcId]/edit/page.tsx` — remove console.error (already has toast)
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — remove console.error

**Rule**: In `'use client'` components, errors should show toasts, not console.error. In API routes, console.error is fine (server-side only).

### Task 2: Production Console Stripping (Priority: High)

Add a webpack/Next.js config to strip `console.log` (but keep `console.error` and `console.warn`) from production builds.

**File to modify**: `next.config.js`

Add to the webpack config:
```javascript
webpack: (config, { isServer, dev }) => {
  config.externals = config.externals || [];
  config.externals.push('bufferutil', 'utf-8-validate');

  // Strip console.log in production client builds
  if (!dev && !isServer) {
    const TerserPlugin = require('terser-webpack-plugin');
    config.optimization.minimizer = config.optimization.minimizer || [];
    config.optimization.minimizer.push(
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: ['log', 'debug', 'info'],
          },
        },
      })
    );
  }

  return config;
}
```

If TerserPlugin is not available in Next.js 15, just add `compiler.removeConsole` to next.config.js instead:
```javascript
compiler: {
  removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
},
```

### Task 3: Accessibility Improvements (Priority: Medium)

Add ARIA attributes and improve accessibility across key pages. Focus on interactive elements.

**Pages to improve (in priority order):**

1. **`src/app/(app)/admin/invites/page.tsx`**
   - Tab buttons need `role="tab"`, `aria-selected`, `aria-controls`
   - Tab panels need `role="tabpanel"`, `id` matching aria-controls
   - Copy buttons need `aria-label="Copy invite code"`

2. **`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`**
   - Recording play/hide buttons need `aria-expanded`
   - Search input needs `aria-label="Search transcripts"`
   - Segment timestamps need `role="timer"` or appropriate semantic

3. **`src/app/(app)/feedback/page.tsx`**
   - Star rating buttons already have aria-label (good)
   - Form needs `aria-describedby` on fields with validation requirements

4. **`src/app/(app)/settings/page.tsx`**
   - API key visibility toggles need `aria-label="Show/hide API key"`
   - Progress bars need `aria-label` describing what they measure

5. **`src/components/sidebar.tsx`**
   - Nav element needs `aria-label="Main navigation"`
   - Active link needs `aria-current="page"`

### Task 4: Image Alt Text Audit (Priority: Medium)

Find all `<img>` tags and ensure they have descriptive `alt` text.

Search for: `<img` in all `.tsx` files under `src/app/` and `src/components/`

Common patterns to fix:
- NPC portraits: `alt={npc.name}` or `alt="NPC portrait"`
- Character portraits: `alt={character.name}`
- User avatars: `alt={user.name || "User avatar"}`

### Task 5: Error Boundary Component (Priority: Low)

Create a reusable error boundary for app pages.

**Create**: `src/components/error-boundary.tsx`
```typescript
'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <Button onClick={() => this.setState({ hasError: false })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
```

Then wrap the main app layout in it:
- `src/app/(app)/app-shell.tsx` — wrap children in `<ErrorBoundary>`

---

## Key Patterns

**Toast for user-facing errors:**
```typescript
import { useToast } from '@/hooks/use-toast';
const { toast } = useToast();
toast({ title: 'Error', description: error.message, variant: 'destructive' });
```

**UI components from `@/components/ui/`** — don't install new packages.

**Dark mode** — use Tailwind theme tokens, never hardcode colors.

---

## Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint        # pass
npm run build       # production build succeeds
```

Commit all changes on `codex/production-readiness` branch with descriptive message.
