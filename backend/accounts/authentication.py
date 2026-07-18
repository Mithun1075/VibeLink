import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import User
class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header=request.headers.get('Authorization','')
        if not header.startswith('Bearer '): return None
        try:
            data=jwt.decode(header[7:],settings.SECRET_KEY,algorithms=['HS256']); user=User.objects.get(id=data['id'])
            return (user,None)
        except Exception: raise AuthenticationFailed('Your session has expired. Please log in again.')
