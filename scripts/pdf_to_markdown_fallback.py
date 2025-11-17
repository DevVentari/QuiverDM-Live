#!/usr/bin/env python3
"""
Fallback PDF to Markdown converter using PyMuPDF
Used when Marker crashes (e.g., on Windows with access violations)

This is simpler than Marker but more stable for large/complex PDFs.
"""

import sys
import json
import argparse
from pathlib import Path
import fitz  # PyMuPDF


def extract_text_with_formatting(page):
    """Extract text from a page with basic markdown formatting"""
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    lines = []
    prev_size = 0

    for block in blocks:
        if block["type"] == 0:  # Text block
            for line in block["lines"]:
                line_text = ""
                line_size = 0

                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    size = span["size"]
                    flags = span["flags"]

                    # Track font size for header detection
                    if line_size == 0:
                        line_size = size

                    # Apply formatting based on font properties
                    if flags & 2**0:  # Superscript
                        text = f"^{text}^"
                    if flags & 2**1:  # Italic
                        text = f"*{text}*"
                    if flags & 2**4:  # Bold
                        text = f"**{text}**"

                    line_text += text + " "

                line_text = line_text.strip()
                if not line_text:
                    continue

                # Convert to headers based on font size
                if line_size > 16:  # Large text = header
                    if line_size > 24:
                        lines.append(f"\n# {line_text}\n")
                    elif line_size > 20:
                        lines.append(f"\n## {line_text}\n")
                    elif line_size > 16:
                        lines.append(f"\n### {line_text}\n")
                else:
                    lines.append(line_text)

                prev_size = line_size

        elif block["type"] == 1:  # Image block
            lines.append("\n[Image]\n")

    return "\n".join(lines)


def pdf_to_markdown(pdf_path: str, output_path: str = None) -> dict:
    """
    Convert PDF to Markdown using PyMuPDF

    Args:
        pdf_path: Path to the PDF file
        output_path: Optional path to save the markdown (default: same as PDF with .md extension)

    Returns:
        Dictionary with markdown content and metadata
    """
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        return {
            "success": False,
            "error": f"PDF file not found: {pdf_path}",
        }

    if output_path:
        output_path = Path(output_path)
    else:
        output_path = pdf_path.with_suffix(".md")

    try:
        doc = fitz.open(pdf_path)

        markdown_parts = []

        # Add document title if available
        metadata = doc.metadata
        num_pages = len(doc)

        if metadata.get("title"):
            markdown_parts.append(f"# {metadata['title']}\n\n")

        # Process each page
        for page_num in range(num_pages):
            page = doc[page_num]

            # Add page separator for multi-page documents
            if page_num > 0:
                markdown_parts.append(f"\n---\n*Page {page_num + 1}*\n\n")

            # Extract text with formatting
            page_text = extract_text_with_formatting(page)
            markdown_parts.append(page_text)

        # Save metadata before closing
        doc_title = metadata.get("title", "")
        doc_author = metadata.get("author", "")

        doc.close()

        # Combine all parts
        markdown = "\n\n".join(markdown_parts)

        # Clean up excessive whitespace
        import re
        markdown = re.sub(r'\n{4,}', '\n\n\n', markdown)
        markdown = re.sub(r' {2,}', ' ', markdown)

        # Save to file
        output_path.write_text(markdown, encoding='utf-8')

        return {
            "success": True,
            "markdown": markdown,
            "output_path": str(output_path),
            "metadata": {
                "pages": num_pages,
                "title": doc_title,
                "author": doc_author,
                "converter": "pymupdf",
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


def main():
    parser = argparse.ArgumentParser(description="Convert PDF to Markdown using PyMuPDF")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--output", "-o", help="Output markdown file path")
    parser.add_argument("--json", action="store_true", help="Output result as JSON")

    args = parser.parse_args()

    result = pdf_to_markdown(args.pdf_path, args.output)

    if args.json:
        # Don't include full markdown in JSON output (too large)
        output = {
            "success": result["success"],
            "output_path": result.get("output_path", ""),
            "metadata": result.get("metadata", {}),
            "error": result.get("error", ""),
            "markdown_length": len(result.get("markdown", "")),
        }
        print(json.dumps(output, indent=2))
    else:
        if result["success"]:
            print(f"✅ Successfully converted PDF to Markdown")
            print(f"   Output: {result['output_path']}")
            print(f"   Pages: {result['metadata']['pages']}")
            print(f"   Markdown length: {len(result['markdown'])} characters")
        else:
            print(f"❌ Conversion failed: {result['error']}")
            sys.exit(1)


if __name__ == "__main__":
    main()
