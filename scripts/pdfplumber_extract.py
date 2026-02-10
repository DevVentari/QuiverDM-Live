#!/usr/bin/env python3
"""
pdfplumber-based PDF extraction for QuiverDM
MIT License - Commercial-safe fallback when Marker crashes
"""
import pdfplumber
import argparse
import json
import sys


def extract_pdf_to_markdown(pdf_path, output_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            markdown_lines = []
            table_count = 0

            for page_num, page in enumerate(pdf.pages, 1):
                # Page header
                markdown_lines.append(f"## Page {page_num}\n\n")

                # Extract text
                text = page.extract_text()
                if text:
                    markdown_lines.append(f"{text}\n\n")

                # Extract tables (critical for D&D stat blocks)
                tables = page.extract_tables()
                for table in tables:
                    if table and len(table) > 0:
                        # Header row
                        markdown_lines.append("| " + " | ".join(str(cell or "") for cell in table[0]) + " |\n")
                        markdown_lines.append("| " + " | ".join(["---"] * len(table[0])) + " |\n")

                        # Data rows
                        for row in table[1:]:
                            markdown_lines.append("| " + " | ".join(str(cell or "") for cell in row) + " |\n")

                        markdown_lines.append("\n")
                        table_count += 1

            # Write output
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(''.join(markdown_lines))

            return {
                'success': True,
                'pages': len(pdf.pages),
                'tables': table_count,
            }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
        }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract PDF to Markdown using pdfplumber')
    parser.add_argument('pdf_path', help='Path to input PDF')
    parser.add_argument('--output', required=True, help='Path to output markdown file')
    args = parser.parse_args()

    result = extract_pdf_to_markdown(args.pdf_path, args.output)
    print(json.dumps(result))
    sys.exit(0 if result.get('success') else 1)
