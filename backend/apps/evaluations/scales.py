"""Rating scale rules (EVAL-03, EVAL-04, CFG-02, CFG-03). Pure functions, no DB access."""

from decimal import Decimal, InvalidOperation

from .constants import LABEL_MAX, MAX_SCALE_POINTS, ScaleType


def point_key(value: Decimal) -> str:
    """Canonical string for a scale point: Decimal('4.00') → '4', Decimal('2.50') → '2.5'."""
    normalized = value.normalize()
    text = format(normalized, "f")
    return text


def scale_points(min_value: Decimal, max_value: Decimal, step: Decimal) -> list[Decimal]:
    count = int((max_value - min_value) / step) + 1
    return [min_value + step * i for i in range(count)]


def _decimal(value, field: str, errors: dict) -> Decimal | None:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        errors[field] = ["Enter a number."]
        return None
    if not number.is_finite():
        errors[field] = ["Enter a number."]
        return None
    return number


def validate_scale(*, scale_type: str, min_value, max_value, step, labels) -> dict[str, list[str]]:
    """Return field errors (empty dict = valid). Labels map point keys to short texts."""
    errors: dict[str, list[str]] = {}
    if scale_type not in ScaleType.values:
        errors["scale_type"] = ["Choose a supported scale type."]
    lo = _decimal(min_value, "min_value", errors)
    hi = _decimal(max_value, "max_value", errors)
    st = _decimal(step, "step", errors)
    if errors or lo is None or hi is None or st is None:
        return errors

    if lo < 0:
        errors["min_value"] = ["The minimum cannot be negative."]
    if hi <= lo:
        errors["max_value"] = ["The maximum must be greater than the minimum."]
    if st <= 0:
        errors["step"] = ["The step must be greater than zero."]
    if scale_type == ScaleType.PERCENT and (lo < 0 or hi > 100):
        errors["max_value"] = ["Percentage scales must stay within 0-100."]
    if errors:
        return errors
    if (hi - lo) % st != 0:
        errors["step"] = ["The step must divide the range exactly."]
        return errors
    if int((hi - lo) / st) + 1 > MAX_SCALE_POINTS:
        errors["step"] = [f"A scale can have at most {MAX_SCALE_POINTS} points."]
        return errors

    if labels is None:
        labels = {}
    if not isinstance(labels, dict):
        return {"labels": ["Labels must map scale values to texts."]}
    valid_keys = {point_key(p) for p in scale_points(lo, hi, st)}
    label_errors = []
    for key, text in labels.items():
        normalized = point_key(Decimal(str(key))) if _is_number(key) else None
        if normalized not in valid_keys:
            label_errors.append(f"{key} is not a value on this scale.")
        elif not isinstance(text, str) or not text.strip() or len(text) > LABEL_MAX:
            label_errors.append(f"The label for {key} must be 1-{LABEL_MAX} characters.")
    if label_errors:
        errors["labels"] = label_errors
    return errors


def normalize_labels(labels: dict | None) -> dict[str, str]:
    return {point_key(Decimal(str(k))): str(v).strip() for k, v in (labels or {}).items()}


def _is_number(value) -> bool:
    try:
        return Decimal(str(value)).is_finite()
    except (InvalidOperation, ValueError, TypeError):
        return False


def is_valid_value(
    *, value: Decimal, min_value: Decimal, max_value: Decimal, step: Decimal
) -> bool:
    return min_value <= value <= max_value and (value - min_value) % step == 0
