from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from pydantic import BaseModel

import models, database, auth, services

router = APIRouter(prefix="/api/v1/employee", tags=["Employee"])

class ChatMessage(BaseModel):
    role: str
    content: str

class EvaluationRequest(BaseModel):
    flashcard_id: str
    messages: list[ChatMessage]

@router.get("/hierarchy/topics")
def get_topic_hierarchy(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Only return topics assigned to this user (they exist in ProgressCache)
    topics = db.query(models.Topic).join(models.ProgressCache).filter(models.ProgressCache.user_id == current_user.id).all()
    payload = []
    for t in topics:
        c = db.query(models.ProgressCache).filter_by(topic_id=t.id, user_id=current_user.id).first()
        status = c.status if c else "gray"
        payload.append({"id": str(t.id), "title": t.title, "path": t.path, "parent_id": str(t.parent_id) if t.parent_id else None, "status": status})
    return payload

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
def text_to_speech(req: TTSRequest):
    import os
    import requests
    from fastapi.responses import StreamingResponse
    from fastapi import HTTPException
    
    if not req.text:
        raise HTTPException(status_code=400, detail="No text provided")
        
    # Strip common markdown for clean TTS reading
    import re
    clean_text = re.sub(r'[*_#`>]', '', req.text)

    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="Missing ElevenLabs API Key")
        
    voice_id = "cjVigY5qzO86Huf0OWal" # Default clear male voice
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    payload = {
        "text": clean_text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
    }
    
    resp = requests.post(url, json=payload, headers=headers, stream=True)
    if not resp.ok:
        raise HTTPException(status_code=resp.status_code, detail="ElevenLabs API error")
        
    def generate():
        for chunk in resp.iter_content(chunk_size=4096):
            if chunk:
                yield chunk
                
    return StreamingResponse(generate(), media_type="audio/mpeg")

@router.get("/queue")
def get_daily_queue(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    from sqlalchemy import cast, Date
    today_date = datetime.utcnow().date()
    reviews = db.query(models.UserReview).filter(
        models.UserReview.user_id == current_user.id,
        cast(models.UserReview.next_review_at, Date) <= today_date
    ).all()
    
    queue = []
    for rv in reviews:
        queue.append({
            "flashcard_id": str(rv.flashcard_id),
            "question": rv.flashcard.generated_question,
            "_debug_answer": rv.flashcard.chunk.raw_text
        })
    return {"queue": queue}

@router.post("/evaluate")
def evaluate_answer(req: EvaluationRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    review = db.query(models.UserReview).filter_by(user_id=current_user.id, flashcard_id=req.flashcard_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review task not found for user")
        
    chunk = review.flashcard.chunk
    
    if len(req.messages) == 1:
        user_text = req.messages[0].content
        answer_embedding = services.generate_embedding(user_text)
        distance = db.query(models.KnowledgeChunk.embedding.l2_distance(answer_embedding)).filter(models.KnowledgeChunk.id == chunk.id).scalar()
        
        if distance < 0.65 and "?" not in user_text:
            score = 1
            has_question = False
            tutor_reply = f"[High Match] Correct!"
        else:
            model_tier = "sonar" if distance < 1.15 else "sonar-pro"
            sys_prompt = f"""You are a friendly, encouraging human Voice Training Assistant tutoring an employee.
Flashcard Question: {review.flashcard.generated_question}
Reference Context: {chunk.raw_text}

You MUST output your precision response strictly as a raw JSON object string:
{{"is_correct": true/false, "has_question": true/false, "response": "Your tutor reply."}}

1. If the user correctly answers the Flashcard Question, set is_correct=true (do not grade them on the entire Reference Context, only the precise Question matters).
2. If the user asks a follow-up question, set has_question=true.
3. In 'response', speak directly to the user in the first person. NEVER refer to "the user" in the third person. Keep your tone incredibly supportive and brief. Do NOT use any Markdown formatting, asterisks, or bold text.
Output ONLY the raw JSON string."""

            raw_resp = services.external_perplexity_chat(sys_prompt, [{"role": "user", "content": user_text}], model_name=model_tier)
            try:
                clean_json = raw_resp
                if "```json" in raw_resp: clean_json = raw_resp.split("```json")[1].split("```")[0]
                elif "```" in raw_resp: clean_json = raw_resp.split("```")[1].split("```")[0]
                
                parsed = json.loads(clean_json.strip())
                score = 1 if parsed.get("is_correct") else 0
                has_question = bool(parsed.get("has_question"))
                tutor_reply = parsed.get("response", "No response provided.")
            except Exception as e:
                score = 0
                has_question = False
                tutor_reply = f"Let's try that again. (Evaluation Error)"

        if score == 1:
            topic_id = chunk.topic_id
            cache = db.query(models.ProgressCache).filter_by(user_id=current_user.id, topic_id=topic_id).first()
            if not cache:
                cache = models.ProgressCache(user_id=current_user.id, topic_id=topic_id, status="green")
                db.add(cache)
            else:
                cache.status = "green"
                
            review.consecutive_passes += 1
            review.ease_factor = max(1.3, review.ease_factor + 0.1)
            review.interval_days = 1 if review.consecutive_passes == 1 else int(max(1, review.interval_days * review.ease_factor))
            review.next_review_at = datetime.utcnow() + timedelta(days=review.interval_days)
            review.last_reviewed_at = datetime.utcnow()
            db.commit()
            
            if not has_question: return {"status": "passed_auto", "explanation": tutor_reply}
            else: return {"status": "passed_chatting", "explanation": tutor_reply}
        else:
            return {"status": "failed_chatting", "explanation": tutor_reply}
            
    else:
        sys_prompt = f"You are a friendly, encouraging Voice Training Assistant. The Flashcard Question is: '{review.flashcard.generated_question}'\nReference Context: {chunk.raw_text}\nThe employee previously answered incorrectly and is chatting with you. Speak DIRECTLY to them, NEVER in the third person. Guide them toward the correct answer to the Question. Do NOT use Markdown, asterisks, or bold text, as your response will be read aloud."
        dict_messages = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = services.external_perplexity_chat(sys_prompt, dict_messages, model_name="sonar")
        return {"status": "chatting", "explanation": reply}

@router.get("/topic/{topic_id}/cards")
def get_topic_cards(topic_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    flashcards = db.query(models.Flashcard).join(models.KnowledgeChunk).filter(models.KnowledgeChunk.topic_id == topic_id).all()
    return [{"id": str(fc.id), "question": fc.generated_question} for fc in flashcards]

@router.post("/mark_wrong/{flashcard_id}")
def mark_wrong(flashcard_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    review = db.query(models.UserReview).filter_by(user_id=current_user.id, flashcard_id=flashcard_id).first()
    if review:
        topic_id = review.flashcard.chunk.topic_id
        cache = db.query(models.ProgressCache).filter_by(user_id=current_user.id, topic_id=topic_id).first()
        if cache: cache.status = "red"
        
        review.consecutive_passes = 0
        review.ease_factor = max(1.3, review.ease_factor - 0.2)
        review.interval_days = 0 
        review.next_review_at = datetime.utcnow()
        review.last_reviewed_at = datetime.utcnow()
        db.commit()
    return {"status": "skipped_and_failed"}
