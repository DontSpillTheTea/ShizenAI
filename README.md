# ShizenAI

ShizenAI is a Local-First, semantic text-ingestion and RAG (Retrieval-Augmented Generation) MVP application. It allows users to ingest raw text, automatically summarize it using a Local LLM via Ollama, generate vector embeddings, and store/search the data semantically using PostgreSQL (`pgvector`).

## Prerequisites
- **Docker Engine / Docker Desktop:** Ensure you have virtualization enabled and Docker installed.
- **System Resources:** Since we run LLMs locally via Ollama, we heavily recommend allocating at least 8GB of RAM/VRAM to the Docker engine.
- **Git:** For version control.

## Setup & Spin up (From Scratch)

To spin up the entire application stack from scratch locally:

### 1. Clone the repository
```bash
git clone https://github.com/DontSpillTheTea/ShizenAI.git
cd ShizenAI
```

### 2. Start the Docker Stack
This will pull the required images, build the custom backend/frontend containers, and start the system in detached mode.
```bash
docker compose up --build -d
```

### 3. Initialize Local LLMs (First Run Only)
Ollama does not bundle the language models by default. You must pull the models into the running container before the API can function:
**Windows (PowerShell):**
```powershell
./init_ollama.ps1
```
**Mac/Linux:**
```bash
docker compose exec ollama ollama pull llama3
docker compose exec ollama ollama pull nomic-embed-text
```

### 4. Access the Application
- **Frontend (UI):** [http://localhost:5173](http://localhost:5173)
- **Backend (API Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Developer Workflow & Spin Down

To stop the application without destroying your database state or downloaded LLMs:

```bash
docker compose stop
```
*Use this when taking a break. You can safely run `docker compose start` to resume your working/live mode.*

To completely destroy the containers and networks, but **retain** persistent database volumes and Ollama models:
```bash
docker compose down
```

To **hard reset** everything (WARNING: DELETES YOUR DATABASE AND DOWNLOADED MODELS):
```bash
docker compose down -v
```

---

## Architectural Overview (Broad Terms)

The architecture is containerized and currently split into four primary services:

1. **Frontend (`shizenai-frontend`)**
   - React 18, Vite, and Tailwind CSS.
   - Provides views for Data Ingestion, an active Records Dashboard, and Semantic Search. Communicates strictly with the local backend over port 8000.
2. **Backend (`shizenai-backend`)**
   - Python FastAPI server handling the core business logic.
   - Converts raw ingested text into concise summaries using the `llama3` model, then converts the summary into a 768-dimensional vector embedding via the `nomic-embed-text` model.
   - Exposes RESTful wrappers to search and insert records.
3. **Database (`shizenai-postgres`)**
   - A PostgreSQL 15 database utilizing the `pgvector` extension.
   - Relational data (timestamps, summaries, text) is stored alongside semantic vectors. Distance functions (`<=>` cosine similarity) are executed natively within SQL queries.
4. **LLM Provider (`shizenai-ollama`)**
   - The local Ollama server running heavily quantised inferencing models.

*(Note: Detailed module intricacies will be fleshed out in subfolder-specific READMEs in the future).*

---

## Known Edge Cases & Limitations

- **State Persistence during Failure:** If the backend crashes while attempting to summarize or embed text, the SQLAlchemy transaction automatically rolls back. The text is not persisted to the relational database, nor is the vector inserted.
- **Data Latency within Models:** Since the inference generation relies entirely on local unoptimized Docker resources, large ingestion blocks may cause noticeable latency before it hits the database.
- **Embedding Portability Mismatch:** The current MVP strictly stores `768-dimensional` vectors specifically tailored to the `nomic-embed-text` output. Changing the underlying LLM provider in the future (e.g. to OpenAI `text-embedding-3-small`'s 1536 dims) will break the mathematical invariant of existing records without an explicit migration and re-embedding strategy.
