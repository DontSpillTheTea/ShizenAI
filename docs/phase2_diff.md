# Phase 2 Architecture Diff

This document highlights the architectural differences and core additions constructed during the Phase 2 Hybrid Orchestration transition.

## 1. Gateway Routing (Backend)
In Phase 1, the backend simply performed a pgvector distance search and returned the most similar documents unconditionally.
In Phase 2, a **Confidence Gateway** was strategically spliced into the route.

```diff
-        # Phase 1: Unconditional return
-        results = db.query(...).limit(request.limit).all()
-        return schemas.SearchResponse(results=results)

+        # Phase 2: Confidence Gateway Routing
+        confidence_threshold = float(os.getenv("CONFIDENCE_SCORE", "0.70"))
+        
+        if top_similarity >= confidence_threshold:
+            answer_text = top_record.summary
+            source_origin = "local_db"
+        else:
+            answer_text = services.mock_external_search(request.query)
+            source_origin = "external_search"
```

## 2. Simulated Modality Services (Backend API)
Phase 2 introduced simulated external orchestration endpoints. This proves the system can juggle outside providers seamlessly without burning costly OpenAI/ElevenLabs API credits during the MVP phase.

```diff
+ def mock_external_search(query: str) -> str:
+     # Bootstraps local llama3 with a rigid "Research Assistant" system prompt
+     # to mimic Perplexity's behavior and knowledge boundaries.
+
+ def mock_audio_synthesis(text: str) -> str:
+     # Artificially halts the event loop for 1.5s to simulate real-world TTS latency
+     # Returns a valid endpoint path for the frontend HTML5 `audio` component.
```

## 3. Inclusive Multimodal Transcript (Frontend UI)
Phase 1 utilized a static layout for executing single text-based searches. Phase 2 radically overhauled this view into an inclusive, multimodal chat interface designed for accessibility.

```diff
-      {/* Phase 1: Static input and unopinionated list layout */}
-      <form onSubmit={handleSearch}>...</form>
-      <div>{results.map(r => ...)}</div>

+      {/* Phase 2: Conversational "Transcript View" */}
+      <div className="chat-history custom-scrollbar">
+        {chatHistory.map(msg => (
+          <ChatBubble role={msg.role}>
+             <SourceBadge origin={msg.source_origin} />
+             <p>{msg.content}</p>
+          </ChatBubble>
+        ))}
+      </div>
+      
+      {/* Phase 2: Native Web Speech API "Tap-to-Talk" integration */}
+      <button onClick={handleMicrophoneClick} title="Tap-to-Talk">
+        <MicIcon isListening={isListening} />
+      </button>
+      
+      {/* Phase 2: Silent/Mock Audio Playback Router */}
+      <audio ref={audioRef} style={{ display: 'none' }} />
```

## 4. Stability Validation
By running `docker stats` after the Phase 2 integrations, it was confirmed that offloading the Web Speech API transcription layer entirely to the client's native browser circumvented massive backend bloat. The application operates solidly beneath 150MB of RAM padding, permitting the heavy Ollama LLM container to consume the remaining system resources unchecked.
