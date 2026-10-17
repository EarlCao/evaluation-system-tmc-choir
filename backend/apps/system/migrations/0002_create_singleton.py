from django.db import migrations


def create_singleton(apps, schema_editor):
    """Seed the settings row so concurrent first requests never race to create it."""
    SystemSettings = apps.get_model("system", "SystemSettings")
    SystemSettings.objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [
        ("system", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_singleton, migrations.RunPython.noop),
    ]
