# Social Media Assets

Specifications and templates for QuiverDM presence across social platforms.

---

## Platform Specifications

### Twitter/X

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Profile Photo | 400x400 | PNG/JPG | Displays as circle |
| Header | 1500x500 | PNG/JPG | Banner image |
| Tweet Image | 1200x675 | PNG/JPG | 16:9 ratio |

### Discord

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Server Icon | 512x512 | PNG | Displays as circle |
| Server Banner | 960x540 | PNG | Animated allowed |
| Invite Splash | 1920x1080 | PNG | Server boost req. |

### GitHub

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Social Preview | 1280x640 | PNG | Repo card image |
| Profile Photo | 500x500 | PNG | Org/user avatar |

### LinkedIn

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Company Logo | 300x300 | PNG | Square |
| Cover Image | 1128x191 | PNG | Banner |
| Share Image | 1200x627 | PNG/JPG | Link previews |

---

## Profile Photo / Avatar

### Design

Use the icon-only logo on brand purple background.

```
┌─────────────────┐
│                 │
│    [Q Icon]     │
│                 │
│    #8B5CF6      │
│   (background)  │
│                 │
└─────────────────┘
```

### Specifications

- **Background**: Solid brand purple (`#8B5CF6`)
- **Icon**: White or cream logo mark
- **Padding**: 15-20% on all sides
- **Export**: PNG with no transparency

### Files

| Platform | Size | File |
|----------|------|------|
| Twitter | 400x400 | `social/avatar-twitter.png` |
| Discord | 512x512 | `social/avatar-discord.png` |
| GitHub | 500x500 | `social/avatar-github.png` |
| LinkedIn | 300x300 | `social/avatar-linkedin.png` |

---

## Twitter/X Header

### Design Concept

Dark background with subtle branding, tagline, and URL.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   [Logo]  QuiverDM            AI-Powered D&D Session Management  │
│                                                                  │
│                               quiverdm.com                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Specifications

- **Size**: 1500x500
- **Background**: Dark gradient or `#0f0d0b`
- **Safe zone**: Keep important content in center (profile photo overlaps lower left)
- **File**: `social/twitter-header.png`

---

## Discord Server Graphics

### Server Icon

Same as profile avatar - icon on purple background.

- **Size**: 512x512
- **File**: `social/discord-icon.png`

### Server Banner

```
┌────────────────────────────────────────────┐
│                                            │
│       ⚔️  QuiverDM Community  ⚔️           │
│                                            │
│   AI-Powered D&D Campaign Management       │
│                                            │
└────────────────────────────────────────────┘
```

- **Size**: 960x540
- **Background**: Dark with fantasy elements
- **File**: `social/discord-banner.png`

---

## GitHub Social Preview

Displayed when repo is shared on social media.

### Design

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      [QuiverDM Logo]                           │
│                                                                │
│              AI-Powered D&D Campaign Management                │
│                                                                │
│   🎲 Session Planning  📜 NPC Tracking  🏰 Homebrew Library    │
│                                                                │
│                     github.com/...                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Specifications

- **Size**: 1280x640
- **Background**: Dark (`#0f0d0b`) or gradient
- **Content**: Logo, tagline, key features
- **File**: `social/github-preview.png`

---

## Email Signature

### Design

```
─────────────────────────────────
[Icon] QuiverDM
AI-Powered D&D Campaign Management
quiverdm.com
─────────────────────────────────
```

### HTML Template

```html
<table cellpadding="0" cellspacing="0" style="font-family: Georgia, serif;">
  <tr>
    <td style="padding-right: 12px; vertical-align: top;">
      <img src="https://quiverdm.com/email-icon.png"
           width="48" height="48"
           alt="QuiverDM"
           style="border-radius: 8px;">
    </td>
    <td style="vertical-align: top;">
      <div style="font-weight: bold; color: #8B5CF6;">QuiverDM</div>
      <div style="font-size: 12px; color: #666;">
        AI-Powered D&D Campaign Management
      </div>
      <div style="font-size: 12px;">
        <a href="https://quiverdm.com" style="color: #8B5CF6;">
          quiverdm.com
        </a>
      </div>
    </td>
  </tr>
</table>
```

### Assets

- **Icon**: 48x48 or 64x64 PNG
- **File**: `social/email-icon.png`

---

## Promotional Graphics

### Feature Announcement Template

```
┌────────────────────────────────────────────┐
│                                            │
│   🆕 NEW FEATURE                           │
│                                            │
│   [Feature Name]                           │
│                                            │
│   Brief description of the feature         │
│   and why it's useful for DMs.             │
│                                            │
│   [Screenshot or illustration]             │
│                                            │
│   [QuiverDM Logo]                          │
└────────────────────────────────────────────┘
```

- **Size**: 1200x675 (Twitter) or 1080x1080 (Instagram)
- **Background**: Dark with accent color border

### Update/Release Template

```
┌────────────────────────────────────────────┐
│                                            │
│   🚀 QuiverDM v1.X Released!               │
│                                            │
│   • Feature 1                              │
│   • Feature 2                              │
│   • Feature 3                              │
│                                            │
│   Try it now: quiverdm.com                 │
│                                            │
└────────────────────────────────────────────┘
```

---

## Asset Checklist

### Priority 1 (Launch)

- [ ] Profile avatar (all sizes)
- [ ] Twitter/X header
- [ ] GitHub social preview
- [ ] Open Graph image (shared with social)

### Priority 2 (Community)

- [ ] Discord server icon
- [ ] Discord banner
- [ ] Email signature graphic

### Priority 3 (Marketing)

- [ ] Feature announcement template
- [ ] Release announcement template
- [ ] LinkedIn assets

---

## File Organization

```
docs/branding/assets/social/
├── avatar-twitter.png      (400x400)
├── avatar-discord.png      (512x512)
├── avatar-github.png       (500x500)
├── avatar-linkedin.png     (300x300)
├── twitter-header.png      (1500x500)
├── discord-banner.png      (960x540)
├── github-preview.png      (1280x640)
├── email-icon.png          (64x64)
└── templates/
    ├── feature-announcement.psd
    └── release-announcement.psd
```

---

## Brand Consistency Notes

- Always use official logo files
- Maintain consistent color usage (brand purple, gold accents)
- Use Cinzel for display text in graphics
- Include URL where appropriate
- Test on actual platforms before finalizing
