import os
from openai import AsyncOpenAI

_client = None

def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


async def text_to_speech(text: str, voice: str = "nova") -> bytes:
    """Convert text to speech using OpenAI TTS. Returns audio bytes (MP3)."""
    response = await get_client().audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
    )
    return response.content
