# Testing Authentication with Browserbase

Quick testing guide to verify authentication is working on production.

## Current Status (2025-11-18)

✅ **Webhook Added:** Vercel will now auto-deploy on GitHub pushes
⚠️ **Need to Verify:** Latest code with invite-only system is deployed

## Test Authentication Protection

### Using Browserbase (via Claude Code):

```javascript
// 1. Navigate to production site
mcp__MCP_DOCKER__browser_navigate
url: https://quiver.blakewales.au

// 2. Try to access campaigns without login
mcp__MCP_DOCKER__browser_click
element: "Campaigns link"
ref: e10  // or find via snapshot

// Expected behavior:
// - Should redirect to /auth/signin
// - OR show "Unauthorized" error
// - Should NOT show campaign data
```

### Test Signup Requires Invite Code:

```javascript
// 1. Go to signup page
mcp__MCP_DOCKER__browser_navigate
url: https://quiver.blakewales.au/auth/signup

// 2. Check for invite code field
mcp__MCP_DOCKER__browser_snapshot

// Expected: Should see "Invite Code" field in form

// 3. Try signup without invite code (should fail)
// 4. Try signup with invalid code (should fail)
// 5. Try signup with valid code (should succeed)
```

## Valid Test Invite Codes

Use these codes for testing signup:
```
180F9349
8F352D5C
415B2509
27EA38D7
812205E4
```

## Quick Verification Checklist

- [ ] Signup page has "Invite Code" field
- [ ] Cannot access /campaigns without login
- [ ] Cannot create account without invite code
- [ ] Invalid invite code shows error
- [ ] Valid invite code allows signup
- [ ] Used invite code cannot be reused

## Current Issues to Check

1. **Campaigns page shows "Loading..." instead of redirecting**
   - Check: Does `/campaigns` redirect to `/auth/signin`?
   - Fix: May need middleware or client-side redirect

2. **Check which commit is deployed**
   - Should be: `fbb4528` or newer (has invite system)
   - Check: View source or deployment logs

## Manual Testing (No Browserbase)

1. **Open incognito window:** https://quiver.blakewales.au
2. **Click "Get Started"** → Should see invite code field
3. **Try to access:** https://quiver.blakewales.au/campaigns
4. **Should:** Redirect to signin OR show unauthorized

## If Authentication Not Working

### Check 1: Verify Deployment
```bash
# In Vercel dashboard, check deployment commit
# Should see: fbb4528 "Implement invite-only registration system"
```

### Check 2: Check Environment Variables
```bash
# In Vercel → Settings → Environment Variables
# Verify:
DATABASE_URL=<Railway PostgreSQL>
NEXTAUTH_SECRET=<generated secret>
NEXTAUTH_URL=https://quiver.blakewales.au
```

### Check 3: Manual Redeploy
```bash
# Vercel Dashboard → Deployments → Redeploy latest
```

### Check 4: Database Migration
```bash
# Connect to Railway PostgreSQL and verify InviteCode table exists
DATABASE_URL="railway-url" npx prisma studio
# Navigate to InviteCode table → should see 10 codes
```

## Files to Check

- `src/app/api/auth/signup/route.ts` - Should validate invite code
- `src/app/auth/signup/page.tsx` - Should have invite code field
- `prisma/schema.prisma` - Should have InviteCode model
- `src/server/routers/campaigns.ts` - Should use protectedProcedure

## Next Session Commands

```bash
# Check latest commit deployed
git log --oneline -5

# Verify webhook triggers
# Push a dummy commit and watch Vercel

# Test with Browserbase
# Use commands above to verify authentication
```
