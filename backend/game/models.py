import secrets
import uuid
from django.contrib.gis.db import models

def room_code():
    return ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))

class Pilot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=24)
    created_at = models.DateTimeField(auto_now_add=True)

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=6, unique=True, default=room_code)
    name = models.CharField(max_length=48)
    seed = models.PositiveIntegerField()
    private = models.BooleanField(default=False)
    owner = models.ForeignKey(Pilot, on_delete=models.CASCADE)
    status = models.CharField(max_length=16, default='active')
    score = models.PositiveIntegerField(default=0)
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True)

class Membership(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='members')
    pilot = models.ForeignKey(Pilot, on_delete=models.CASCADE)
    position = models.PointField(srid=3857, null=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'pilot'], name='one_membership')]

class Landmark(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='landmarks')
    index = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=48)
    position = models.PointField(srid=3857)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'index'], name='one_landmark')]

class MissionEvent(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='events')
    kind = models.CharField(max_length=20)
    message = models.CharField(max_length=800)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
