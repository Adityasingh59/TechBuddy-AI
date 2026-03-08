import os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def text_to_speech(text: str, voice: str = "nova") -> bytes:
    """Convert text to speech using OpenAI TTS. Returns audio bytes (MP3)."""
    response = await client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
    )
    return response.content
