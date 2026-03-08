import uuid
import datetime
import os
from typing import Dict, List, Optional


SESSION_TIMEOUT = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))


class SessionStore:
    """Simple in-memory session store. Swap for Redis later."""

    def __init__(self):
        self._sessions: Dict[str, dict] = {}

    def create(self) -> dict:
        session_id = str(uuid.uuid4())
        now = datetime.datetime.utcnow()
        session = {
            "session_id": session_id,
            "created_at": now.isoformat(),
            "expires_at": (now + datetime.timedelta(minutes=SESSION_TIMEOUT)).isoformat(),
            "history": [],          # List of past steps
            "step_number": 0,
            "is_complete": False,
        }
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[dict]:
        session = self._sessions.get(session_id)
        if not session:
            return None
        # Auto-expire check
        expires = datetime.datetime.fromisoformat(session["expires_at"])
        if datetime.datetime.utcnow() > expires:
            del self._sessions[session_id]
            return None
        return session

    def add_step(self, session_id: str, step: dict):
        session = self.get(session_id)
        if session:
            session["history"].append(step)
            # Keep rolling window of last 10 steps
            if len(session["history"]) > 10:
                session["history"] = session["history"][-10:]
            session["step_number"] = step.get("step_number", session["step_number"])
            session["is_complete"] = step.get("is_complete", False)

    def get_history(self, session_id: str) -> List[dict]:
        session = self.get(session_id)
        return session["history"] if session else []

    def mark_complete(self, session_id: str):
        session = self.get(session_id)
        if session:
            session["is_complete"] = True

    def delete(self, session_id: str):
        self._sessions.pop(session_id, None)


# Global singleton
store = SessionStore()
