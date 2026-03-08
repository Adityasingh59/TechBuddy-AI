from fastapi import APIRouter
from fastapi.responses import JSONResponse
from services.session_store import store
from models.schemas import SessionResponse

router = APIRouter()


@router.get("/new", response_model=SessionResponse)
async def new_session():
    """Create a new session and return its token."""
    session = store.create()
    return SessionResponse(
        session_id=session["session_id"],
        created_at=session["created_at"],
        expires_at=session["expires_at"],
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    store.delete(session_id)
    return {"deleted": True}
