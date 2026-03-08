import os
import json
import base64
import re
from openai import AsyncOpenAI
from typing import Optional, List

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are TechBuddy, a patient and friendly AI assistant.
You help elderly users and parents navigate smartphone apps.

You receive three inputs:
  1. A screenshot of the user's current screen (base64 image)
  2. The user's spoken query (transcribed to text)
  3. The session history (previous steps completed)

Your rules:
  - Identify which app and screen is visible
  - Identify all visible UI elements (buttons, fields, menus)
  - Give ONLY ONE instruction at a time
  - Use simple language — NO technical jargon
  - Speak as if talking to a 65-year-old using a phone for the first time
  - NEVER give 2 steps at once

Always respond in this exact JSON format (no markdown fences):
{
  "spoken_instruction": "Tap the green button that says Pay Now",
  "highlight_element": {
    "label": "Pay Now",
    "type": "button",
    "position_hint": "bottom center"
  },
  "step_number": 3,
  "confidence": 0.95,
  "is_complete": false
}"""


async def analyze_screen(
    query: str,
    screenshot: Optional[str],
    history: List[dict],
    step_number: int,
) -> dict:
    """Send screenshot + query + history to GPT-4o Vision and return parsed JSON."""

    history_text = ""
    if history:
        history_text = "\n\nPrevious steps completed:\n"
        for h in history:
            history_text += f"  Step {h.get('step_number', '?')}: {h.get('spoken_instruction', '')}\n"

    user_content = []

    # Add screenshot if provided
    if screenshot:
        # Remove data URI prefix if present so we can re-add it cleanly
        if "," in screenshot:
            header, b64data = screenshot.split(",", 1)
            media_type = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
        else:
            b64data = screenshot
            media_type = "image/png"

        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{media_type};base64,{b64data}",
                "detail": "high",
            },
        })
    else:
        # No screenshot — demo mode
        user_content.append({
            "type": "text",
            "text": "[No screenshot provided — operating in demo mode. Pretend you can see a typical smartphone home screen.]",
        })

    user_content.append({
        "type": "text",
        "text": f"User's question: {query}{history_text}\n\nCurrent step number should be: {step_number + 1}",
    })

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=500,
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if model added them
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback graceful response
        result = {
            "spoken_instruction": "I'm having trouble seeing your screen. Please try again.",
            "highlight_element": None,
            "step_number": step_number + 1,
            "confidence": 0.5,
            "is_complete": False,
        }

    return result


async def demo_response(query: str, step_number: int) -> dict:
    """Return a canned response when OpenAI key is not set (demo mode)."""
    demos = [
        {
            "spoken_instruction": "Look for the blue button at the bottom of the screen that says 'Send Money'.",
            "highlight_element": {"label": "Send Money", "type": "button", "position_hint": "bottom center"},
            "step_number": 1, "confidence": 0.99, "is_complete": False,
        },
        {
            "spoken_instruction": "Tap on the name of the person you want to send money to.",
            "highlight_element": {"label": "Contact Name", "type": "input", "position_hint": "top center"},
            "step_number": 2, "confidence": 0.97, "is_complete": False,
        },
        {
            "spoken_instruction": "Type in the amount you want to send, then tap the green 'Pay' button.",
            "highlight_element": {"label": "Pay", "type": "button", "position_hint": "bottom right"},
            "step_number": 3, "confidence": 0.98, "is_complete": False,
        },
        {
            "spoken_instruction": "Great job! Your money has been sent successfully.",
            "highlight_element": None,
            "step_number": 4, "confidence": 0.99, "is_complete": True,
        },
    ]
    idx = min(step_number, len(demos) - 1)
    return demos[idx]
