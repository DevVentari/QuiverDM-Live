"""
pymupdf4llm PDF-to-Markdown converter.
MIT licensed - commercial-safe.

Usage: python scripts/pymupdf_extract.py <pdf_path>
Outputs JSON to stdout: { "success": true, "markdown": "...", "pages": N }
"""
import sys
import json

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        import pymupdf4llm  # type: ignore
        md_text = pymupdf4llm.to_markdown(
            pdf_path,
            page_chunks=False,   # return full doc as single string
            show_progress=False,
        )

        # Count pages using fitz
        import fitz  # type: ignore  (bundled with pymupdf)
        doc = fitz.open(pdf_path)
        pages = doc.page_count
        doc.close()

        print(json.dumps({
            "success": True,
            "markdown": md_text,
            "pages": pages,
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
