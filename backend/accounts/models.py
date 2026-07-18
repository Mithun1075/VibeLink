from django.contrib.auth.models import AbstractUser
from django.db import models
class User(AbstractUser):
    full_name=models.CharField(max_length=150)
    email=models.EmailField(unique=True)
    username=models.CharField(max_length=150, blank=True)
    USERNAME_FIELD='email'; REQUIRED_FIELDS=['full_name']
    def save(self,*args,**kwargs):
        if not self.username: self.username=self.email
        super().save(*args,**kwargs)
