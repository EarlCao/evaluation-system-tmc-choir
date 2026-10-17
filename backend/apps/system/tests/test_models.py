import pytest
from django.core.exceptions import ValidationError

from apps.system.constants import DEFAULT_PRIVACY_NOTICE, RegistrationMode
from apps.system.models import SINGLETON_PK, SystemSettings

pytestmark = pytest.mark.django_db


def test_singleton_row_is_seeded_by_migration():
    assert SystemSettings.objects.filter(pk=SINGLETON_PK).exists()


def test_load_recreates_missing_singleton():
    SystemSettings.objects.all()._raw_delete(SystemSettings.objects.db)
    assert SystemSettings.load().pk == SINGLETON_PK


def test_load_returns_singleton_with_defaults():
    """SET-01 defaults; Q1 default = approval required; Q8 default = UTC."""
    s = SystemSettings.load()
    assert s.pk == SINGLETON_PK
    assert s.registration_mode == RegistrationMode.APPROVAL
    assert s.time_zone == "UTC"
    assert s.min_aggregate_group_size == 3
    assert s.retention_audit_days == 730
    assert s.privacy_notice == DEFAULT_PRIVACY_NOTICE
    assert SystemSettings.load().pk == s.pk
    assert SystemSettings.objects.count() == 1


def test_creating_a_second_instance_is_refused():
    original = SystemSettings.load()
    with pytest.raises(ValidationError):
        SystemSettings(system_name="Other").save()
    current = SystemSettings.objects.get()
    assert current.system_name == original.system_name
    assert current.created_at == original.created_at


def test_settings_cannot_be_deleted():
    s = SystemSettings.load()
    with pytest.raises(ValidationError):
        s.delete()
    assert SystemSettings.objects.exists()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("time_zone", "Mars/Olympus_Mons"),
        ("min_aggregate_group_size", 2),  # ADR-013 privacy floor
        ("retention_audit_days", 7),
        ("registration_mode", "WHATEVER"),
    ],
)
def test_invalid_values_fail_validation(field, value):
    s = SystemSettings.load()
    setattr(s, field, value)
    with pytest.raises(ValidationError) as exc:
        s.full_clean()
    assert field in exc.value.message_dict
