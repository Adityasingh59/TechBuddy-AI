from fastapi import APIRouter
from fastapi.responses import JSONResponse
from services.session_store import store
from models.schemas import SessionCreateRequest, SessionResponse

router = APIRouter()


@router.get("/new", response_model=SessionResponse)
async def new_session(task: str = ""):
    """Create a new session with an optional task description (GET for simple links)."""
    session = store.create(task=task)
    return SessionResponse(
        session_id=session["session_id"],
        created_at=session["created_at"],
        expires_at=session["expires_at"],
        task=session.get("task", ""),
    )


@router.post("/new", response_model=SessionResponse)
async def new_session_post(req: SessionCreateRequest):
    """Create a new session with a task description (POST for full task)."""
    session = store.create(task=req.task)
    return SessionResponse(
        session_id=session["session_id"],
        created_at=session["created_at"],
        expires_at=session["expires_at"],
        task=session.get("task", ""),
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    store.delete(session_id)
    return {"deleted": True}
