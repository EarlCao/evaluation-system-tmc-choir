from django.db import migrations

SECTIONS = ["Soprano", "Alto", "Tenor", "Bass"]


def seed(apps, schema_editor):
    VoiceSection = apps.get_model("members", "VoiceSection")
    for order, name in enumerate(SECTIONS, start=1):
        VoiceSection.objects.get_or_create(name=name, defaults={"sort_order": order})


class Migration(migrations.Migration):
    dependencies = [
        ("members", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
