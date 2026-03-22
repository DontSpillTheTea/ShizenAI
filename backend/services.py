import os
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

AI_PROVIDER = os.getenv("AI_PROVIDER", "local")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434/v1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dummy-key-for-local")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")

# Nomic-embed-text generates 768-dimensional embeddings by default. 
# text-embedding-3-small generates 1536.
# We will use text-embedding-3-small dimensions and pad/project or just rely on OpenAI if cloud.
# Wait, user PRD originally said 1536. We'll ensure Nomic can be used or padded, or just configure it properly.

def get_client() -> OpenAI:
    if AI_PROVIDER == "local":
        return OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
    else:
        return OpenAI(api_key=OPENAI_API_KEY)

def local_llm_generate(sys_prompt: str, user_prompt: str) -> str:
    client = get_client()
    model = "qwen2.5:1.5b-instruct" if AI_PROVIDER == "local" else "gpt-4o-mini"
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=512,
        temperature=0.3
    )
    return response.choices[0].message.content.strip()

def generate_summary(text: str) -> str:
    sys = "You are a concise summarizer. Provide a brief, one-paragraph summary of the user's text."
    return local_llm_generate(sys, text)

def generate_embedding(text: str) -> list[float]:
    client = get_client()
    model = "nomic-embed-text" if AI_PROVIDER == "local" else "text-embedding-3-small"
    
    response = client.embeddings.create(
        model=model,
        input=text
    )
    embedding = response.data[0].embedding
    
    return embedding

def external_perplexity_chat(system_prompt: str, messages: list[dict], model_name: str = "sonar") -> str:
    if not PERPLEXITY_API_KEY:
        return '{"is_correct": false, "has_question": false, "response": "Perplexity API Key missing."}'
    
    pplx_client = OpenAI(base_url="https://api.perplexity.ai", api_key=PERPLEXITY_API_KEY)
    
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

    if not PERPLEXITY_API_KEY:
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

