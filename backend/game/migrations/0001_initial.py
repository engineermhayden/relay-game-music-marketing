import uuid
import django.db.models.deletion
import django.contrib.gis.db.models.fields
import game.models
from django.contrib.postgres.operations import CreateExtension
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        CreateExtension('postgis'),
        migrations.CreateModel(name='Pilot', fields=[('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)), ('name', models.CharField(max_length=24)), ('created_at', models.DateTimeField(auto_now_add=True))]),
        migrations.CreateModel(name='Room', fields=[('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)), ('code', models.CharField(max_length=6, unique=True, default=game.models.room_code)), ('name', models.CharField(max_length=48)), ('seed', models.PositiveIntegerField()), ('private', models.BooleanField(default=False)), ('status', models.CharField(max_length=16, default='active')), ('score', models.PositiveIntegerField(default=0)), ('snapshot', models.JSONField(default=dict)), ('created_at', models.DateTimeField(auto_now_add=True)), ('finished_at', models.DateTimeField(null=True)), ('owner', models.ForeignKey(to='game.pilot', on_delete=django.db.models.deletion.CASCADE))]),
        migrations.CreateModel(name='Membership', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('position', django.contrib.gis.db.models.fields.PointField(srid=3857, null=True)), ('joined_at', models.DateTimeField(auto_now_add=True)), ('pilot', models.ForeignKey(to='game.pilot', on_delete=django.db.models.deletion.CASCADE)), ('room', models.ForeignKey(to='game.room', related_name='members', on_delete=django.db.models.deletion.CASCADE))], options={'constraints': [models.UniqueConstraint(fields=('room', 'pilot'), name='one_membership')]}),
        migrations.CreateModel(name='Landmark', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('index', models.PositiveSmallIntegerField()), ('name', models.CharField(max_length=48)), ('position', django.contrib.gis.db.models.fields.PointField(srid=3857)), ('room', models.ForeignKey(to='game.room', related_name='landmarks', on_delete=django.db.models.deletion.CASCADE))], options={'constraints': [models.UniqueConstraint(fields=('room', 'index'), name='one_landmark')]}),
        migrations.CreateModel(name='MissionEvent', fields=[('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')), ('kind', models.CharField(max_length=20)), ('message', models.CharField(max_length=800)), ('data', models.JSONField(default=dict)), ('created_at', models.DateTimeField(auto_now_add=True)), ('room', models.ForeignKey(to='game.room', related_name='events', on_delete=django.db.models.deletion.CASCADE))]),
    ]
