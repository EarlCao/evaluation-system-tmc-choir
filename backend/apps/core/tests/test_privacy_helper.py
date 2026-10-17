import uuid
from types import SimpleNamespace

import pytest

from apps.core.testing.privacy import assert_no_evaluator_leak

EVALUATOR = SimpleNamespace(
    public_id=uuid.UUID("9b2f7c1e-0000-4000-8000-000000000001"),
    username="tenor_zq81",
    email="zq81@example.org",
    first_name="Quillon",
    last_name="Varrick",
    display_name="",
)


def test_clean_payload_passes():
    assert_no_evaluator_leak(
        {"results": [{"comment": "Great blend!", "date": "2026-11-03"}]}, EVALUATOR
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"results": [{"comment": "From Quillon, well done"}]},
        {"meta": {"who": "tenor_zq81"}},
        {"contact": "ZQ81@example.org"},
        [{"id": "9b2f7c1e-0000-4000-8000-000000000001"}],
    ],
)
def test_identifying_values_are_detected(payload):
    with pytest.raises(AssertionError, match="leaked"):
        assert_no_evaluator_leak(payload, EVALUATOR)


@pytest.mark.parametrize("key", ["evaluator", "evaluator_id", "editor", "author_id"])
def test_identity_keys_are_detected_regardless_of_value(key):
    with pytest.raises(AssertionError, match="identity key"):
        assert_no_evaluator_leak({"results": [{key: 3}]})


def test_accepts_response_like_objects():
    response = SimpleNamespace(json=lambda: {"comment": "fine"})
    assert_no_evaluator_leak(response, EVALUATOR)
