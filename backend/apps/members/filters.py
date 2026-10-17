import django_filters
from django.db.models import Q

from .models import MemberProfile, VoiceSection


class DirectoryFilter(django_filters.FilterSet):
    """MEM-02: search by name, filter by voice section."""

    search = django_filters.CharFilter(method="filter_search", max_length=100)
    voice_section = django_filters.ModelChoiceFilter(
        queryset=VoiceSection.objects.filter(is_active=True)
    )

    class Meta:
        model = MemberProfile
        fields = ["search", "voice_section"]

    def filter_search(self, queryset, name, value):
        for term in value.split():
            queryset = queryset.filter(
                Q(user__first_name__icontains=term)
                | Q(user__last_name__icontains=term)
                | Q(user__display_name__icontains=term)
            )
        return queryset
