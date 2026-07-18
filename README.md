# VibeLink

**Connect. Practice. Improve.**

VibeLink is an AI-powered peer mock interview platform that connects users based on their selected job role and enables them to practice technical interviews through real-time video calls. The platform uses AI to generate interview questions and sample answers, helping candidates improve their interview performance.

## ✨ Features

- 🔐 User Registration & Login
- 👨‍💻 Role-based Interview Matching
- 🎥 Real-time Video Calling (WebRTC)
- ⚡ Real-time Signaling using Django Channels & WebSockets
- 🤖 AI-generated Technical Interview Questions
- 💡 AI-generated Sample Answers
- 👥 Peer-to-Peer Mock Interview Sessions
- 📱 Responsive Modern UI

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- Tailwind CSS
- Axios
- WebRTC

### Backend
- Python
- Django
- Django REST Framework
- Django Channels
- Daphne
- SQLite

### AI
- Google Gemini API

---

## 🚀 Installation

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Environment Variables

Create a `.env` file inside the **backend** folder.

```env
SECRET_KEY=your_secret_key

GEMINI_API_KEY=your_gemini_api_key
```

---

## 📌 Usage

1. Register two different users.
2. Login with both accounts.
3. Select the same interview role.
4. Wait for automatic matching.
5. Join the video interview.
6. Generate AI interview questions.
7. View AI-generated sample answers.

---

## 📷 Project Preview

Add screenshots of:

- Login Page
- Home Page
- Role Selection
- Waiting Room
- Video Interview Page
- AI Interview Assistant

---

## 👨‍💻 Author

**Mithun R**

GitHub: https://github.com/Mithun1075
