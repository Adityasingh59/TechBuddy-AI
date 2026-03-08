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

SYSTEM_PROMPT = """You are TechBuddy, a patient and friendly AI assistant.
You help elderly users and parents navigate smartphone apps.

You receive three inputs:
  1. A screenshot of the user's current screen (base64 image)
  2. The user's task goal and/or spoken query
  3. The session history (previous steps completed)

Your rules:
  - Carefully examine the screenshot to identify the exact app and screen visible
  - Identify ALL visible UI elements: buttons, input fields, menus, icons, text
  - Give ONLY ONE instruction at a time
  - Use simple language — NO technical jargon
  - Speak as if talking to a 65-year-old using a phone for the first time
  - NEVER give 2 steps at once
  - Base your instruction on what you actually SEE in the screenshot
  - If the task is complete, set is_complete to true

Always respond in this exact JSON format (no markdown fences, no extra text):
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
    task: str = "",
) -> dict:
    """Send screenshot + query + history to GPT-4o Vision and return parsed JSON."""

    history_text = ""
    if history:
        history_text = "\n\nPrevious steps already completed:\n"
        for h in history:
            history_text += f"  Step {h.get('step_number', '?')}: {h.get('spoken_instruction', '')}\n"

    task_context = f"\nUser's overall goal: {task}" if task else ""
    user_content = []

    if screenshot:
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
        user_content.append({
            "type": "text",
            "text": "[No screenshot provided — the user has not shared their screen yet. Ask them to share their screen or describe what they see.]",
        })

    user_content.append({
        "type": "text",
        "text": (
            f"User's question/request: {query}"
            f"{task_context}"
            f"{history_text}"
            f"\n\nNext step number should be: {step_number + 1}"
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
            "spoken_instruction": "I'm having trouble reading the screen. Could you try again or describe what you see?",
            "highlight_element": None,
            "step_number": step_number + 1,
            "confidence": 0.5,
            "is_complete": False,
        }

    return result


# ── Smart demo mode ────────────────────────────────────────────────────────────
# Maps keywords in the task/query to a scripted demo flow.
# This lets the app feel task-aware without an API key.

DEMO_FLOWS = {
    "venmo": [
        {"spoken_instruction": "Open the Venmo app on your phone. Look for the blue 'V' icon on your home screen.", "highlight_element": {"label": "Venmo App", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap the blue 'Pay or Request' button at the bottom of the screen.", "highlight_element": {"label": "Pay or Request", "type": "button", "position_hint": "bottom center"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Search for the person's name at the top and tap on their name when it appears.", "highlight_element": {"label": "Search", "type": "input", "position_hint": "top center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Type in the dollar amount you want to send.", "highlight_element": {"label": "Amount", "type": "input", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap the green 'Pay' button to send the money.", "highlight_element": {"label": "Pay", "type": "button", "position_hint": "bottom center"}, "step_number": 5, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Great job! Your money has been sent successfully on Venmo!", "highlight_element": None, "step_number": 6, "confidence": 0.99, "is_complete": True},
    ],
    "send money": [
        {"spoken_instruction": "Find your payment app — look for Venmo, PayPal, or Cash App on your home screen.", "highlight_element": {"label": "Payment App", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the button that says 'Send', 'Pay', or 'Transfer' — it's usually at the bottom.", "highlight_element": {"label": "Send/Pay", "type": "button", "position_hint": "bottom center"}, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Search for the person you want to send money to by typing their name.", "highlight_element": {"label": "Search", "type": "input", "position_hint": "top center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Type in the amount of money you want to send.", "highlight_element": {"label": "Amount", "type": "input", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap the big green 'Pay' or 'Send' button to complete the payment.", "highlight_element": {"label": "Pay", "type": "button", "position_hint": "bottom center"}, "step_number": 5, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "That's it! Your money has been sent successfully.", "highlight_element": None, "step_number": 6, "confidence": 0.99, "is_complete": True},
    ],
    "whatsapp": [
        {"spoken_instruction": "Open WhatsApp — look for the green icon with a white phone on your home screen.", "highlight_element": {"label": "WhatsApp", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap on the contact or group you want to message from the list.", "highlight_element": {"label": "Contact", "type": "list_item", "position_hint": "middle center"}, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the message box at the bottom of the screen.", "highlight_element": {"label": "Message Box", "type": "input", "position_hint": "bottom center"}, "step_number": 3, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Type your message, then tap the green send button (arrow) on the right.", "highlight_element": {"label": "Send", "type": "button", "position_hint": "bottom right"}, "step_number": 4, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Great job! Your message has been sent!", "highlight_element": None, "step_number": 5, "confidence": 0.99, "is_complete": True},
    ],
    "message": [
        {"spoken_instruction": "Open your Messages app — look for the green speech bubble icon.", "highlight_element": {"label": "Messages", "type": "icon", "position_hint": "bottom center"}, "step_number": 1, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap on the person you want to message, or tap the pencil icon to start a new message.", "highlight_element": {"label": "New Message", "type": "button", "position_hint": "top right"}, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap in the text field at the bottom and type your message.", "highlight_element": {"label": "Text Field", "type": "input", "position_hint": "bottom center"}, "step_number": 3, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap the blue send button to send your message.", "highlight_element": {"label": "Send", "type": "button", "position_hint": "bottom right"}, "step_number": 4, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Your message has been sent. Well done!", "highlight_element": None, "step_number": 5, "confidence": 0.99, "is_complete": True},
    ],
    "call": [
        {"spoken_instruction": "Tap the green Phone icon at the bottom of your home screen.", "highlight_element": {"label": "Phone", "type": "icon", "position_hint": "bottom center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap 'Contacts' or search for the person's name at the top.", "highlight_element": {"label": "Contacts", "type": "tab", "position_hint": "bottom center"}, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap on the person's name to open their contact.", "highlight_element": {"label": "Contact Name", "type": "list_item", "position_hint": "middle center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the big green phone button to call them.", "highlight_element": {"label": "Call", "type": "button", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Great! Your call is connecting. Hold the phone to your ear.", "highlight_element": None, "step_number": 5, "confidence": 0.99, "is_complete": True},
    ],
    "photo": [
        {"spoken_instruction": "Open your Camera app — look for the camera icon on your home screen.", "highlight_element": {"label": "Camera", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Point your phone at what you want to take a photo of.", "highlight_element": None, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the big white circle at the bottom to take the photo.", "highlight_element": {"label": "Shutter", "type": "button", "position_hint": "bottom center"}, "step_number": 3, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Great job! Your photo has been saved to your gallery.", "highlight_element": None, "step_number": 4, "confidence": 0.99, "is_complete": True},
    ],
    "email": [
        {"spoken_instruction": "Open your Mail or Gmail app — look for the envelope icon.", "highlight_element": {"label": "Mail", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap the pencil or compose button — it's usually at the bottom right.", "highlight_element": {"label": "Compose", "type": "button", "position_hint": "bottom right"}, "step_number": 2, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the 'To' field and type the email address of who you're sending to.", "highlight_element": {"label": "To", "type": "input", "position_hint": "top center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the Subject field and type what your email is about.", "highlight_element": {"label": "Subject", "type": "input", "position_hint": "top center"}, "step_number": 4, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the big message area and type your email message.", "highlight_element": {"label": "Message Body", "type": "input", "position_hint": "middle center"}, "step_number": 5, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the send button (usually an arrow at the top) to send your email.", "highlight_element": {"label": "Send", "type": "button", "position_hint": "top right"}, "step_number": 6, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Your email has been sent. Excellent work!", "highlight_element": None, "step_number": 7, "confidence": 0.99, "is_complete": True},
    ],
    "uber": [
        {"spoken_instruction": "Open the Uber app — look for the black icon on your home screen.", "highlight_element": {"label": "Uber", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap on the search bar that says 'Where to?' at the bottom.", "highlight_element": {"label": "Where to?", "type": "input", "position_hint": "bottom center"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Type in the address where you want to go.", "highlight_element": {"label": "Destination", "type": "input", "position_hint": "top center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Choose the type of ride you want — UberX is the cheapest. Tap on it.", "highlight_element": {"label": "UberX", "type": "list_item", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the big 'Request' or 'Confirm' button to book your ride.", "highlight_element": {"label": "Request", "type": "button", "position_hint": "bottom center"}, "step_number": 5, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Your ride has been requested! Wait for your driver to arrive.", "highlight_element": None, "step_number": 6, "confidence": 0.99, "is_complete": True},
    ],
    "settings": [
        {"spoken_instruction": "Find the Settings app — it looks like a grey gear icon on your home screen.", "highlight_element": {"label": "Settings", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Scroll down to find the setting you're looking for and tap on it.", "highlight_element": {"label": "Setting Item", "type": "list_item", "position_hint": "middle center"}, "step_number": 2, "confidence": 0.95, "is_complete": False},
        {"spoken_instruction": "Tap the toggle or button to change the setting.", "highlight_element": {"label": "Toggle", "type": "switch", "position_hint": "middle right"}, "step_number": 3, "confidence": 0.95, "is_complete": False},
        {"spoken_instruction": "Your setting has been changed. You're all done!", "highlight_element": None, "step_number": 4, "confidence": 0.99, "is_complete": True},
    ],
    "wifi": [
        {"spoken_instruction": "Open the Settings app — the grey gear icon on your home screen.", "highlight_element": {"label": "Settings", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap on 'Wi-Fi' near the top of the Settings list.", "highlight_element": {"label": "Wi-Fi", "type": "list_item", "position_hint": "top center"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Make sure Wi-Fi is turned on — the toggle should be green. Tap your network name.", "highlight_element": {"label": "Wi-Fi Toggle", "type": "switch", "position_hint": "top right"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Type in the Wi-Fi password and tap 'Join' or 'Connect'.", "highlight_element": {"label": "Password", "type": "input", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "You're connected to Wi-Fi! You'll see the Wi-Fi symbol at the top of your phone.", "highlight_element": None, "step_number": 5, "confidence": 0.99, "is_complete": True},
    ],
    "instagram": [
        {"spoken_instruction": "Open the Instagram app — look for the colourful camera icon.", "highlight_element": {"label": "Instagram", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap the plus (+) button at the bottom to create a new post.", "highlight_element": {"label": "+", "type": "button", "position_hint": "bottom center"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Select a photo from your gallery by tapping on it.", "highlight_element": {"label": "Photo", "type": "image", "position_hint": "middle center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap 'Next' in the top right corner.", "highlight_element": {"label": "Next", "type": "button", "position_hint": "top right"}, "step_number": 4, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Write a caption for your photo in the text box if you want, then tap 'Share'.", "highlight_element": {"label": "Share", "type": "button", "position_hint": "top right"}, "step_number": 5, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Your photo has been shared on Instagram. Well done!", "highlight_element": None, "step_number": 6, "confidence": 0.99, "is_complete": True},
    ],
    "google maps": [
        {"spoken_instruction": "Open the Google Maps app — look for the red map pin icon.", "highlight_element": {"label": "Google Maps", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap the search bar at the top and type where you want to go.", "highlight_element": {"label": "Search", "type": "input", "position_hint": "top center"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap on the location from the list that appears.", "highlight_element": {"label": "Location Result", "type": "list_item", "position_hint": "middle center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap the blue 'Directions' button.", "highlight_element": {"label": "Directions", "type": "button", "position_hint": "bottom center"}, "step_number": 4, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Tap 'Start' to begin your navigation. Follow the spoken directions!", "highlight_element": {"label": "Start", "type": "button", "position_hint": "bottom center"}, "step_number": 5, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Navigation has started. Follow the blue route and the spoken directions.", "highlight_element": None, "step_number": 6, "confidence": 0.99, "is_complete": True},
    ],
    "youtube": [
        {"spoken_instruction": "Open the YouTube app — look for the red icon with a white play button.", "highlight_element": {"label": "YouTube", "type": "icon", "position_hint": "middle center"}, "step_number": 1, "confidence": 0.99, "is_complete": False},
        {"spoken_instruction": "Tap the search icon (magnifying glass) at the top of the screen.", "highlight_element": {"label": "Search", "type": "button", "position_hint": "top right"}, "step_number": 2, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "Type what you want to watch and tap the search button on your keyboard.", "highlight_element": {"label": "Search Input", "type": "input", "position_hint": "top center"}, "step_number": 3, "confidence": 0.97, "is_complete": False},
        {"spoken_instruction": "Tap on the video you want to watch from the list.", "highlight_element": {"label": "Video", "type": "list_item", "position_hint": "middle center"}, "step_number": 4, "confidence": 0.98, "is_complete": False},
        {"spoken_instruction": "The video is now playing. Enjoy!", "highlight_element": None, "step_number": 5, "confidence": 0.99, "is_complete": True},
    ],
}

# Default generic flow when no keyword matches
GENERIC_FLOW = [
    {"spoken_instruction": "Look at your phone screen. Tell me what you see or what app is open.", "highlight_element": None, "step_number": 1, "confidence": 0.85, "is_complete": False},
    {"spoken_instruction": "Look for the main button or option that relates to what you want to do and tap it.", "highlight_element": {"label": "Main Button", "type": "button", "position_hint": "middle center"}, "step_number": 2, "confidence": 0.80, "is_complete": False},
    {"spoken_instruction": "Follow any on-screen prompts. If you need to type, tap the text area first.", "highlight_element": {"label": "Text Area", "type": "input", "position_hint": "middle center"}, "step_number": 3, "confidence": 0.80, "is_complete": False},
    {"spoken_instruction": "Tap the confirm or submit button to complete your action.", "highlight_element": {"label": "Confirm", "type": "button", "position_hint": "bottom center"}, "step_number": 4, "confidence": 0.85, "is_complete": False},
    {"spoken_instruction": "You're all done! Your task has been completed.", "highlight_element": None, "step_number": 5, "confidence": 0.90, "is_complete": True},
]


def _find_demo_flow(task: str, query: str) -> list:
    """Find the best matching demo flow for the given task/query."""
    combined = (task + " " + query).lower()
    for keyword, flow in DEMO_FLOWS.items():
        if keyword in combined:
            return flow
    return GENERIC_FLOW


async def demo_response(query: str, step_number: int, task: str = "") -> dict:
    """Return a smart, task-aware canned response when OpenAI key is not set."""
    flow = _find_demo_flow(task, query)
    idx = min(step_number, len(flow) - 1)
    return dict(flow[idx])
