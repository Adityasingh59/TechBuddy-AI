import os
from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse
from services.tts_service import text_to_speech
from models.schemas import TTSRequest

router = APIRouter()

API_KEY_SET = bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "your_openai_api_key_here")


@router.post("")
async def tts(req: TTSRequest):
    if not API_KEY_SET:
        # Return empty audio signal — frontend will use Web Speech API fallback
        return JSONResponse({"demo": True, "text": req.text})

    try:
        audio_bytes = await text_to_speech(req.text, req.voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
