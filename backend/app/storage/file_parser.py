"""Document & File Ingestion Parser for ScribeX.

Converts uploaded documents (PDFs, Markdown, Text, CSV, JSON) into clean,
structured Markdown text linked to the context vault and vector index.
"""

from pathlib import Path
from typing import Any
import csv
import io
import json
import logging
import re
import pymupdf

logger = logging.getLogger("scribex.file_parser")


def extract_title_from_text_or_filename(text: str, filename: str) -> str:
    """Extract first heading (# Heading) or fall back to sanitized filename."""
    # Check for Markdown heading in first 1000 characters
    heading_match = re.search(r"^#\s+(.+)$", text[:1000], re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()

    # Fall back to filename stem
    stem = Path(filename).stem
    cleaned = re.sub(r"[-_]+", " ", stem).strip()
    return cleaned.title() if cleaned else "Uploaded Document"


def parse_pdf_bytes(pdf_bytes: bytes) -> tuple[str, int]:
    """Extract clean text from PDF bytes using PyMuPDF."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    page_texts: list[str] = []

    for page_num in range(page_count):
        page = doc[page_num]
        text = page.get_text().strip()
        if text:
            page_texts.append(f"<!-- Page {page_num + 1} -->\n{text}")

    doc.close()
    full_text = "\n\n---\n\n".join(page_texts)
    return full_text, page_count


def parse_csv_bytes(csv_bytes: bytes) -> str:
    """Convert CSV file bytes into a clean Markdown table."""
    decoded = csv_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)

    if not rows:
        return ""

    header = rows[0]
    md_lines = []
    # Header row
    md_lines.append("| " + " | ".join(header) + " |")
    # Separator row
    md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")

    # Data rows (capped at first 100 rows to prevent context blowing up)
    for row in rows[1:100]:
        # Pad row if columns are missing
        padded = row + [""] * (len(header) - len(row))
        md_lines.append("| " + " | ".join(padded[:len(header)]) + " |")

    if len(rows) > 100:
        md_lines.append(f"\n*(Truncated: showing first 100 rows of {len(rows)} total)*")

    return "\n".join(md_lines)


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".aac", ".flac"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}


def parse_file_bytes(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Parse raw file bytes into structured Markdown text and metadata."""
    ext = Path(filename).suffix.lower()
    page_count = None

    if ext in IMAGE_EXTENSIONS:
        text = ""
        file_type = "image"
    elif ext in AUDIO_EXTENSIONS:
        text = ""
        file_type = "audio"
    elif ext in VIDEO_EXTENSIONS:
        text = ""
        file_type = "video"
    elif ext in (".pdf",):
        text, page_count = parse_pdf_bytes(file_bytes)
        file_type = "pdf"
    elif ext in (".csv",):
        text = parse_csv_bytes(file_bytes)
        file_type = "csv"
    elif ext in (".json",):
        try:
            parsed = json.loads(file_bytes.decode("utf-8", errors="replace"))
            text = f"```json\n{json.dumps(parsed, indent=2)}\n```"
        except Exception:
            text = file_bytes.decode("utf-8", errors="replace")
        file_type = "json"
    else:
        # Plain text, Markdown, or default text formats
        text = file_bytes.decode("utf-8", errors="replace")
        file_type = "markdown" if ext in (".md", ".markdown") else "text"

    word_count = len(text.split())
    title_suggestion = extract_title_from_text_or_filename(text, filename)

    return {
        "text": text,
        "title_suggestion": title_suggestion,
        "file_type": file_type,
        "filename": filename,
        "word_count": word_count,
        "page_count": page_count,
    }


def parse_uploaded_file(file_path: Path, filename: str) -> dict[str, Any]:
    """Convenience helper reading file path and returning structured parsed dict."""
    file_bytes = file_path.read_bytes()
    res = parse_file_bytes(file_bytes, filename)
    return {
        "content_markdown": res["text"],
        "extracted_title": res["title_suggestion"],
        "file_type": res["file_type"],
        "filename": res["filename"],
        "word_count": res["word_count"],
        "page_count": res["page_count"],
    }

