import os
from fastapi import APIRouter, HTTPException
from services.ai_service import analyze_screen, demo_response
from services.session_store import store
from models.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter()

API_KEY_SET = bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "your_openai_api_key_here")


@router.post("", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    # Allow demo sessions (id starts with "demo-") to skip store lookup
    if req.session_id.startswith("demo-"):
        task = ""
        step_number = 0
        history = []
    else:
        session = store.get(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        task = store.get_task(req.session_id)
        history = store.get_history(req.session_id)
        step_number = session.get("step_number", 0)

    # Use task from query override if provided
    effective_task = req.query if req.session_id.startswith("demo-") else task

    if API_KEY_SET:
        result = await analyze_screen(
            query=req.query,
            screenshot=req.screenshot,
            history=history,
            step_number=step_number,
            task=task,
        )
    else:
        result = await demo_response(req.query, step_number, task=task)

    if not req.session_id.startswith("demo-"):
        store.add_step(req.session_id, result)

    return AnalyzeResponse(
        spoken_instruction=result.get("spoken_instruction", ""),
        highlight_element=result.get("highlight_element"),
        step_number=result.get("step_number", step_number + 1),
        confidence=result.get("confidence", 0.9),
        is_complete=result.get("is_complete", False),
        session_id=req.session_id,
    )
