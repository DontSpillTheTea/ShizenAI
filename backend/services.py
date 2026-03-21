import os
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

AI_PROVIDER = os.getenv("AI_PROVIDER", "local")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434/v1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dummy-key-for-local")

# Nomic-embed-text generates 768-dimensional embeddings by default. 
# text-embedding-3-small generates 1536.
# We will use text-embedding-3-small dimensions and pad/project or just rely on OpenAI if cloud.
# Wait, user PRD originally said 1536. We'll ensure Nomic can be used or padded, or just configure it properly.

def get_client() -> OpenAI:
    if AI_PROVIDER == "local":
        return OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
    else:
        return OpenAI(api_key=OPENAI_API_KEY)

def generate_summary(text: str) -> str:
    client = get_client()
    model = "llama3" if AI_PROVIDER == "local" else "gpt-4o-mini"
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a concise summarizer. Provide a brief, one-paragraph summary of the user's text."},
            {"role": "user", "content": text}
        ],
        max_tokens=256,
        temperature=0.3
    )
    return response.choices[0].message.content.strip()

def generate_embedding(text: str) -> list[float]:
    client = get_client()
    model = "nomic-embed-text" if AI_PROVIDER == "local" else "text-embedding-3-small"
    
    response = client.embeddings.create(
        model=model,
        input=text
    )
    embedding = response.data[0].embedding
    
    return embedding

def mock_external_search(query: str) -> str:
    client = get_client()
    model = "llama3" if AI_PROVIDER == "local" else "gpt-4o-mini"
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a Research Assistant with access to the wider internet. Answer the user's query comprehensively based on general knowledge."},
            {"role": "user", "content": query}
        ],
        max_tokens=256,
        temperature=0.7
    )
    return response.choices[0].message.content.strip()

def mock_audio_synthesis(text: str) -> str:
    # Simulate API latency realistically requested for Mock ElevenLabs
    time.sleep(1.5)
    return "/api/v1/mock-audio"
