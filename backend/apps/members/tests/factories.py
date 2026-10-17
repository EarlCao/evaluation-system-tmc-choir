import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import UserFactory
from apps.members.models import MemberProfile, VoiceSection


def voice_section(name: str = "Tenor") -> VoiceSection:
    """Seeded sections (Soprano, Alto, Tenor, Bass) exist after migrations."""
    return VoiceSection.objects.get(name=name)


class MemberProfileFactory(DjangoModelFactory):
    class Meta:
        model = MemberProfile

    user = factory.SubFactory(UserFactory)
    voice_section = factory.LazyFunction(voice_section)
