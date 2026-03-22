# PRD: ShizenAI Phase 3 – Core Verification Engine & SRS Loop
**Project:** ShizenAI (HackHayward 2026)
**Team:** Team Leek (Anthony Ma)
**Objective:** To finalize the local "Local-First" application loop by building the Semantic Ingestion Pipeline, the LLM Evaluation Engine, and the Spaced Repetition System (SRS). This phase guarantees the "Peace of Mind" value proposition by functionally proving employee competency before any cloud deployment.

## 1. User Roles & State Management
To enforce accountability and prevent cheating, the system must differentiate between the evaluator and the learner.

* **Authentication:** Implement basic JWT-based authentication in FastAPI and React.
* **Role-Based Access Control (RBAC):**
    * **Manager (Admin):** Can upload documents, curate topics, assign knowledge checklists, and view employee competency metrics.
    * **Employee (User):** Can view their daily assigned tasks, complete SRS flashcard reviews via voice/text, and view their own competency score.

## 2. Employer Core: The Ingestion & Curation Pipeline
Managers need a frictionless way to turn static company wikis into active training data.

* **Multi-Format Document Upload:** Frontend UI supporting `.pdf`, `.docx`, and `.txt` file ingestion.
* **Semantic Text Splitter:** The backend must chunk uploaded documents into logical, 500–1000 token segments using a library like LangChain's `RecursiveCharacterTextSplitter`. This prevents context-window overflow and ensures flashcard questions are bite-sized.
* **Vectorization & Storage:** Pass the chunks to the local Llama 3 model for summarization and the `nomic-embed-text` model for vectorization, storing the results in `pgvector`.
* **Topic Curation & Assignment:** Managers can group vectorized chunks into "Topics" (e.g., *DevOps -> CI/CD*) and assign these nested topics to specific employees, generating a pending task list.

## 3. Employee Core: The SRS Verification Loop
Employees need an active, daily review interface that proves their fluency.

* **The Daily Queue:** A frontend dashboard displaying flashcards due for review today, prioritized by the SRS algorithm.
* **Flashcard Generation:** For each assigned chunk, the backend dynamically generates a specific question probing the core concept of that text.
* **Multi-Modal Input:** The employee answers the question using the Web Speech API (Voice) or a text box (Fallback).
* **The LLM "Judge" Engine:** The FastAPI backend takes three inputs: (1) The Question, (2) The Ground-Truth Chunk from Postgres, and (3) The Employee's Answer. It prompts a strictly formatted Llama 3 instance to output a binary `1` (Pass) or `0` (Fail), alongside a 1-sentence explanation of what was missed.

## 4. The Spaced Repetition (SRS) Engine
The backend must mathematically track and schedule knowledge decay.

* **The Algorithm:** Implement a standard SRS algorithm (e.g., modified SuperMemo-2).
* **Execution Logic:**
    * If **Pass (`1`)**: Increase the interval multiplier (e.g., next review in 1 day $\rightarrow$ 3 days $\rightarrow$ 7 days). Check off the competency on the Manager Dashboard.
    * If **Fail (`0`)**: Reset the interval multiplier (next review pushed to the back of the current day's queue or tomorrow). Uncheck the competency on the Manager Dashboard.

## 5. Relational Data Model (PostgreSQL)
The database must be expanded to handle relational state alongside semantic vectors. The required schema includes:

* **`Users` Table:** `id`, `name`, `role`, `hashed_password`.
* **`Topics` Table:** `id`, `parent_id` (for nesting), `title`.
* **`Knowledge_Chunks` Table:** `id`, `topic_id`, `raw_text`, `embedding` (Vector 768).
* **`Flashcards` Table:** `id`, `chunk_id`, `generated_question`.
* **`User_Reviews` Table:** `user_id`, `flashcard_id`, `last_reviewed_at`, `next_review_at`, `interval_days`, `consecutive_passes`.

## 6. Success Metrics & Constraints
* **Performance:** The LLM Judge must evaluate the employee's answer and return the Pass/Fail state in under **3 seconds** locally.
* **Accuracy:** The Semantic Splitter must maintain complete sentences and logical paragraphs without cutting off mid-concept.
* **Infrastructure:** All components (Frontend, FastAPI, Postgres, Ollama) must continue to run stably within the 32GB RAM limit of the local Dockerized environment.
