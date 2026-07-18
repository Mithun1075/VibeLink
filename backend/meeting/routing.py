from django.urls import re_path
from .consumers import MeetingConsumer
websocket_urlpatterns=[re_path(r'ws/meeting/(?P<code>[a-zA-Z0-9]+)/$',MeetingConsumer.as_asgi())]
