from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from accounts.models import User
from accounts.views import token
from config.asgi import application
from rooms.models import InterviewRoom, Participant


class MeetingConsumerTests(TransactionTestCase):
    def setUp(self):
        self.first = User(email='first@example.com', full_name='First Peer')
        self.first.set_password('SecurePass123')
        self.first.save()
        self.second = User(email='second@example.com', full_name='Second Peer')
        self.second.set_password('SecurePass123')
        self.second.save()
        self.room = InterviewRoom.objects.create(role='Python Developer', status='active')
        Participant.objects.create(user=self.first, room=self.room)
        Participant.objects.create(user=self.second, room=self.room)

    def test_two_peer_signaling_chat_and_leave(self):
        async_to_sync(self.run_signaling)()

    async def run_signaling(self):
        first = WebsocketCommunicator(application, f'/ws/meeting/{self.room.room_code}/?token={token(self.first)}')
        second = WebsocketCommunicator(application, f'/ws/meeting/{self.room.room_code}/?token={token(self.second)}')
        self.assertTrue((await first.connect())[0])
        self.assertTrue((await second.connect())[0])

        await first.send_json_to({'type': 'join'})
        await second.send_json_to({'type': 'join'})
        self.assertEqual((await first.receive_json_from())['type'], 'peer_joined')

        await first.send_json_to({'type': 'offer', 'offer': {'type': 'offer', 'sdp': 'offer'}})
        self.assertEqual((await second.receive_json_from())['type'], 'offer')
        await second.send_json_to({'type': 'answer', 'answer': {'type': 'answer', 'sdp': 'answer'}})
        self.assertEqual((await first.receive_json_from())['type'], 'answer')

        await first.send_json_to({'type': 'ice_candidate', 'candidate': {'candidate': 'candidate'}})
        self.assertEqual((await second.receive_json_from())['type'], 'ice_candidate')
        await first.send_json_to({'type': 'chat', 'message': 'Hello peer'})
        chat = await second.receive_json_from()
        self.assertEqual(chat['type'], 'chat')
        self.assertEqual(chat['message'], 'Hello peer')
        self.assertEqual(chat['sender'], 'First Peer')

        await second.disconnect()
        self.assertEqual((await first.receive_json_from())['type'], 'leave')
        await first.disconnect()
