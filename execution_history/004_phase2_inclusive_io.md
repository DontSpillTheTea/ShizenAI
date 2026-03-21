# Execution History: 004 - Phase 2 (Hybrid Orchestration & Inclusive I/O)
**Date:** March 21, 2026
**Branch:** `phase-2-inclusive-io`

## 1. Objective Achieved
We successfully transformed the baseline MVP into a multimodal, confidence-routing chat architecture capable of serving diverse user needs while intelligently falling back to "simulated" external apis when local knowledge misses.

## 2. Backend Enhancements
- Modded the POST `/api/v1/search` to serve as a **Confidence Gateway**. 
- It checks native `pgvector` for similarity vectors. If `< 0.75`, it diverts the query to `mock_external_search()`, spinning up the local `llama3` with a specialized "Research Assistant" system prompt.
- Passed all response text through `mock_audio_synthesis()`, which enforces an artificial 1.5s `time.sleep()` delay and returns a mocked static endpoint `/api/v1/mock-audio` to satisfy frontend HTML5 Audio layers.
- Validated new responses emit structured Pydantic `UnifiedQueryResponse` matching the frontend expectations (including `source_origin` tags).

## 3. Frontend Inclusivity (Accessibility First)
- **Transcript Chat View:** Completely rewrote the `App.tsx` search tab from a static input/output list into a dual-bubble conversational UI.
- **Web Speech API ("Tap-to-Talk"):** Wired native browser microphone streams (`SpeechRecognition`) directly into the input bar. Since the parsing is browser-local, it adds zero latency/cost to the backend. It falls back gracefully to standard text entry.
- **Visual Cues:** Implemented semantic UI badging (`local_db` = Green, `external_search` = Blue) for maximum transparency on data lineage.

## 4. Stability Check
- Ensured Docker stats show the combined stack operates within the 12GB RAM limit on the Ryzen 5, natively throttling requests effectively.
