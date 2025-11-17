# OAuth Provider Setup Guide

This guide shows you how to set up Google, GitHub, and Discord OAuth authentication for QuiverDM.

## Quick Summary

After setup, add these to your `.env.local`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Discord OAuth (already set up)
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

---

## Google OAuth Setup

### Step 1: Go to Google Cloud Console
1. Visit https://console.cloud.google.com/
2. Sign in with your Google account
3. Create a new project or select existing one

### Step 2: Enable Google+ API
1. Go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click **Enable**

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Configure consent screen if prompted:
   - User Type: **External**
   - App name: **QuiverDM**
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if needed

### Step 4: Configure OAuth Client
1. Application type: **Web application**
2. Name: **QuiverDM**
3. Authorized JavaScript origins:
   ```
   http://localhost:3001
   http://localhost:3000
   https://yourdomain.com (production)
   ```
4. Authorized redirect URIs:
   ```
   http://localhost:3001/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```
5. Click **Create**

### Step 5: Copy Credentials
1. Copy the **Client ID**
2. Copy the **Client Secret**
3. Add to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your_copied_client_id
   GOOGLE_CLIENT_SECRET=your_copied_client_secret
   ```

---

## GitHub OAuth Setup

### Step 1: Go to GitHub Settings
1. Visit https://github.com/settings/developers
2. Click **OAuth Apps** (or use https://github.com/settings/applications/new directly)

### Step 2: Register New Application
1. Click **New OAuth App**
2. Fill in the form:
   - **Application name:** QuiverDM
   - **Homepage URL:** `http://localhost:3001` (for development)
   - **Application description:** AI-powered D&D session management
   - **Authorization callback URL:** `http://localhost:3001/api/auth/callback/github`

### Step 3: Register the App
1. Click **Register application**
2. You'll see your **Client ID** on the next page

### Step 4: Generate Client Secret
1. Click **Generate a new client secret**
2. **IMPORTANT:** Copy it immediately (you won't see it again)

### Step 5: Add to Environment
Add to `.env.local`:
```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### For Production
Create a separate OAuth app for production with:
- Homepage URL: `https://yourdomain.com`
- Callback URL: `https://yourdomain.com/api/auth/callback/github`

---

## Discord OAuth Setup (Already Configured)

If you need to set up Discord or create a new application:

### Step 1: Go to Discord Developer Portal
1. Visit https://discord.com/developers/applications
2. Sign in with your Discord account

### Step 2: Create Application
1. Click **New Application**
2. Name it **QuiverDM**
3. Accept terms and create

### Step 3: Configure OAuth2
1. Go to **OAuth2** in the sidebar
2. Under **Redirects**, add:
   ```
   http://localhost:3001/api/auth/callback/discord
   http://localhost:3000/api/auth/callback/discord
   https://yourdomain.com/api/auth/callback/discord
   ```
3. Click **Save Changes**

### Step 4: Copy Credentials
1. Go to **OAuth2** > **General**
2. Copy **Client ID**
3. Copy **Client Secret** (click "Reset Secret" if needed)
4. Add to `.env.local`:
   ```env
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   ```

---

## Testing OAuth Integration

### 1. Restart Dev Server
After adding environment variables:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Test Sign In Page
1. Go to http://localhost:3001/auth/signin
2. You should see buttons for:
   - Continue with Google
   - Continue with GitHub
   - Continue with Discord

### 3. Test Each Provider
Click each OAuth button and verify:
- Redirects to provider's auth page
- Shows correct app name and permissions
- Redirects back to your app after approval
- Creates user account in database

### 4. Check Database
After signing in, check Prisma Studio:
```bash
npm run db:studio
```

Verify:
- User created in `User` table
- Account linked in `Account` table with correct provider
- Session created (if using database sessions)

---

## Common Issues & Solutions

### "Redirect URI Mismatch" Error

**Problem:** OAuth provider shows redirect URI error

**Solution:**
1. Check your callback URL matches exactly (including protocol)
2. For localhost, use the port your app is running on
3. No trailing slashes in URLs
4. Add both `http://localhost:3000` and `http://localhost:3001` if testing

### "Access Denied" or "Invalid Client"

**Problem:** Can't authenticate

**Solution:**
1. Verify Client ID and Secret are correct
2. Check environment variables loaded (restart server)
3. Ensure OAuth app is not in "development mode" requiring test users

### Google OAuth Not Working

**Problem:** Google sign in fails

**Solution:**
1. Make sure Google+ API is enabled
2. Configure OAuth consent screen completely
3. Add yourself as test user if app is not published
4. Check authorized domains

### Users Can Sign In But Data Missing

**Problem:** Authentication works but user profile incomplete

**Solution:**
1. Check OAuth scopes include `email` and `profile`
2. Verify Prisma schema has all fields (name, email, image)
3. Check provider returns expected fields in callback

---

## Production Deployment

### Environment Variables
Make sure to set production environment variables:
```env
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_production_secret

GOOGLE_CLIENT_ID=production_google_id
GOOGLE_CLIENT_SECRET=production_google_secret

GITHUB_CLIENT_ID=production_github_id
GITHUB_CLIENT_SECRET=production_github_secret

DISCORD_CLIENT_ID=production_discord_id
DISCORD_CLIENT_SECRET=production_discord_secret
```

### Update OAuth Apps
For each provider, create/update production OAuth app with:
- Production domain URLs
- Production callback URLs
- Separate credentials from development

### Security Best Practices
1. **Never commit secrets** to git
2. **Use different credentials** for dev/staging/prod
3. **Rotate secrets** periodically
4. **Enable 2FA** on provider accounts
5. **Monitor OAuth usage** in provider dashboards
6. **Limit scopes** to only what you need

---

## Adding More Providers

NextAuth.js supports 50+ providers! To add more:

### Example: Twitter/X OAuth
```typescript
// src/lib/auth.ts
import TwitterProvider from 'next-auth/providers/twitter';

providers: [
  TwitterProvider({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  }),
  // ... other providers
]
```

### Popular Providers
- Apple: `next-auth/providers/apple`
- Facebook: `next-auth/providers/facebook`
- Microsoft: `next-auth/providers/azure-ad`
- Twitch: `next-auth/providers/twitch`
- Spotify: `next-auth/providers/spotify`

Full list: https://next-auth.js.org/providers/

---

## Debugging Tips

### Enable Debug Mode
Add to `.env.local`:
```env
NEXTAUTH_DEBUG=true
```

### Check NextAuth Logs
Look for errors in terminal when auth fails

### Test Callback Endpoint
Visit directly in browser:
```
http://localhost:3001/api/auth/providers
```

Should return JSON with all configured providers.

### Verify Session
Add to any page:
```typescript
import { auth } from '@/lib/auth';

const session = await auth();
console.log(session);
```

---

## Support

- NextAuth.js Docs: https://next-auth.js.org/
- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- GitHub OAuth: https://docs.github.com/en/developers/apps/building-oauth-apps
- Discord OAuth: https://discord.com/developers/docs/topics/oauth2

---

**Done!** Your OAuth integration is ready. Users can now sign in with Google, GitHub, or Discord.
