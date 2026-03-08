from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import analyze, tts, session, websocket

app = FastAPI(
    title="TechBuddy AI Backend",
    description="AI-powered phone navigation assistant",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow all origins so ngrok tunnels and Vercel deployments work without
# having to update env vars every time.
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_raw == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in allowed_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins if allow_origins != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(session.router, prefix="/session", tags=["Session"])
app.include_router(analyze.router, prefix="/analyze", tags=["Analyze"])
app.include_router(tts.router, prefix="/tts", tags=["TTS"])
app.include_router(websocket.router, tags=["WebSocket"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "TechBuddy AI"}


@app.get("/")
async def root():
    return {"message": "TechBuddy AI API is running 🤖"}
