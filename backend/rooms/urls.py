from django.urls import path
from .views import MatchView, RoomView, AIQuestionsView, AIAnswersView
urlpatterns=[path('match/',MatchView.as_view()),path('rooms/<str:code>/',RoomView.as_view()),
             path('ai/questions/',AIQuestionsView.as_view()),path("ai/answers/", AIAnswersView.as_view())]
