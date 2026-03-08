import os
import json
import re
from openai import AsyncOpenAI
from typing import Optional, List

_client = None

def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are TechBuddy, a patient and friendly AI assistant helping elderly users and non-technical people navigate smartphone apps.

You receive:
1. A screenshot of the user's current screen (or none if not shared yet)
2. The user's overall goal / task description
3. Their current question or request
4. Previous steps already completed in this session

Your job:
- Carefully LOOK at the screenshot to identify exactly which app is open and what is visible on screen
- Identify ALL visible UI elements: buttons, text fields, icons, menus, lists, toggles
- Determine the SINGLE next physical tap or action the user needs to take RIGHT NOW
- Never skip ahead — one step at a time only
- Use plain everyday language — no technical terms
- Speak as if guiding a 70-year-old over the phone: warm, patient, precise
- If no screen is shared, ask them to describe what they see or share their screen

If the task looks complete, set is_complete to true and congratulate them warmly.

IMPORTANT: You are SCREEN-AWARE. Your instructions must reference what you can literally SEE in the screenshot.
If there is no screenshot, be honest — say you cannot see their screen yet and give general guidance based on their stated goal.

Always respond ONLY with this exact JSON (no markdown, no extra text):
{
  "spoken_instruction": "Tap the blue button at the bottom that says Pay Now",
  "highlight_element": {
    "label": "Pay Now",
    "type": "button",
    "position_hint": "bottom center"
  },
  "step_number": 3,
  "confidence": 0.95,
  "is_complete": false
}

If there is no specific element to highlight, set highlight_element to null."""


async def analyze_screen(
    query: str,
    screenshot: Optional[str],
    history: List[dict],
    step_number: int,
    task: str = "",
) -> dict:
    """Send screenshot + query + context to GPT-4o Vision and get next step."""

    history_text = ""
    if history:
        history_text = "\n\nSteps already completed this session:\n"
        for h in history:
            history_text += f"  Step {h.get('step_number', '?')}: {h.get('spoken_instruction', '')}\n"

    task_context = f"\nUser's overall goal: {task}" if task else ""

    user_content = []

    if screenshot:
        # Handle both bare base64 and data URI
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
        user_content.append({
            "type": "text",
            "text": (
                f"The screenshot above shows the user's current screen."
                f"{task_context}"
                f"\nUser says: {query}"
                f"{history_text}"
                f"\nNext step number should be: {step_number + 1}"
            ),
        })
    else:
        user_content.append({
            "type": "text",
            "text": (
                f"[No screenshot available — the user has not shared their screen yet.]"
                f"{task_context}"
                f"\nUser says: {query}"
                f"{history_text}"
                f"\nNext step number should be: {step_number + 1}"
                f"\nSince there is no screenshot, give guidance based on their stated goal."
                f" Ask them to describe what they see or share their screen for better help."
            ),
        })

    response = await get_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=500,
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "spoken_instruction": "I'm having trouble reading the screen. Could you try again?",
            "highlight_element": None,
            "step_number": step_number + 1,
            "confidence": 0.5,
            "is_complete": False,
        }

    return result


async def demo_response(query: str, step_number: int, task: str = "") -> dict:
    """
    Demo mode: No OpenAI key. Instead of keyword matching to canned flows,
    we reason transparently about the task and admit we can't see the screen.
    This makes it clear what real AI mode would do differently.
    """
    task_hint = f" for '{task}'" if task else ""

    steps = [
        {
            "spoken_instruction": (
                f"I can see you want help{task_hint}. "
                f"To guide you precisely, please tap 'Share My Screen' so I can see exactly what's on your phone. "
                f"Without seeing your screen, I can only give general directions."
            ),
            "highlight_element": None,
            "step_number": 1,
            "confidence": 0.7,
            "is_complete": False,
        },
        {
            "spoken_instruction": (
                f"I'm in demo mode — I can't see your screen yet. "
                f"In full AI mode (with an OpenAI API key), I would look at your screen right now and tell you exactly which button to tap. "
                f"For now: look for the main action button on your screen — it's usually a large colourful button — and tap it."
            ),
            "highlight_element": {
                "label": "Main Action",
                "type": "button",
                "position_hint": "bottom center"
            },
            "step_number": 2,
            "confidence": 0.6,
            "is_complete": False,
        },
        {
            "spoken_instruction": (
                f"Add your OpenAI API key to backend/.env to unlock real screen analysis. "
                f"Once active, I'll read every element on your screen and guide you through any task — step by step."
            ),
            "highlight_element": None,
            "step_number": 3,
            "confidence": 0.5,
            "is_complete": False,
        },
    ]

    idx = min(step_number, len(steps) - 1)
    return dict(steps[idx])
