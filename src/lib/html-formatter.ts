/**
 * Formats HTML content from D&D Beyond into clean, readable text
 * Handles paragraphs, lists, tables, and basic formatting
 */
export function formatDndBeyondHtml(html: string): string {
  if (!html) return '';

  let text = html;

  // Convert common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Handle emphasis and bold
  text = text.replace(/<em>(.*?)<\/em>/gi, '$1');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<i>(.*?)<\/i>/gi, '$1');

  // Handle lists
  text = text.replace(/<ul[^>]*>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<ol[^>]*>/gi, '\n');
  text = text.replace(/<\/ol>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');

  // Handle tables - convert to clean text format
  // Mark table boundaries
  text = text.replace(/<table[^>]*>/gi, '\n\n[TABLE]');
  text = text.replace(/<\/table>/gi, '[/TABLE]\n');

  // Handle table headers
  text = text.replace(/<thead[^>]*>/gi, '[THEAD]');
  text = text.replace(/<\/thead>/gi, '[/THEAD]\n');

  // Handle table body
  text = text.replace(/<tbody[^>]*>/gi, '[TBODY]');
  text = text.replace(/<\/tbody>/gi, '[/TBODY]');

  // Handle table rows
  text = text.replace(/<tr[^>]*>/gi, '[TR]');
  text = text.replace(/<\/tr>/gi, '[/TR]');

  // Handle table headers and cells
  text = text.replace(/<th[^>]*>/gi, '[TH]');
  text = text.replace(/<\/th>/gi, '[/TH]');
  text = text.replace(/<td[^>]*>/gi, '[TD]');
  text = text.replace(/<\/td>/gi, '[/TD]');

  // Handle divs and spans
  text = text.replace(/<div[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<span[^>]*>/gi, '');
  text = text.replace(/<\/span>/gi, '');

  // Handle headings
  text = text.replace(/<h[1-6][^>]*>/gi, '\n**');
  text = text.replace(/<\/h[1-6]>/gi, '**\n');

  // Handle paragraphs and line breaks
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Process table markers into readable format
  // Split into sections by table
  const tableSections = text.split(/\[TABLE\](.*?)\[\/TABLE\]/gs);

  text = tableSections.map((section, index) => {
    // Even indices are non-table content, odd indices are table content
    if (index % 2 === 0) return section;

    // Process table content
    let tableText = section;

    // Extract headers from thead
    const theadMatch = tableText.match(/\[THEAD\](.*?)\[\/THEAD\]/s);
    let headers: string[] = [];
    if (theadMatch) {
      const headerRow = theadMatch[1];
      headers = headerRow.match(/\[TH\](.*?)\[\/TH\]/g)?.map(h =>
        h.replace(/\[TH\]|\[\/TH\]/g, '').trim()
      ).filter(h => h) || [];
      tableText = tableText.replace(/\[THEAD\].*?\[\/THEAD\]/s, '');
    }

    // Extract rows from tbody
    const tbodyMatch = tableText.match(/\[TBODY\](.*?)\[\/TBODY\]/s);
    if (tbodyMatch) {
      const tbody = tbodyMatch[1];
      const rows = tbody.match(/\[TR\](.*?)\[\/TR\]/g) || [];

      let result = '\n';

      rows.forEach(row => {
        const cells = row.match(/\[TD\](.*?)\[\/TD\]/g)?.map(c =>
          c.replace(/\[TD\]|\[\/TD\]/g, '').trim()
        ).filter(c => c && c !== ' ') || [];

        if (cells.length > 0) {
          // Format as "Header: Value" pairs
          cells.forEach((cell, i) => {
            if (headers[i]) {
              result += `${headers[i]}: ${cell}\n`;
            } else {
              result += `${cell}\n`;
            }
          });
          result += '\n';
        }
      });

      return result;
    }

    return tableText;
  }).join('');

  // Remove any remaining table markers
  text = text.replace(/\[(\/?)T(ABLE|HEAD|BODY|R|H|D)\]/g, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  text = text.replace(/ {2,}/g, ' '); // Remove multiple spaces
  text = text.replace(/\n +/g, '\n'); // Remove leading spaces on lines
  text = text.replace(/ +\n/g, '\n'); // Remove trailing spaces on lines

  return text.trim();
}

/**
 * Strips markdown-style formatting and returns plain text
 */
export function stripMarkdownFormatting(text: string): string {
  if (!text) return '';

  // Remove markdown bold
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}
