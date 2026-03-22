# Execution History: 005 - Phase 3 (Core Verification Engine)
**Date:** March 21, 2026
**Branch:** `phase-3-srs-loop`

## 1. Relational Database Migration
- Ripped out the flat `knowledge_records` table and dropped the public schema. 
- Integrated a complex relational topology: `Users`, `Topics`, `Knowledge_Chunks`, `Flashcards`, and the `User_Reviews` associative join table for spaced repetition tracking.

## 2. Authentication & Authorization
- Built `auth.py` native JWT pipeline using `python-jose` and `passlib[bcrypt]`.
- Enforced Role-Based Access Control (RBAC) via FastAPI Dependency Injection (`get_current_admin` vs `get_current_user`).

## 3. The Employer Pipeline (LangChain Ingestion)
- Expanded the ingestion route to natively accept `.pdf`, `.docx`, and `.txt` utilizing `PyMuPDF` and `python-docx`.
- Integrated `langchain-text-splitters.RecursiveCharacterTextSplitter` to automatically chop vast wikis into cohesive, context-respecting 750-character chunks.
- Wired local `llama3` to autonomously spin up a Flashcard Question testing the core mechanism of every chunk generated.

## 4. The Employee "SRS" Verification Loop
- Implemented the SuperMemo-2 mathematical decay function inside `routers/employee.py`. 
- Employees fetch a strictly "due today" queue.
- Passed user answers via the **LLM Judge** (`llama3`), which strictly enforces a raw JSON schema (`{ "score": 1|0, "explanation": "..." }`) mapped directly against Nomic-embedded N-Dimensional Ground Truth texts. 

## 5. React Dashboard Splits
- Bootstrapped `AuthContext.tsx` to handle the React router permissions cleanly across browser reloads.
- Built `<AdminDashboard/>`: Features topic construction, file uploading, and single-click Flashcard distribution.
- Built `<EmployeeDashboard/>`: A minimalist focus-driven "Daily Queue" UI where employees dictate answers using their native Web Speech microphone, receiving immediate Pass/Fail LLM evaluations.
