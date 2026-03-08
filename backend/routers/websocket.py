import os
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.ai_service import analyze_screen, demo_response
from services.session_store import store

router = APIRouter()

API_KEY_SET = bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "your_openai_api_key_here")


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    session = store.get(session_id)
    if not session:
        await websocket.send_json({"error": "Session not found or expired"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            query = data.get("query", "")
            screenshot = data.get("screenshot")

            history = store.get_history(session_id)
            step_number = store.get(session_id).get("step_number", 0)

            if API_KEY_SET:
                result = await analyze_screen(
                    query=query,
                    screenshot=screenshot,
                    history=history,
                    step_number=step_number,
                )
            else:
                result = await demo_response(query, step_number)

            store.add_step(session_id, result)
            result["session_id"] = session_id

            await websocket.send_json(result)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
