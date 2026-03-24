# Phase A Audit: Platform Reframing

This document records the current architecture split and migration posture as ShizenAI transitions from a training-oriented MVP to a semantic context platform.

## 1) Target Layer Split

### Layer A: Core Platform (durable)

- Ingestion and normalization
- Chunking and metadata enrichment
- Embeddings and semantic storage
- Retrieval and context packaging
- Routing and provider selection
- Observability and decision traceability

### Layer B: Application Modules (replaceable)

- Training/competency workflows
- Flashcard and SRS experience
- Role-specific dashboards
- Voice tutor behavior and conversational review

## 2) Current Backend Route Classification

Classification based on current endpoints in `backend/main.py`, `backend/routers/admin.py`, and `backend/routers/employee.py`.

### Core platform routes

- `POST /api/v1/admin/upload`
  - Reason: ingestion + chunking + summary + embedding + chunk persistence.

### Application-layer routes

- `POST /api/v1/auth/token`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/assign`
- `GET /api/v1/admin/hierarchy/topics`
- `GET /api/v1/employee/hierarchy/topics`
- `GET /api/v1/employee/queue`
- `POST /api/v1/employee/evaluate`
- `GET /api/v1/employee/topic/{topic_id}/cards`
- `POST /api/v1/employee/mark_wrong/{flashcard_id}`

### Hackathon-only shortcuts to isolate

- `POST /api/v1/employee/tts`
  - Tight coupling to one external TTS vendor in application route.
- Seeded default users in startup flow (`admin` / `employee`)
  - Useful for demos, not canonical for platform operation.
- Hardcoded model and threshold logic in training evaluation flows
  - Should move behind routing/provider abstractions.

## 3) Canonical vs Legacy Data Model Position

### Canonical platform entities (to formalize next)

- `knowledge_sources`
- `source_versions`
- `knowledge_chunks`
- `chunk_embeddings`
- `chunk_summaries`
- `collections`
- `tags`
- `retrieval_events`
- `routing_decisions`
- `provider_runs`
- `context_bundles`

### Existing entities that can map to canonical core now

- `knowledge_chunks` (already present)
- `topics` (candidate ancestor for `collections` / taxonomy)

### Existing application entities (keep modular)

- `flashcards`
- `user_reviews`
- `user_assignments`
- `progress_cache`

## 4) Naming Standard (Platform Vocabulary)

Use these terms in new code/docs, and prefer them over app-specific wording:

- source, source version
- chunk, chunk summary, chunk embedding
- retrieval result, retrieval confidence
- routing decision, provider run
- context bundle

Avoid allowing training-specific nouns to represent the base platform domain model.

## 5) Immediate Refactor Notes

- Extract retrieval and provider calls from tutor evaluation code into reusable services.
- Introduce a first-class routing module before adding more app endpoints.
- Create platform-focused API surface (ingestion, retrieval, context bundle) independent from training endpoints.
- Keep training flows as a consumer module that depends on platform APIs.
