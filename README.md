# ShizenAI

ShizenAI is a role-based training and competency verification platform. It ingests knowledge sources, generates flashcards, evaluates employee answers, and schedules review intervals using an SRS loop.

The current stack is **Perplexity-first** (no Ollama runtime dependency) and runs as:
- React/Vite frontend
- FastAPI backend
- PostgreSQL + pgvector
- Terraform-managed GCP deployment

## Tech Stack

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
- Embeddings are generated via a deterministic 768-d hashing fallback to keep pgvector schema stable and avoid heavyweight model downloads.
- Startup seeds default users:
  - `admin` / `admin`
  - `employee` / `employee`

## Data Model (Core)

- `users`
- `topics`
- `knowledge_chunks` (`embedding Vector(768)`)
- `flashcards`
- `user_reviews` (SRS interval + ease factor)
- `user_assignments`
- `progress_cache`
- `omi_captures`
- `knowledge_sources`

## Current Exposed Ports

- `5173` frontend
- `8000` backend/API docs
- `5432` postgres (mapped in compose for local/dev)
