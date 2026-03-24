# ShizenAI Roadmap

ShizenAI is a local-first semantic context manager and adaptive LLM routing layer.

This roadmap separates:

- Layer A: Core platform capabilities that should remain stable.
- Layer B: Application modules that consume the platform.

---

## Phase A - Foundation Cleanup and Platform Reframing

- [ ] Define and document platform vs application boundaries.
- [ ] Rewrite and align repo docs around semantic context management.
- [ ] Audit backend routes into: core platform, application layer, hackathon-only shortcuts.
- [ ] Isolate hackathon assumptions from the core architecture.
- [ ] Standardize platform naming: sources, chunks, embeddings, retrieval, routing, context bundles.
- [ ] Mark what is canonical vs legacy from historical phases.
- [ ] Keep this roadmap as the root source of truth.

## Phase B - Knowledge Model and Ingestion Hardening

- [ ] Formalize canonical entities: `knowledge_sources`, `source_versions`, `knowledge_chunks`, `chunk_summaries`, `chunk_embeddings`, `collections`, `tags`.
- [ ] Standardize chunk metadata schema and required provenance fields.
- [ ] Add embedding model/version metadata.
- [ ] Support safe re-ingestion and lineage-preserving updates.
- [ ] Improve text normalization and semantic chunking strategy.
- [ ] Define summary policy (raw only vs raw + summary).

## Phase C - Retrieval Quality and Context Packaging

- [ ] Tune retrieval thresholds and top-k defaults.
- [ ] Standardize similarity score handling.
- [ ] Add confidence bands: high, medium, low.
- [ ] Build context packaging (compact chunk bundles, grouped bundles, size-limited windows).
- [ ] Add optional reranking.
- [ ] Add query/result traceability.
- [ ] Define reusable context response format for downstream AI calls.

## Phase D - Decision Engine and Routing Core

- [ ] Create a centralized routing/decision module.
- [ ] Define routing inputs: semantic distance, confidence, query type, depth, latency budget, cost budget, provider availability.
- [ ] Define routing outputs: chosen path, reason, confidence, estimated cost/latency class.
- [ ] Implement first-pass policy:
  - [ ] direct retrieval for high-confidence hits
  - [ ] local synthesis for medium confidence
  - [ ] internal/external reasoning for low confidence or high complexity
- [ ] Log all routing decisions and outcomes.
- [ ] Add configurable routing policy and thresholds.

## Phase E - Multi-Provider Runtime Layer

- [ ] Define provider interfaces for generation, summarization, embeddings, and reranking.
- [ ] Implement adapters for local runtime, internal GPU service, and external providers.
- [ ] Separate embedding provider from generation provider concerns.
- [ ] Add provider capability metadata: context window, latency class, cost class, quality class.
- [ ] Make provider selection part of routing policy (not endpoint-specific logic).

## Phase F - Internal GPU / Private Inference Path

- [ ] Define internal inference service contract.
- [ ] Choose first deployment target (GCP or AWS).
- [ ] Define private networking model.
- [ ] Deploy private GPU-backed inference service.
- [ ] Add auth/service identity for internal calls.
- [ ] Add internal compute as a routing destination.
- [ ] Benchmark internal against local and external providers.

## Phase G - Cost, Latency, and Quality Controls

- [ ] Track provider latency over time.
- [ ] Track token/call costs where applicable.
- [ ] Store request and decision metrics.
- [ ] Add latency-aware routing constraints.
- [ ] Add cost-aware routing constraints.
- [ ] Add quality escalation behavior for difficult requests.
- [ ] Add fallback policy for provider degradation/outage.

## Phase H - Context Manager Product Layer

- [ ] Build UX for ingestion, source browsing, semantic retrieval, and context bundle assembly.
- [ ] Add save/use-as-context workflows.
- [ ] Add source collections (school, work, personal, projects).
- [ ] Add source/time contextual browsing views.
- [ ] Add bulk curation workflows.

## Phase I - Integrations and Agent Interop

- [ ] Design and expose a context export API.
- [ ] Add structured retrieval endpoints for external tools.
- [ ] Support reusable context packets.
- [ ] Explore MCP-compatible tool surface.
- [ ] Add secure local/internal service exposure for agent consumers.

## Phase J - Application Modules on Top

- [ ] Keep training/competency as a modular consumer.
- [ ] Add study/spaced-repetition module.
- [ ] Add research memory module.
- [ ] Add meeting/transcript assistant module.
- [ ] Add operational knowledge assistant module.

---

## Immediate Priority Sequence

1. Reframe architecture and docs around semantic context management.
2. Formalize reusable core data model for knowledge/context.
3. Build routing engine as a first-class module.
4. Separate platform vs application modules in code structure.
5. Design context bundle/export layer for downstream AI usage.

---

## Guardrails

- [ ] Do not keep adding app-layer features before routing core is solid.
- [ ] Do not re-implement provider integrations ad hoc.
- [ ] Do not use training schema as the default model for all features.
- [ ] Do not overbuild UI before context/routing engine coheres.
- [ ] Do not tie product identity to a single narrow use case.
