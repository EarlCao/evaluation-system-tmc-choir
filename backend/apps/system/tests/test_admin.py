from types import SimpleNamespace

import pytest
from django.contrib.admin.sites import AdminSite

from apps.audit.models import AuditLog
from apps.system.admin import SystemSettingsAdmin
from apps.system.models import SystemSettings

pytestmark = pytest.mark.django_db


@pytest.fixture
def model_admin():
    return SystemSettingsAdmin(SystemSettings, AdminSite())


def test_admin_save_goes_through_service_and_is_audited(
    model_admin, actor, django_capture_on_commit_callbacks
):
    obj = SystemSettings.load()
    form = SimpleNamespace(changed_data=["choir_name"], cleaned_data={"choir_name": "Admin Choir"})
    request = SimpleNamespace(user=actor)

    with django_capture_on_commit_callbacks(execute=True):
        model_admin.save_model(request, obj, form, change=True)

    assert SystemSettings.objects.get().choir_name == "Admin Choir"
    entry = AuditLog.objects.get(event_type="system.settings.changed")
    assert entry.actor == actor
    assert entry.after == {"choir_name": "Admin Choir"}


def test_admin_cannot_delete_or_add_second_row(model_admin):
    SystemSettings.load()
    request = SimpleNamespace()
    assert model_admin.has_delete_permission(request) is False
    assert model_admin.has_add_permission(request) is False
