# Admin Invite Codes - Quick Start Guide

## Access the Admin Panel

Navigate to: **http://localhost:3847/admin/invites**

## Features

### 📊 Overview Tab
- **Statistics Dashboard** - View total, used, unused, and expired codes
- **Quick Actions**:
  - Generate single code instantly
  - Refresh data
  - Delete expired codes in bulk

### ➕ Generate Tab
- **Single Code Generation** - Click button to generate one code on demand
- **Bulk Generation**:
  - Generate 1-1000 codes at once
  - Optional expiration (1-365 days)
  - Leave expiration empty for permanent codes

### 🎫 Unused Codes Tab
- **Table View** - See all unused codes (latest 100)
- **Copy to Clipboard** - Click copy icon next to any code
- **Expiration Status** - Badge shows expiration date or "Never"
- **Creation Date** - See when each code was generated

## Usage

### Generate a Single Code
1. Go to **Overview** or **Generate** tab
2. Click "Generate Single Code" button
3. Code is instantly created and added to database
4. Copy from the toast notification or view in Unused Codes tab

### Generate Bulk Codes
1. Go to **Generate** tab
2. Enter number of codes (1-1000)
3. (Optional) Set expiration in days
4. Click "Generate X Codes" button
5. All codes created and shown in Unused Codes tab

### Copy a Code
1. Go to **Unused Codes** tab
2. Click the copy icon next to any code
3. Code is copied to clipboard
4. Icon changes to checkmark for 2 seconds

### Delete Expired Codes
1. Go to **Overview** tab
2. Click "Delete Expired" button
3. All expired unused codes are removed from database
4. Stats update automatically

## UI Components

The admin panel uses:
- **Tabs** - Switch between Overview, Generate, and Unused Codes
- **Cards** - Organized sections for statistics and actions
- **Table** - Clean display of unused codes
- **Badges** - Visual status indicators (expired/never)
- **Toasts** - Success/error notifications
- **Loading States** - Spinners during operations

## Technical Details

### Route
- **File**: `src/app/(app)/admin/invites/page.tsx`
- **URL**: `/admin/invites`
- **Type**: Client component (React hooks, interactive)

### tRPC Endpoints Used
```typescript
invites.getStats()              // Statistics
invites.getUnused({ limit })    // List unused codes
invites.generate({ count, expiresInDays })  // Create codes
invites.cleanupExpired()        // Delete expired
```

### State Management
- React hooks (useState) for local state
- tRPC hooks (useQuery, useMutation) for server state
- Automatic refetch after mutations
- Optimistic UI updates with loading states

## Future Enhancements

Potential additions:
- [ ] Search/filter codes
- [ ] Export codes to CSV
- [ ] Batch delete specific codes
- [ ] View code usage history (who redeemed each code)
- [ ] Code analytics (redemption rate, time-to-use)
- [ ] Email codes directly to users
- [ ] Generate codes with custom prefixes
- [ ] Set different expiration per code

## Notes

- **Admin Access**: Currently no authentication check on admin routes
  - TODO: Add admin role verification
  - TODO: Protect /admin/* routes with middleware
- **Pagination**: Only shows latest 100 unused codes
  - For more codes, adjust limit in query
- **Real-time Updates**: Stats refresh on each mutation
  - Manual refresh button available

---

**Created**: 2026-02-11
**Location**: `/admin/invites`
**Status**: ✅ Ready to use
