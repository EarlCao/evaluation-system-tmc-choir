from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0002_seed_voice_sections"),
    ]

    operations = [
        migrations.AddField(
            model_name="memberprofile",
            name="is_officer",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="memberprofile",
            name="officer_position",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
