# App Icons

Specifications for all icon assets required for QuiverDM across web, mobile, and social platforms.

---

## Favicon Package

### Required Files

| File | Size | Format | Usage |
|------|------|--------|-------|
| `favicon.ico` | 16x16, 32x32, 48x48 | ICO | Browser tab (legacy) |
| `favicon.svg` | Vector | SVG | Modern browsers |
| `favicon-16x16.png` | 16x16 | PNG | Small contexts |
| `favicon-32x32.png` | 32x32 | PNG | Standard favicon |

### Implementation

```html
<!-- In <head> -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
```

### Design Notes

- Use icon-only logo (no wordmark)
- Ensure recognizability at 16x16
- Test on both light and dark browser themes
- Consider using brand purple background with white/light icon

---

## PWA Icons

### Required Sizes

| Size | Purpose | File |
|------|---------|------|
| 192x192 | Android home screen | `icon-192.png` |
| 512x512 | Android splash, PWA install | `icon-512.png` |
| 180x180 | Apple touch icon | `apple-icon.png` |

### Maskable Icons

For Android adaptive icons, provide maskable versions:

| Size | File | Notes |
|------|------|-------|
| 192x192 | `icon-192-maskable.png` | Safe zone: inner 80% |
| 512x512 | `icon-512-maskable.png` | Safe zone: inner 80% |

**Safe Zone**: Keep important elements within the center 80% circle.

### manifest.json Configuration

```json
{
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icon-192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## Apple Touch Icon

### Specifications

| Property | Value |
|----------|-------|
| Size | 180x180 |
| Format | PNG |
| File | `apple-icon.png` or `apple-touch-icon.png` |
| Background | Solid (no transparency) |
| Corner radius | Applied by iOS automatically |

### Implementation

```html
<link rel="apple-touch-icon" href="/apple-icon.png">
```

### Design Notes

- Use solid background (brand purple recommended)
- Do not include rounded corners (iOS adds them)
- Avoid transparency
- Test on actual iOS devices

---

## Open Graph Image

For social media sharing previews.

### Specifications

| Property | Value |
|----------|-------|
| Size | 1200x630 |
| Format | PNG or JPG |
| File | `og-image.png` |
| Text | Include app name and tagline |

### Content

```
┌─────────────────────────────────────┐
│                                     │
│         [QuiverDM Logo]             │
│                                     │
│     AI-Powered D&D Campaign         │
│        Management for DMs           │
│                                     │
│         quiverdm.com                │
└─────────────────────────────────────┘
```

### Implementation

```html
<meta property="og:image" content="https://quiverdm.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

---

## Twitter Card

### Specifications

| Property | Value |
|----------|-------|
| Size | 1200x600 (summary_large_image) |
| Format | PNG or JPG |
| File | `twitter-image.png` |

Can often use the same image as Open Graph.

### Implementation

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://quiverdm.com/twitter-image.png">
```

---

## App Store Icons (Future)

If/when QuiverDM becomes a native app:

### iOS App Store

| Size | Scale | Use |
|------|-------|-----|
| 1024x1024 | 1x | App Store |
| 180x180 | 3x | iPhone |
| 167x167 | 2x | iPad Pro |
| 152x152 | 2x | iPad |

### Google Play Store

| Size | Use |
|------|-----|
| 512x512 | Play Store listing |
| 192x192 | App icon |

---

## Icon Generation Checklist

### Phase 1 (MVP)

- [ ] `favicon.ico` (multi-size)
- [ ] `favicon.svg`
- [ ] `apple-icon.png` (180x180)
- [ ] `icon-192.png`
- [ ] `icon-512.png`
- [ ] `og-image.png` (1200x630)

### Phase 2 (Enhanced)

- [ ] `icon-192-maskable.png`
- [ ] `icon-512-maskable.png`
- [ ] `twitter-image.png`
- [ ] `favicon-16x16.png`
- [ ] `favicon-32x32.png`

### Phase 3 (Native Apps)

- [ ] iOS icon set
- [ ] Android icon set
- [ ] App store marketing images

---

## File Locations

All icon files should be placed in:

```
public/
├── favicon.ico
├── favicon.svg
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-icon.png
├── icon-192.png
├── icon-512.png
├── icon-192-maskable.png
├── icon-512-maskable.png
├── og-image.png
├── twitter-image.png
└── manifest.json
```

---

## Testing

### Favicon Testing

1. Chrome DevTools > Application > Manifest
2. [RealFaviconGenerator Checker](https://realfavicongenerator.net/favicon_checker)
3. Test in multiple browsers

### Social Preview Testing

1. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. [Twitter Card Validator](https://cards-dev.twitter.com/validator)
3. [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### PWA Testing

1. Chrome DevTools > Application > Manifest
2. Lighthouse PWA audit
3. Test "Add to Home Screen" on mobile
