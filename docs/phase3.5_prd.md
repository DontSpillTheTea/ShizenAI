# PRD: ShizenAI Phase 3.5 – Automated Curation & Competency Tracking

## 1. Objective
To automate the conversion of static documents into verified knowledge assets and provide real-time, hierarchical visibility into employee competency. This phase replaces manual data entry with a One-Click Ingestion pipeline and introduces a Multi-User Assignment Matrix.

## 2. Employer Dashboard: Automated Curation
The Manager interface must move from "granular input" to "bulk oversight."

### 2.1 One-Click Ingestion Pipeline
- **Unified Upload:** A single "Drop Zone" supporting bulk uploads (`.pdf`, `.docx`, `.txt`).
- **Atomic Automation:** A single "Process" button that triggers:
  - **Semantic Chunking:** Breaking documents into logical 500-token nodes.
  - **Vectorization:** Generating 768-dim embeddings via `nomic-embed-text`.
  - **Flashcard Synthesis:** Llama 3 generates a contextually orthogonal question for every chunk automatically.
- **Success State:** Upon completion, the system returns a summary of "X Documents Processed, Y Flashcards Created."

### 2.2 Hierarchical Knowledge Management
- **The "Topic Tree":** A left-hand navigation rail featuring a nested, accordion-style dropdown.
- **Structure:** Category (e.g., Onboarding) -> Topic (e.g., Security) -> Sub-topic (e.g., ISO 27001).
- **Visual Indicators:** 
  - *Gray:* Not started/No data.
  - *Red:* Incomplete/Failed SRS review.
  - *Green:* Verified/Passed SRS review.

## 3. The Assignment Matrix (User Management)
Managers must be able to map specific knowledge nodes to specific humans.

### 3.1 User Selection & Logic
- **User Registry:** A selection screen to switch between different employees.
- **Stateful Persistence:** When a Manager selects "Employee A" and assigns "Topic: Docker," that relationship must be persisted in the `User_Assignments` table.
- **Context Switching:** Selecting "Employee B" must instantly refresh the Topic Tree to show only their unique progress and assigned tasks.

### 3.2 Assignment Workflow
1. Manager selects a User.
2. Manager toggles checkboxes on the Hierarchical Topic Tree.
3. Clicking "Assign" pushes all associated flashcards into that specific User's SRS queue.

## 4. Employee Experience: Verified Progress
The learner needs to see their "Path to Mastery" to reduce imposter syndrome.
- **Mirror View:** The Employee sees the same Hierarchical Topic Tree as the Manager.
- **The Feedback Loop:**
  - As the Employee passes a voice-verified flashcard, the corresponding node in the tree turns Green in real-time.
  - If an SRS review is missed or failed, the node reverts to Red, signaling a "Competency Leak."

## 5. Technical Requirements & Schema Updates

### 5.1 Updated Relational Logic
The database must now support many-to-many relationships between users and knowledge nodes.
- **Topics:** Needs `path` (ltree or materialized path) for deep nesting support.
- **Assignments:** `user_id`, `topic_id`, `assigned_at`.
- **Progress_Cache:** Stores pre-calculated `is_complete` status per user/topic to ensure the Tree UI is fast.

### 5.2 Frontend Performance
- **Recursive Components:** The React "Topic Tree" must be built using recursive components to handle infinite nesting without performance degradation.
- **Optimistic UI:** When a user passes a card, the sidebar should turn green before the API round-trip finishes to maintain "Flow State."

## 6. Success Metrics
- **Ingestion Speed:** A 10-page technical manual should be chunked, vectorized, and flashcarded in under 30 seconds on the local Ryzen 5.
- **UI Clarity:** A Manager can identify which employee is "failing" a specific compliance topic in under 3 clicks.
- **Integrity:** 100% synchronization between the Employee's completed cards and the Manager's checklist view.
