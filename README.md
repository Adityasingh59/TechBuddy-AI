# 🤖 TechBuddy AI

> AI-powered phone navigation assistant for elderly users — real-time screen analysis, voice guidance, and step-by-step instructions.

![TechBuddy AI](https://img.shields.io/badge/TechBuddy-AI-14b8a6?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge)

---

## ✨ What It Does

TechBuddy AI watches your phone screen and tells you **exactly what to tap**, one simple step at a time — using AI vision, voice input, and spoken instructions.

---

## 🚀 Quick Start (Local)

### 1. Clone the repo
```bash
git clone https://github.com/Adityasingh59/TechBuddy-AI.git
cd TechBuddy-AI
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup (new terminal)
```bash
cd frontend
npm install
# .env.local already set to localhost:8000
npm run dev
```

Open **http://localhost:3000** in your browser.

> ⚡ **Demo mode**: Works without an OpenAI API key — uses canned responses to demonstrate the full UI flow.

---

## 🌐 Share With Friends (ngrok)

Let friends use TechBuddy from their phone while you run it locally:

### Step 1 — Install ngrok
```bash
# Windows (chocolatey)
choco install ngrok
# Or download from https://ngrok.com/download
```

### Step 2 — Expose backend
```bash
ngrok http 8000
# Copy the https URL, e.g. https://abc123.ngrok-free.app
```

### Step 3 — Expose frontend
```bash
# New terminal
ngrok http 3000
# Copy the https URL, e.g. https://xyz789.ngrok-free.app
```

### Step 4 — Update frontend env
Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
NEXT_PUBLIC_WS_URL=wss://abc123.ngrok-free.app
```
Restart `npm run dev`. Share the frontend ngrok URL with your friends!

---

## ☁️ Free Deployment

### Frontend → Vercel
1. Push this repo to GitHub (already done)
2. Go to [vercel.com](https://vercel.com) → Import → select `TechBuddy-AI`
3. Set **Root Directory** to `frontend`
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL
   - `NEXT_PUBLIC_WS_URL` = `wss://` + your Render backend URL (no https://)
5. Deploy!

### Backend → Render
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Set **Root Directory** to `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add env variable: `OPENAI_API_KEY=your_key_here`
7. Deploy!

---

## 🏗️ Architecture

```
User speaks ──► Web Speech API ──► Text query
Screen captured ──► Canvas API ──► Base64 screenshot
                                        │
              Backend (FastAPI) receives { query + screenshot }
                                        │
              GPT-4o Vision analyzes screenshot + query
                                        │
              Agent returns JSON: { instruction + highlight }
                         ┌─────────────┴────────────────┐
         TTS speaks instruction          Overlay glows on element
                         └─────────────┬────────────────┘
                    User taps → next screenshot → loop
```

## 📁 Project Structure

```
TechBuddy-AI/
├── frontend/               # Next.js 14 App
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── session/        # Active session page
│   │   └── complete/       # Task completion page
│   └── .env.local
├── backend/                # FastAPI Python
│   ├── main.py
│   ├── routers/            # session, analyze, tts, websocket
│   ├── services/           # ai_service, tts_service, session_store
│   └── .env
└── README.md
```

## 🔒 Security

- No screenshots stored after AI processing
- Sessions auto-expire after 30 minutes
- One-time session tokens
- End-to-end encrypted via HTTPS/WSS

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, CSS |
| Screen Capture | WebRTC `getDisplayMedia` |
| Voice Input | Web Speech API |
| AI Vision | OpenAI GPT-4o Vision |
| Text-to-Speech | OpenAI TTS-1 / Web Speech fallback |
| Backend | FastAPI (Python) |
| Real-time | WebSocket |
| Deploy | Vercel + Render |
