# VibeLink

Peer mock-interview platform with Django REST/Channels and React/Tailwind.

## Run locally

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py runserver

cd ../frontend && npm install && npm run dev
```

The frontend expects the API on `http://localhost:8000`. Open two incognito browser windows, register two users, choose the same role, and they will be matched. For WebSockets in development, start Redis and set `REDIS_URL`; without it, the in-memory layer works in a single server process.
