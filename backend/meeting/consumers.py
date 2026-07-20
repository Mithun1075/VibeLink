import json
import jwt
import logging
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from accounts.models import User
from rooms.models import InterviewRoom, Participant, Message

logger = logging.getLogger(__name__)


class MeetingConsumer(AsyncWebsocketConsumer):
    """Authenticated relay for a two-person room; media stays browser-to-browser."""

    async def connect(self):
        self.code = self.scope['url_route']['kwargs']['code']
        self.group = f'meeting_{self.code}'
        self.user = await self.get_authenticated_user()
        if not self.user or not await self.user_can_join():
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        self.joined = False
        self.intentional_leave = False
        logger.info('Meeting WebSocket connected: room=%s user=%s', self.code, self.user.id)

    async def disconnect(self, close_code):
        if not hasattr(self, "group"):
            return

        if getattr(self, "joined", False) and not self.intentional_leave:
            await self.channel_layer.group_send(
                self.group,
                {
                    "type": "relay_event",
                    "event": "partner_disconnected",
                    "sender": self.channel_name,
                    "payload": {
                        "participant": getattr(
                            self.user,
                            "full_name",
                            "Participant",
                        )
                    },
                },
            )

        # Cleanup database
        await self.cleanup_room()

        await self.channel_layer.group_discard(
            self.group,
            self.channel_name,
        )

        logger.info(
            "Meeting WebSocket disconnected: room=%s user=%s code=%s",
            self.code,
            self.user.id,
            close_code,
        )
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        event = data.get('type')
        if event not in {'join', 'offer', 'answer', 'ice_candidate', 'chat', 'leave'}:
            logger.warning('Ignoring unsupported meeting event: room=%s event=%s', self.code, event)
            return
        if event == 'join':
            if self.joined:
                return
            self.joined = True
            logger.info('Meeting participant joined: room=%s user=%s', self.code, self.user.id)
            # Notify the joining browser as well. Only the browser already in
            # the room is nominated to create the SDP offer, avoiding glare.
            await self.send(text_data=json.dumps({
                'type': 'peer_joined', 'participant': self.user.full_name,
                'initiator': False,
            }))
            await self.channel_layer.group_send(self.group, {
                'type': 'relay_event', 'event': 'peer_joined', 'sender': self.channel_name,
                'payload': {'participant': self.user.full_name, 'initiator': True},
            })
            return
        if not self.joined:
            logger.warning('Ignoring meeting event before join: room=%s user=%s event=%s', self.code, self.user.id, event)
            return
        if event == 'chat':
            content = str(data.get('message', '')).strip()
            if not content:
                return
            message = await self.save_message(content[:1000])
            payload = {'message': message.message, 'sender': self.user.full_name,
                       'sender_id': self.user.id, 'timestamp': message.timestamp.isoformat()}
        else:
            payload = {key: value for key, value in data.items() if key != 'type'}
        await self.channel_layer.group_send(self.group, {
            'type': 'relay_event', 'event': event, 'sender': self.channel_name, 'payload': payload,
        })
        if event in {'offer', 'answer', 'ice_candidate', 'leave'}:
            logger.info('Relayed WebRTC event: room=%s user=%s event=%s', self.code, self.user.id, event)
        if event == "leave":
            self.intentional_leave = True
            self.joined = False

    async def relay_event(self, event):
        if event['sender'] != self.channel_name:
            await self.send(text_data=json.dumps({'type': event['event'], **event['payload']}))

    @database_sync_to_async
    def get_authenticated_user(self):
        try:
            query = self.scope['query_string'].decode()
            token = next(item.split('=', 1)[1] for item in query.split('&') if item.startswith('token='))
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            return User.objects.get(id=payload['id'], is_active=True)
        except Exception:
            logger.exception('Unable to authenticate meeting WebSocket')
            return None

    @database_sync_to_async
    def user_can_join(self):
        return InterviewRoom.objects.filter(
            room_code=self.code, status='active', participants__user=self.user,
        ).exists()

    @database_sync_to_async
    def save_message(self, content):
        room = InterviewRoom.objects.get(room_code=self.code)
        return Message.objects.create(room=room, sender=self.user, message=content)
    
    @database_sync_to_async
    def cleanup_room(self):
        try:
            room = InterviewRoom.objects.get(room_code=self.code)

            # Remove this participant
            Participant.objects.filter(
                room=room,
                user=self.user,
            ).delete()

            count = room.participants.count()

            if count <= 1:
                Participant.objects.filter(room=room).delete()
                room.delete()

        except InterviewRoom.DoesNotExist:
            pass
            
