# 010 Phase 4 - Voice Trained Conversational Tutor

## Objective
Evolve the binary explicit SRS testing into an adaptive conversational assistant, injecting natural language voice streaming and continuous chat loops, while aggressively refining the document parsers to isolate ideas accurately.

## Key Changes

### 1. Conversational Tutor Loop (Perplexity Sonar)
- **Architecture Refactor**: Upgraded `backend/routers/employee.py` and `services.py` to handle full histories of chat messages instead of single binary string verifications.
- **Tutor Prompting**: Directed the LLM to grade strictly based on the isolated flashcard Question, rather than the broad surrounding text. If correct, the system implicitly auto-passes. If incorrect, the LLM takes a conversational, supportive tone in the first person using Perplexity capabilities.

### 2. ElevenLabs TTS Proxy
- **Secure Integration**: Mounted `elevenlabs_key.env` into the docker container safely ignoring it via `.gitignore`.
- **FastAPI Streaming**: Created `/api/v1/employee/tts` using Python `requests` (explicitly appended to `requirements.txt`) to securely bypass CORS constraints and stream native `audio/mpeg` buffers.
- **Markdown Filter**: Applied server-side regex strips (`re.sub(r'[*_#`>]', '', text)`) to ensure the text-to-speech synthesizer speaks cleanly without robotic asterisk dictation.

### 3. Walkie-Talkie Voice UX
- **Push-To-Talk Workflow**: Built an open-mic Spacebar listener in `EmployeeDashboard.tsx` hooking directly to React state APIs.
- **Programmatic Auto-Submit Hook**: Implemented a 600-millisecond unlatch timer. User dictation is automatically evaluated exactly half a second after lifting their finger off the spacebar.
- **Silent Passage**: Decoupled the audio driver from positive evaluation paths—only conversational corrections, chat loops, and follow-up answers are audibly narrated.

### 4. Precision Concept Chunks & Aesthetic Touches
- **Newline Delimitation**: Upgraded the `RecursiveCharacterTextSplitter` logic in `admin.py`. Text imported via PDF or DOCX is natively ripped apart line-by-line prior to fallback token bounds checking. Now, every specific hard-return line boundary becomes a uniquely generated index flashcard!
- **Topic UI Enhancement**: Redesigned the visual hierarchy of `TopicTree.tsx`. Deepened the contrast mapping points (using `text-gray-600` and `emerald-500`) and physically stripped away redundant `▶` dropdown icons to emphasize native text-hover interactivity.
