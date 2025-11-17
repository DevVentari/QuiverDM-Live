# Homebrew Library - Complete Implementation Guide

## Overview

The Homebrew Library is a comprehensive system for managing D&D homebrew content in QuiverDM. It allows Dungeon Masters to:

- Upload PDF files containing homebrew content
- Automatically extract items, creatures, spells, and more from PDFs
- Organize and categorize homebrew content by type
- Search and filter homebrew content
- Quick-add homebrew to session notes
- Manage and track all homebrew content per campaign

## Architecture

### Backend (tRPC + Prisma)

**Router**: `src/server/routers/homebrew.ts`

The homebrew router provides comprehensive CRUD operations:

#### PDF Management
- `uploadPDF` - Create a PDF record after upload to R2
- `getPDFs` - Get all PDFs for a campaign
- `getPDF` - Get single PDF with extracted content
- `deletePDF` - Delete PDF and cascade delete content
- `updatePDFStatus` - Update processing status
- `processPDF` - Extract content from uploaded PDF

#### Content Management
- `createContent` - Manually create homebrew content
- `createContentBulk` - Bulk create (used during PDF processing)
- `getContent` - Get content with filtering and pagination
- `getContentById` - Get single content item
- `searchContent` - Full-text search across content
- `updateContent` - Update existing content
- `deleteContent` - Delete content item
- `getContentStats` - Get statistics by type
- `getAllTags` - Get all unique tags for filtering

### Database Models

**HomebrewPDF**:
- Stores PDF metadata and processing status
- Tracks extracted content counts
- Links to campaign

**HomebrewContent**:
- Flexible data structure (JSON) for different content types
- Full-text searchable
- Supports tags and categorization
- Links to source PDF (optional)

**Content Types**:
- `item` - Magic items, equipment, weapons, armor
- `creature` - Monsters, NPCs, beasts
- `spell` - Custom spells
- `location` - Places, dungeons, regions
- `subclass` - Character subclasses
- `feat` - Character feats
- `rule` - House rules, mechanics

### Storage (Cloudflare R2)

**Utility**: `src/lib/r2-storage.ts`

Provides S3-compatible interface for Cloudflare R2:
- `uploadToR2()` - Upload files with metadata
- `deleteFromR2()` - Delete files
- `getPresignedDownloadUrl()` - Generate download URLs
- `getPresignedUploadUrl()` - Generate upload URLs
- `generateFileKey()` - Create unique file paths

**API Route**: `src/app/api/homebrew/upload/route.ts`

Handles PDF uploads:
- Validates file type (PDF only)
- Validates file size (max 50MB)
- Uploads to R2 with metadata
- Returns R2 URL for database storage

### PDF Processing

**Utility**: `src/lib/pdf-parser.ts`

Features:
- Parse PDF from R2 URL or Buffer
- Extract text content and metadata
- Pattern matching for D&D content types
- Intelligent extraction of items, spells, creatures
- Flexible data structure generation

**Extraction Patterns**:
- Magic items (by rarity keywords)
- Spells (by level and school)
- Creatures (by size and type)
- Automatic tag generation
- Description extraction

## Frontend Components

### 1. HomebrewPDFUpload

**File**: `src/components/homebrew/HomebrewPDFUpload.tsx`

Features:
- Drag-and-drop style file selector
- Client-side validation (type, size)
- Progress tracking (upload → process → extract)
- Error handling and display
- Automatic refresh on completion

Usage:
```tsx
<HomebrewPDFUpload
  campaignId={campaignId}
  userId={userId}
  onUploadComplete={() => refetch()}
/>
```

### 2. HomebrewPDFList

**File**: `src/components/homebrew/HomebrewPDFList.tsx`

Features:
- Display all PDFs for a campaign
- Status badges (queued, processing, completed, failed)
- Extraction statistics
- Delete functionality with confirmation
- Click to view extracted content

Usage:
```tsx
<HomebrewPDFList
  campaignId={campaignId}
  onPDFClick={(pdfId) => viewContent(pdfId)}
/>
```

### 3. HomebrewContentList

**File**: `src/components/homebrew/HomebrewContentList.tsx`

Features:
- Grid layout with card view
- Real-time search with debouncing
- Filter by content type
- Tag display
- Source PDF reference
- Click to view details

Usage:
```tsx
<HomebrewContentList
  campaignId={campaignId}
  onContentClick={(id) => openDetail(id)}
/>
```

### 4. HomebrewContentDetail

**File**: `src/components/homebrew/HomebrewContentDetail.tsx`

Features:
- Full content display
- Recursive data rendering
- Image gallery support
- Edit and delete actions
- Source attribution
- Metadata display

Usage:
```tsx
<HomebrewContentDetail
  contentId={contentId}
  onClose={() => closeModal()}
  onEdit={(id) => editContent(id)}
/>
```

### 5. HomebrewQuickAdd

**File**: `src/components/homebrew/HomebrewQuickAdd.tsx`

Features:
- Dialog-based search interface
- Quick search and filter
- Recent content display
- Select and insert into session
- Compact card view

Usage:
```tsx
<HomebrewQuickAdd
  campaignId={campaignId}
  onSelect={(content) => addToSession(content)}
/>
```

### Main Page

**File**: `src/app/campaigns/[campaignId]/homebrew/page.tsx`

Features:
- Statistics dashboard
- Tabbed interface (Browse/Manage)
- Upload dialog
- Content detail modal
- Responsive layout

Route: `/campaigns/{campaignId}/homebrew`

## Setup Instructions

### 1. Environment Variables

Add to `.env.local`:

```env
# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=quiverdm-media-dev
```

### 2. Install Dependencies

Already installed:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner pdf-parse date-fns
npm install --save-dev @types/pdf-parse
```

### 3. Database Migration

The schema is already in place. If starting fresh:

```bash
npm run db:push
# or
npm run db:migrate
```

### 4. Cloudflare R2 Setup

1. Create R2 bucket in Cloudflare dashboard
2. Generate API tokens with R2 read/write permissions
3. Add credentials to environment variables
4. Bucket will auto-create folders: `homebrew-pdfs/userId/campaignId/`

## Usage Flow

### Upload and Process PDF

1. User navigates to `/campaigns/{id}/homebrew`
2. Clicks "Upload PDF" button
3. Selects PDF file (max 50MB)
4. Client uploads to `/api/homebrew/upload`
5. Server uploads to R2 and returns URL
6. Client creates PDF record via `homebrew.uploadPDF`
7. Client triggers processing via `homebrew.processPDF`
8. Server:
   - Downloads PDF from R2
   - Extracts text using pdf-parse
   - Identifies content using pattern matching
   - Creates HomebrewContent records
   - Updates PDF status to 'completed'

### Browse and Search

1. User views "Browse Content" tab
2. Can search by keyword (debounced search)
3. Can filter by content type
4. Clicks content card to view details
5. Can edit or delete from detail view

### Quick Add to Session

1. During active session, click "Add Homebrew"
2. Search or browse recent content
3. Click item to insert into session notes
4. Content details added automatically

## Extension Points

### AI-Powered Extraction

Replace basic pattern matching with Claude API:

```typescript
// src/lib/pdf-parser.ts
export async function extractHomebrewContentWithAI(
  parsedPDF: ParsedPDFContent
): Promise<ExtractedHomebrewItem[]> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Extract D&D homebrew content from this text: ${parsedPDF.text}`
    }],
    // ... structured output
  });

  return parseStructuredOutput(response);
}
```

### Manual Content Creation

Add form component for manual entry:

```typescript
// src/components/homebrew/HomebrewContentForm.tsx
export function HomebrewContentForm({
  campaignId,
  type,
  onSave,
}) {
  // Form fields based on content type
  // Submit to homebrew.createContent
}
```

### Content Templates

Pre-defined templates for common content types:

```typescript
const ITEM_TEMPLATE = {
  name: '',
  type: 'item',
  data: {
    rarity: 'uncommon',
    requiresAttunement: false,
    description: '',
    properties: [],
  },
  tags: [],
};
```

### Export Functions

Export content to various formats:

```typescript
// Export to JSON, Markdown, Homebrewery format
export async function exportContent(contentId: string, format: 'json' | 'md' | 'homebrewery') {
  // Generate formatted export
}
```

## Performance Considerations

### Pagination

Content list uses cursor-based pagination:

```typescript
const { data, fetchNextPage } = trpc.homebrew.getContent.useInfiniteQuery({
  campaignId,
  limit: 50,
});
```

### Search Optimization

- Debounced search (300ms)
- Server-side full-text search
- Indexed database queries
- Limit results to 20 for quick search

### Caching

React Query caching enabled:
- PDF list cached for 5 minutes
- Content cached until mutation
- Search results cache invalidated on new content

## Testing

### Manual Testing Checklist

- [ ] Upload PDF (valid)
- [ ] Upload PDF (invalid type)
- [ ] Upload PDF (too large)
- [ ] PDF processing success
- [ ] PDF processing failure
- [ ] View extracted content
- [ ] Search content
- [ ] Filter by type
- [ ] View content details
- [ ] Delete content
- [ ] Delete PDF (cascade)
- [ ] Quick add to session

### Test PDFs

Use sample D&D homebrew PDFs from:
- DM's Guild
- /r/UnearthedArcana
- Homebrewery exports

## Future Enhancements

1. **AI Extraction**: Use Claude to intelligently parse PDFs
2. **OCR Support**: Extract from scanned/image PDFs
3. **Community Sharing**: Share homebrew between campaigns
4. **Version Control**: Track content changes over time
5. **Favorites**: Star frequently used content
6. **Collections**: Group related content
7. **Import/Export**: Bulk import from JSON
8. **Integration**: Link to D&D Beyond, Roll20

## Troubleshooting

### PDF Upload Fails

- Check R2 credentials in `.env.local`
- Verify bucket exists and is accessible
- Check file size (max 50MB)
- Ensure CORS configured on R2 bucket

### Processing Fails

- Check PDF is text-based (not scanned image)
- Review error message in PDF list
- Check server logs for detailed error
- Verify pdf-parse package installed

### No Content Extracted

- PDF may not match extraction patterns
- Consider manual content creation
- Enhance pattern matching in pdf-parser.ts
- Use AI extraction for better results

### Search Not Working

- Verify searchText field is populated
- Check Prisma query logs
- Ensure content exists in campaign
- Try exact name match first

## Summary

The Homebrew Library system is now fully implemented with:

✅ Complete tRPC API with 15+ procedures
✅ R2 storage integration with presigned URLs
✅ PDF parsing and content extraction
✅ 5 polished UI components
✅ Full-text search and filtering
✅ Quick-add functionality
✅ Comprehensive error handling
✅ Mobile-responsive design

Ready for Phase 4: PWA Implementation and Deployment!
