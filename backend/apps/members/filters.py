import django_filters
from django.db.models import Q

from .models import MemberProfile, VoiceSection


class DirectoryFilter(django_filters.FilterSet):
    """MEM-02: search by name, filter by voice section and evaluation status."""

    search = django_filters.CharFilter(method="filter_search", max_length=100)
    voice_section = django_filters.ModelChoiceFilter(
        queryset=VoiceSection.objects.filter(is_active=True)
    )
    evaluation_status = django_filters.CharFilter(method="filter_evaluation_status")

    class Meta:
        model = MemberProfile
        fields = ["search", "voice_section", "evaluation_status"]

    def filter_search(self, queryset, name, value):
        for term in value.split():
            queryset = queryset.filter(
                Q(user__first_name__icontains=term)
                | Q(user__last_name__icontains=term)
                | Q(user__display_name__icontains=term)
            )
        return queryset

    def filter_evaluation_status(self, queryset, name, value):
        val = str(value).lower().strip()
        if val in ("completed", "evaluated", "done"):
            return queryset.filter(is_evaluated_by_viewer=True)
        elif val in ("pending", "not_evaluated", "unevaluated", "haven_not_evaluated"):
            return queryset.filter(is_evaluated_by_viewer=False)
        return queryset
