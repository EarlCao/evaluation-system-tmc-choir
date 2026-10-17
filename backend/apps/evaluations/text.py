"""Free-text hygiene for comments and suggestions (BR-10). Stored as plain text; the SPA
renders it as text, never HTML."""

import unicodedata

_ALLOWED_CONTROL = {"\n", "\t"}


def clean_text(value: str | None) -> str:
    """Normalise newlines, drop control/format characters (keeps \\n and \\t), trim."""
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(
        ch
        for ch in text
        if ch in _ALLOWED_CONTROL or unicodedata.category(ch) not in {"Cc", "Cf", "Cs"}
    )
    return unicodedata.normalize("NFC", text).strip()
