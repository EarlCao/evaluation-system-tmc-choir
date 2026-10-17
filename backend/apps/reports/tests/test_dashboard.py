import pytest
from django.urls import reverse

from apps.members.tests.factories import MemberProfileFactory

pytestmark = pytest.mark.django_db

URL = reverse("reports:dashboard")


def test_dashboard_requires_login(api_client):
    assert api_client.get(URL).status_code == 401


def test_member_dashboard(member_client):
    MemberProfileFactory.create_batch(2)
    response = member_client.get(URL)
    assert response.status_code == 200
    assert response.json() == {"active_members": 3, "voice_section": "Tenor", "open_cycle": None}


def test_super_admin_dashboard_has_no_voice_section(admin_client_api):
    assert admin_client_api.get(URL).json()["voice_section"] is None
