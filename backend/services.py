import os
import time
import math
import hashlib
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
def get_perplexity_api_key() -> str:
    return (os.getenv("PERPLEXITY_API_KEY") or "").strip()

def _hash_embedding_768(text: str) -> list[float]:
    """
    Deterministic lightweight 768-d embedding fallback.
    Keeps pgvector schema compatible without requiring model downloads.
    """
    dims = 768
    vec = [0.0] * dims
    tokens = re.findall(r"[a-zA-Z0-9_]+", (text or "").lower())

    if not tokens:
        return vec

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        # Spread each token across four dimensions with signed updates.
        for offset in (0, 8, 16, 24):
            idx = int.from_bytes(digest[offset:offset + 2], "big") % dims
            sign = 1.0 if (digest[offset + 2] & 1) == 0 else -1.0
            magnitude = 0.5 + (digest[offset + 3] / 255.0)
            vec[idx] += sign * magnitude

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def generate_summary(text: str) -> str:
    if not text:
        return ""
    if not get_perplexity_api_key():
        # Graceful fallback if key is missing in a local/dev environment.
        return text[:600]

    sys = (
        "You are a concise summarizer. Return one short paragraph, plain text only. "
        "Do not include markdown or bullet points."
    )
    return external_perplexity_chat(
        system_prompt=sys,
        messages=[{"role": "user", "content": text[:6000]}],
        model_name="sonar"
    )

def generate_flashcard_question(chunk_text: str) -> str:
    if not chunk_text:
        return ""
    if not get_perplexity_api_key():
        sentences = [s.strip() for s in chunk_text.split('.') if s.strip()]
        core = sentences[0] if sentences else chunk_text[:120]
        return f"What does this mean: \"{core}\"?"

    sys = (
        "You are a flashcard question writer. Given source text, generate ONE highly specific "
        "question whose answer is literally in the text. Output ONLY the question, no numbering, "
        "no preamble, no markdown. Plain text question only."
    )
    return external_perplexity_chat(
        system_prompt=sys,
        messages=[{"role": "user", "content": chunk_text[:4000]}],
        model_name="sonar"
    )

def generate_embedding(text: str) -> list[float]:
    return _hash_embedding_768(text)

def external_perplexity_chat(system_prompt: str, messages: list[dict], model_name: str = "sonar") -> str:
    api_key = get_perplexity_api_key()
    if not api_key:
        return '{"is_correct": false, "has_question": false, "response": "Perplexity API Key missing."}'
    
    pplx_client = OpenAI(base_url="https://api.perplexity.ai", api_key=api_key)
    
    payload_messages = [{"role": "system", "content": system_prompt}] + messages
    try:
        response = pplx_client.chat.completions.create(
            model=model_name,
            messages=payload_messages,
            max_tokens=600,
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f'{{\n"is_correct": false,\n"has_question": false,\n"response": "Perplexity API Error: {str(e)}"\n}}'

def mock_audio_synthesis(text: str) -> str:
    # Simulate API latency realistically requested for Mock ElevenLabs
    time.sleep(1.5)
    return "/api/v1/mock-audio"

def extract_topics_from_transcript(transcript_text: str) -> list[dict]:
    """
    Use Perplexity to extract 1-5 concrete training topics from a transcript.
    Returns list of {title, description} dicts.
    Falls back to a single generic topic on any failure.
    """
    FALLBACK = [{"title": "Imported Omi knowledge review", "description": "Informally captured knowledge pending manager review."}]

    if not get_perplexity_api_key():
        return FALLBACK

    system_prompt = (
        "You are a knowledge extraction assistant. "
        "Given an informal transcript or spoken conversation, extract 1 to 5 concrete training topics. "
        "Focus on: operational procedures, architecture concepts, decision rules, system mental models, or explicit expectations. "
        "Ignore filler, small talk, and off-topic content. "
        "Return ONLY a valid JSON array. No markdown. No prose. No code fences. "
        "Each item must have exactly two keys: 'title' (string) and 'description' (string). "
        "Example: [{\"title\": \"Rollback procedure\", \"description\": \"How deployments are safely rolled back.\"}]"
    )

    try:
        raw = external_perplexity_chat(
            system_prompt,
            [{"role": "user", "content": f"Transcript:\n\n{transcript_text[:4000]}"}],
            model_name="sonar"
        )

        import json, re
        # Strip any accidental markdown fences
        cleaned = re.sub(r"```[a-z]*", "", raw).strip().strip("`").strip()
        topics = json.loads(cleaned)

        if not isinstance(topics, list):
            return FALLBACK

        # Deduplicate by normalized title, cap at 5
        seen = set()
        deduped = []
        for t in topics:
            if not isinstance(t, dict) or "title" not in t:
                continue
            key = t["title"].strip().lower()
            if key not in seen:
                seen.add(key)
                deduped.append({"title": t["title"].strip(), "description": t.get("description", "").strip()})
            if len(deduped) >= 5:
                break

        return deduped if deduped else FALLBACK

    except Exception as e:
        print(f"Topic extraction failed: {e}")
        return FALLBACK

