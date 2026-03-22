# ShizenAI

ShizenAI is an MVP for semantic ingestion, competency review, and spaced repetition. It uses a containerized React + FastAPI + PostgreSQL stack and Perplexity API for LLM interactions.

## Prerequisites
- Docker Engine / Docker Desktop
- Git
- Perplexity API key (`PERPLEXITY_API_KEY`)

## Local Startup

```bash
git clone https://github.com/DontSpillTheTea/ShizenAI.git
cd ShizenAI
docker compose up --build -d
```

## Access
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Environment
Create a `.env` file (or export env vars) with:

```bash
PERPLEXITY_API_KEY=your_key_here
ELEVENLABS_API_KEY=optional_for_tts
```

## Runtime Architecture
1. Frontend (`frontend`) - React + Vite UI
2. Backend (`backend`) - FastAPI APIs and evaluation pipeline
3. Database (`postgres`) - PostgreSQL + pgvector

## Notes
- The project stores 768-dimensional vectors in Postgres.
- If `PERPLEXITY_API_KEY` is missing, summary behavior falls back to deterministic local-safe defaults for dev workflows.
