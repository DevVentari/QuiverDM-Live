/**
 * Converts HTML descriptions to plain text while preserving structure.
 * D&D Beyond returns descriptions as HTML with <p>, <ul>, <li>, <strong>, etc.
 * A plain regex strip loses all paragraph breaks and bullet structure.
 */
export function htmlToText(html: string): string {
  return html
    // Paragraphs → double newline
    .replace(/<\/p>/gi, '\n\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // List items → bullet point
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    // Headings → double newline after
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Strip all remaining tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
