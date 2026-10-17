"""EVAL-03 / EVAL-04 / CFG-02 / CFG-03 scale rules."""

from decimal import Decimal

import pytest

from apps.evaluations.scales import is_valid_value, point_key, scale_points, validate_scale


def errors(**overrides):
    data = {"scale_type": "NUMERIC", "min_value": 1, "max_value": 5, "step": 1, "labels": {}}
    data.update(overrides)
    return validate_scale(**data)


def test_valid_five_point_scale_with_labels():
    assert errors(labels={"1": "Needs improvement", "5": "Excellent"}) == {}


def test_valid_percentage_scale():
    assert errors(scale_type="PERCENT", min_value=0, max_value=100, step=5) == {}


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"scale_type": "STARS"}, "scale_type"),
        ({"min_value": 5, "max_value": 5}, "max_value"),
        ({"min_value": -1}, "min_value"),
        ({"step": 0}, "step"),
        ({"step": "abc"}, "step"),
        ({"step": 2}, "step"),  # 1..5 by 2 does not divide 4? (1,3,5) does, so use 1.5
        ({"scale_type": "PERCENT", "min_value": 0, "max_value": 150}, "max_value"),
        ({"min_value": 0, "max_value": 1000, "step": 1}, "step"),  # > 101 points
        ({"labels": {"6": "Off scale"}}, "labels"),
        ({"labels": {"3": ""}}, "labels"),
        ({"labels": {"3": "x" * 61}}, "labels"),
        ({"labels": ["not", "a", "dict"]}, "labels"),
    ],
)
def test_invalid_scales(overrides, field):
    if overrides == {"step": 2}:
        overrides = {"step": "1.5"}
    assert field in errors(**overrides)


def test_point_keys_and_points():
    assert point_key(Decimal("4.00")) == "4"
    assert point_key(Decimal("2.50")) == "2.5"
    assert scale_points(Decimal(0), Decimal(1), Decimal("0.5")) == [
        Decimal(0),
        Decimal("0.5"),
        Decimal(1),
    ]


@pytest.mark.parametrize(("value", "ok"), [("1", True), ("5", True), ("3.5", False), ("6", False)])
def test_is_valid_value(value, ok):
    assert (
        is_valid_value(
            value=Decimal(value), min_value=Decimal(1), max_value=Decimal(5), step=Decimal(1)
        )
        is ok
    )
