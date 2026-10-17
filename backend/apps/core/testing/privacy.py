"""Privacy assertion used by every member-facing endpoint test (Testing Strategy)."""

import json
from collections.abc import Iterator
from typing import Any

# Keys that identify an evaluator/author/editor. They must never appear in a payload
# served to members, whatever their value (integer PKs collide too easily to search for).
IDENTITY_KEYS = frozenset(
    {
        "evaluator",
        "evaluator_id",
        "evaluator_public_id",
        "evaluator_name",
        "author",
        "author_id",
        "editor",
        "editor_id",
        "submitted_by",
        "created_by",
    }
)

_IDENTIFYING_ATTRS = ("public_id", "username", "email", "first_name", "last_name", "display_name")
_MIN_NEEDLE_LENGTH = 3


def _keys(value: Any) -> Iterator[str]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key)
            yield from _keys(child)
    elif isinstance(value, list | tuple):
        for child in value:
            yield from _keys(child)


def _as_data(payload: Any) -> Any:
    """Accept a DRF/Django test response or already-decoded data (e.g. a WS message)."""
    if hasattr(payload, "json") and callable(payload.json):
        return payload.json()
    return payload


def assert_no_evaluator_leak(payload: Any, *evaluators: Any) -> None:
    """Fail if any identity key, or any identifying attribute of any evaluator, appears
    anywhere in ``payload``. PRIV rule: members must never learn who evaluated them."""
    data = _as_data(payload)

    leaked_keys = IDENTITY_KEYS.intersection(_keys(data))
    assert not leaked_keys, f"evaluator identity key(s) in payload: {sorted(leaked_keys)}"

    blob = json.dumps(data, default=str).lower()
    for evaluator in evaluators:
        for attr in _IDENTIFYING_ATTRS:
            needle = str(getattr(evaluator, attr, "") or "").lower()
            if len(needle) >= _MIN_NEEDLE_LENGTH:
                assert needle not in blob, f"evaluator {attr} leaked in payload: {needle!r}"
