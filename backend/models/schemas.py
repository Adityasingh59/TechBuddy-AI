from pydantic import BaseModel, Field
from typing import Optional


class AnalyzeRequest(BaseModel):
    session_id: str
    query: str = Field(..., description="User's spoken/typed question")
    screenshot: Optional[str] = Field(None, description="Base64 encoded screenshot with data URI prefix")


class HighlightElement(BaseModel):
    label: str
    type: str
    position_hint: str


class AnalyzeResponse(BaseModel):
    spoken_instruction: str
    highlight_element: Optional[HighlightElement] = None
    step_number: int
    confidence: float
    is_complete: bool
    session_id: str


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # OpenAI TTS voice


class SessionResponse(BaseModel):
    session_id: str
    created_at: str
    expires_at: str
