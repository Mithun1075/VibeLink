import uuid
from django.conf import settings
from django.db import models
def create_room_code():
    return uuid.uuid4().hex[:12]

class InterviewRoom(models.Model):
    role=models.CharField(max_length=100); room_code=models.CharField(max_length=20,unique=True,default=create_room_code); status = models.CharField(max_length=20, default='waiting'); created_at=models.DateTimeField(auto_now_add=True)
class Participant(models.Model):
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE); room=models.ForeignKey(InterviewRoom,on_delete=models.CASCADE,related_name='participants'); joined_at=models.DateTimeField(auto_now_add=True)
    class Meta: unique_together=('user','room')
class Message(models.Model):
    room=models.ForeignKey(InterviewRoom,on_delete=models.CASCADE,related_name='messages'); sender=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE); message=models.TextField(max_length=1000); timestamp=models.DateTimeField(auto_now_add=True)
