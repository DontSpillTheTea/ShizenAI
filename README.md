# ShizenAI

ShizenAI is a local-first semantic context manager and adaptive LLM routing layer.

The platform ingests and organizes knowledge, retrieves relevant context, and routes requests to the cheapest/fastest/most useful available path.

## Product Identity

ShizenAI is structured as two layers:

- Core platform: ingestion, normalization, chunking, embeddings, retrieval, routing, context packaging, observability.
- Application modules: training/tutor, study workflows, transcript memory, and operational knowledge tools.

This keeps the core durable while allowing product modules to evolve independently.

## What the Platform Does

- Ingests source material from documents and text-like inputs.
- Builds semantic chunks with metadata and vector embeddings.
- Stores semantic memory in PostgreSQL + `pgvector`.
- Retrieves top-k relevant context by similarity.
- Routes requests based on confidence, complexity, and runtime constraints.
- Prepares reusable context bundles for downstream AI calls and integrations.

## Tech Stack (Current)

- **Frontend:** React, TypeScript, Vite
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** PostgreSQL 15 + pgvector (`Vector(768)`)
- **AI provider:** Perplexity API (`sonar` models)
- **Infra:** Terraform on GCP (Compute Engine + Cloud SQL private IP + custom VPC)
- **Container runtime:** Docker Compose

## Architecture (Current)

```mermaid
flowchart LR
  U[User Browser] --> FE[Frontend :5173]
  FE -->|REST| BE[FastAPI Backend :8000]
  BE -->|SQL + pgvector| DB[(PostgreSQL + pgvector)]
  BE -->|LLM calls| PPLX[Perplexity API]
  BE -->|Optional TTS| XI[ElevenLabs API]
```

```mermaid
flowchart TD
  A[Admin uploads source] --> B[Parse + chunk content]
  B --> C[Perplexity summary]
  C --> D[Deterministic 768-d embedding]
  D --> E[Store KnowledgeChunk in pgvector]
  E --> F[Generate flashcard question]
  F --> G[Assign to employee]
  G --> H[Employee submits answer]
  H --> I[Similarity + Perplexity judge]
  I --> J[Update SRS state in UserReview]
```

```mermaid
flowchart LR
  Internet --> FW[Firewall: 5173 / 8000]
  FW --> VM[Compute Engine VM]
  VM --> C1[frontend container]
  VM --> C2[backend container]
  VM --> PSA[Private Service Access]
  PSA --> SQL[(Cloud SQL PostgreSQL private IP)]
```

## Local Development

### Prerequisites

- Docker Engine / Docker Desktop
- Git
- Perplexity API key

### Environment

Create `.env` at repo root:

```bash
PERPLEXITY_API_KEY=your_key_here
ELEVENLABS_API_KEY=optional_for_tts
DATABASE_URL=postgresql://postgres:password@postgres:5432/shizenai
VITE_API_URL=http://localhost:8000
```

### Start

```bash
git clone https://github.com/DontSpillTheTea/ShizenAI.git
cd ShizenAI
docker compose up --build -d
```

### Local URLs

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

## GCP Deployment (Terraform)

Infra provisions:

- Custom VPC + subnet
- Private services access for Cloud SQL private IP
- Cloud SQL PostgreSQL 15
- Compute Engine VM with startup bootstrap
- Firewall rules for 5173/8000 (and optional SSH)
- Static external IP output

### Deploy

```bash
cd terraform
terraform init
terraform apply -auto-approve \
  -var="db_password=<your_db_password>" \
  -var="enable_ssh=true" \
  -var="ssh_source_cidr=0.0.0.0/0"
```

Use Terraform outputs for:

- `app_public_ip`
- `db_private_ip`
- `db_connection_name`

## Backend Notes

- `PERPLEXITY_API_KEY` is used for summary/judging/topic extraction.
- Embeddings are generated via a deterministic 768-d fallback to keep pgvector schema stable.
- Startup seeds default users:
  - `admin` / `admin`
  - `employee` / `employee`

## Data Model (Current Core)

- `users`
- `topics`
- `knowledge_chunks` (`embedding Vector(768)`)
- `flashcards`
- `user_reviews` (SRS interval + ease factor)
- `user_assignments`
- `progress_cache`
- `omi_captures`
- `knowledge_sources`

## Roadmap and Reframing Documents

- Root execution checklist: `SHIZENAI_ROADMAP.md`
- Foundation cleanup and architecture audit: `docs/platform_reframing_audit.md`
- Historical phase docs and execution logs remain as implementation history.

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

## Near-Term Priorities

1. Finalize platform-vs-application boundaries in code and API modules.
2. Harden knowledge source/chunk/embedding schema and provenance metadata.
3. Build a first-class routing engine module with explicit decision logging.
4. Standardize context bundle output format for downstream model calls.
5. Preserve training flows as a modular consumer rather than core identity.
