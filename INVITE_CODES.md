# QuiverDM Invite Codes

## Initial Invite Codes (Generated 2025-11-18)

These codes are for the invite-only alpha/beta testing phase:

```
180F9349
8F352D5C
415B2509
27EA38D7
812205E4
85504641
A8AEFEB1
2834B181
7125DB59
18ACFE2E
```

## Usage Instructions

### For New Users:
1. Go to the signup page
2. Enter your name, email, and password
3. Enter one of the invite codes above
4. Complete registration

### For Admins:

**Generate more invite codes:**
```bash
# Generate 5 codes (never expire)
npm run generate-invites -- 5

# Generate 1 code that expires in 30 days
npm run generate-invites -- 1 30
```

**Check invite code usage in Prisma Studio:**
```bash
npm run db:studio
```

Navigate to the `InviteCode` table to see which codes have been used.

## Security Features

✅ **Invite-only registration** - Users must have a valid invite code to sign up
✅ **Single-use codes** - Each code can only be used once
✅ **Optional expiration** - Codes can have expiration dates
✅ **Usage tracking** - System tracks which user redeemed each code
✅ **Protected backend** - All tRPC routes require authentication

## Production Deployment Notes

When deploying to production (Vercel), you'll need to:

1. **Run database migration:**
   - Connect to production database
   - Run: `npx prisma db push` or `npx prisma migrate deploy`

2. **Generate production invite codes:**
   - Connect to production database
   - Run: `npm run generate-invites -- <count>`
   - Save codes securely for distribution

3. **Distribute codes carefully:**
   - Only share with trusted alpha/beta testers
   - Track who you give codes to
   - Monitor usage via Prisma Studio

## Future Enhancements (Optional)

- [ ] Admin dashboard to view/manage invite codes
- [ ] Email invite system (auto-send codes)
- [ ] Bulk code generation with CSV export
- [ ] Code usage analytics
- [ ] Role-based codes (admin vs. regular user)
- [ ] Referral system (users can generate codes for friends)
