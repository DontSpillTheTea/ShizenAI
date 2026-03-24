# ShizenAI

ShizenAI is a local-first semantic context manager and adaptive LLM routing layer.

The platform ingests and organizes knowledge, retrieves relevant context, and decides the most practical response path across local models, internal compute, or external providers.

## Product Identity

ShizenAI is now framed as a platform with two layers:

- Core platform: ingestion, normalization, chunking, embeddings, retrieval, routing, context packaging, observability.
- Application modules: training/tutor, study workflows, transcript memory, operational knowledge tools.

This keeps the core durable while allowing product modules to evolve independently.

## What the Platform Does

- Ingests source material from documents and text-like inputs.
- Builds semantic chunks with metadata and vector embeddings.
- Stores semantic memory in PostgreSQL + `pgvector`.
- Retrieves top-k relevant context by similarity.
- Routes requests based on confidence, complexity, and runtime constraints.
- Prepares reusable context bundles for downstream AI calls and future integrations.

## Current Architecture

The running stack remains containerized and local-first:

1. Frontend (`shizenai-frontend`)
   - React + Vite interface for ingestion, retrieval, and app workflows.
2. Backend (`shizenai-backend`)
   - FastAPI service with ingestion, retrieval, auth, and app modules.
3. Database (`shizenai-postgres`)
   - PostgreSQL + `pgvector` for relational and vector storage.
4. Model runtime (`shizenai-ollama`)
   - Local inference endpoint for summarization and embeddings.

## Setup

### Prerequisites

- Docker Engine / Docker Desktop.
- Git.
- Enough local resources for model inference (8GB+ RAM/VRAM recommended).

### Start the stack

```bash
git clone https://github.com/DontSpillTheTea/ShizenAI.git
cd ShizenAI
docker compose up --build -d
```

### Initialize local models (first run)

Windows (PowerShell):

```powershell
./init_ollama.ps1
```

Mac/Linux:

```bash
docker compose exec ollama ollama pull qwen2.5:1.5b-instruct
docker compose exec ollama ollama pull nomic-embed-text
```

### Access points

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Operational Commands

Pause stack while preserving state:

```bash
docker compose stop
```

Shut down containers/network while retaining external data volumes:

```bash
docker compose down
```

Hard reset (includes volume deletion):

```bash
docker compose down -v
docker volume rm shizen_pg_data shizen_ollama_models
```

## Roadmap and Reframing Documents

- Root execution checklist: `SHIZENAI_ROADMAP.md`
- Foundation cleanup and architecture audit: `docs/platform_reframing_audit.md`
- Historical phase docs and execution logs remain as implementation history.

## Near-Term Priorities

1. Finalize platform-vs-application boundaries in code and API modules.
2. Harden knowledge source/chunk/embedding schema and provenance metadata.
3. Build a first-class routing engine module with explicit decision logging.
4. Standardize context bundle output format for downstream model calls.
5. Preserve training flows as a modular consumer rather than core identity.
