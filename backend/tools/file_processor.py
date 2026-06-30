"""
file_processor.py — Extract text from uploaded files.

Supports PDF, CSV, and plain text (.txt, .md) files.
Returns cleaned, truncated text suitable for LLM context injection.
"""

import csv
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Max characters to extract (~4000 tokens ≈ 16000 chars)
MAX_CHARS = 16000


def extract_text(file_path: str, mime_type: str = "") -> str:
    """
    Extract text content from a file.

    Args:
        file_path: Path to the uploaded file.
        mime_type: MIME type hint (used when extension is ambiguous).

    Returns:
        Extracted text content, truncated to MAX_CHARS.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    try:
        if suffix == ".pdf" or "pdf" in mime_type:
            return _extract_pdf(path)
        elif suffix == ".csv" or "csv" in mime_type:
            return _extract_csv(path)
        elif suffix in (".txt", ".md", ".text", ".log", ".json", ".xml"):
            return _extract_plaintext(path)
        else:
            # Try plain text as fallback
            return _extract_plaintext(path)
    except Exception as e:
        logger.error("Failed to extract text from %s: %s", file_path, e)
        return f"[Error extracting text from {path.name}: {e}]"


def _extract_pdf(path: Path) -> str:
    """Extract text from a PDF file using PyPDF2."""
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        return "[PDF extraction unavailable: PyPDF2 not installed]"

    reader = PdfReader(str(path))
    pages = []
    total_chars = 0

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            continue

        if total_chars + len(text) > MAX_CHARS:
            # Truncate this page to fit
            remaining = MAX_CHARS - total_chars
            pages.append(f"--- Page {i + 1} ---\n{text[:remaining]}…")
            break

        pages.append(f"--- Page {i + 1} ---\n{text}")
        total_chars += len(text)

    if not pages:
        return "[PDF contained no extractable text]"

    result = "\n\n".join(pages)
    if len(reader.pages) > len(pages):
        result += f"\n\n[… truncated, {len(reader.pages)} pages total]"

    return result


def _extract_csv(path: Path) -> str:
    """Extract CSV content as a markdown table with summary."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    if not rows:
        return "[CSV file is empty]"

    headers = rows[0]
    data_rows = rows[1:]
    total_rows = len(data_rows)

    # Build markdown table (first 100 rows)
    display_rows = data_rows[:100]

    # Header
    table_lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]

    # Data rows
    for row in display_rows:
        # Pad or truncate to match header count
        padded = row[:len(headers)]
        while len(padded) < len(headers):
            padded.append("")
        # Truncate long cell values
        cells = [cell[:100] for cell in padded]
        table_lines.append("| " + " | ".join(cells) + " |")

    result = "\n".join(table_lines)

    # Add summary
    result += f"\n\n**CSV Summary:** {total_rows} rows × {len(headers)} columns"
    if total_rows > 100:
        result += f" (showing first 100 rows)"

    # Truncate if still too long
    if len(result) > MAX_CHARS:
        result = result[:MAX_CHARS] + "\n\n[… truncated]"

    return result


def _extract_plaintext(path: Path) -> str:
    """Read plain text file."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()

    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + "\n\n[… truncated]"

    return text
