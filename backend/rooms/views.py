from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import InterviewRoom, Participant, Message
from ai.gemini import generate_questions, generate_answers

ROLES = {
    "Python Developer": [
        "What are Python decorators?",
        "How do lists and tuples differ?",
        "Explain Python’s GIL.",
        "What is a generator and when would you use it?",
        "How does Django ORM prevent SQL injection?",
    ],
    "Frontend Developer": [
        "Explain the virtual DOM.",
        "How do you make a page accessible?",
        "What are closures in JavaScript?",
        "How do you optimize web performance?",
        "Describe CSS specificity.",
    ],
}


class MatchView(APIView):
    @transaction.atomic
    def post(self, request):
        role = request.data.get("role", "").strip()

        if not role:
            return Response(
                {"detail": "A role is required."},
                status=400,
            )

        # If the current user is already inside an active room,
        # return that room immediately.
        existing = (
            InterviewRoom.objects
            .filter(
                role=role,
                status="active",
                participants__user=request.user,
            )
            .first()
        )

        if existing:
            return Response(
                {
                    "matched": True,
                    "room_code": existing.room_code,
                }
            )

        # Find a waiting room created by another user.
        waiting = (
            InterviewRoom.objects
            .select_for_update()
            .filter(
                role=role,
                status="waiting",
            )
            .exclude(participants__user=request.user)
            .first()
        )

        # Ignore rooms that are already full.
        if waiting and waiting.participants.count() >= 2:
            waiting = None

        if waiting:
            Participant.objects.get_or_create(
                room=waiting,
                user=request.user,
            )

            waiting.status = "active"
            waiting.save(update_fields=["status"])

            return Response(
                {
                    "matched": True,
                    "room_code": waiting.room_code,
                }
            )

        # If this user is already waiting, keep returning the same room.
        own = (
            InterviewRoom.objects
            .filter(
                role=role,
                status="waiting",
                participants__user=request.user,
            )
            .first()
        )

        if own:
            return Response(
                {
                    "matched": False,
                    "room_code": own.room_code,
                }
            )

        # Create a new waiting room.
        room = InterviewRoom.objects.create(
            role=role,
            status="waiting",
        )

        Participant.objects.create(
            room=room,
            user=request.user,
        )

        return Response(
            {
                "matched": False,
                "room_code": room.room_code,
            }
        )


class RoomView(APIView):
    def get(self, request, code):
        room = (
            InterviewRoom.objects
            .filter(
                room_code=code,
                participants__user=request.user,
            )
            .first()
        )

        if not room:
            return Response(
                {"detail": "Room not found."},
                status=404,
            )

        messages = list(
            room.messages
            .select_related("sender")
            .order_by("-timestamp")[:50]
        )[::-1]

        return Response(
            {
                "room_code": room.room_code,
                "role": room.role,
                "status": room.status,
                "participants": [
                    {
                        "id": p.user_id,
                        "name": p.user.full_name,
                    }
                    for p in room.participants.select_related("user")
                ],
                "messages": [
                    {
                        "id": m.id,
                        "sender": m.sender.full_name,
                        "sender_id": m.sender_id,
                        "message": m.message,
                        "timestamp": m.timestamp,
                    }
                    for m in messages
                ],
            }
        )

class AIQuestionsView(APIView):

    def post(self, request):

        role = request.data.get("role", "General")

        questions = generate_questions(role)

        return Response({
            "role": role,
            "questions": [
                {
                    "question": q
                }
                for q in questions
            ]
        })
class AIAnswersView(APIView):

    def post(self, request):

        role = request.data.get("role")

        questions = request.data.get("questions", [])

        answers = generate_answers(role, questions)

        return Response({
            "answers": answers
        })