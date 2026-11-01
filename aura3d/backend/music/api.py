from rest_framework import permissions, serializers, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer

from .models import Track


class PublicReadStaffWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(request.user and request.user.is_staff)


class TrackSerializer(serializers.ModelSerializer):
    is_published = serializers.BooleanField(default=True)

    class Meta:
        model = Track
        fields = ['id', 'title', 'author', 'artist_name', 'artist_website', 'audio', 'cover_art', 'audio_description', 'artist_description', 'is_published', 'duration_seconds', 'created_at', 'updated_at']
        read_only_fields = ['id', 'duration_seconds', 'created_at', 'updated_at']


class TrackViewSet(viewsets.ModelViewSet):
    serializer_class = TrackSerializer
    authentication_classes = [SessionAuthentication]
    permission_classes = [PublicReadStaffWrite]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer]
    pagination_class = None

    def get_queryset(self):
        tracks = Track.objects.all()
        if self.request.user and self.request.user.is_staff:
            return tracks
        return tracks.filter(is_published=True)

