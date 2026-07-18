import jwt
from datetime import datetime,timedelta,timezone
from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from .serializers import RegisterSerializer, LoginSerializer
def token(user): return jwt.encode({'id':user.id,'exp':datetime.now(timezone.utc)+timedelta(days=7)},settings.SECRET_KEY,algorithm='HS256')
class RegisterView(APIView):
    permission_classes=[AllowAny]
    def post(self,request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail':'Account created. Please log in.'},status=status.HTTP_201_CREATED)
class LoginView(APIView):
    permission_classes=[AllowAny]
    def post(self,request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user=authenticate(email=serializer.validated_data['email'],password=serializer.validated_data['password'])
        if not user: return Response({'detail':'Incorrect email or password.'},status=status.HTTP_401_UNAUTHORIZED)
        return Response({'token':token(user),'user':{'id':user.id,'name':user.full_name,'email':user.email}})
class MeView(APIView):
    def get(self,request): return Response({'id':request.user.id,'name':request.user.full_name,'email':request.user.email})
