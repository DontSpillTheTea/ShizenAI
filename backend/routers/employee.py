from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from pydantic import BaseModel

import models, database, auth, services

router = APIRouter(prefix="/api/v1/employee", tags=["Employee"])

class EvaluationRequest(BaseModel):
    flashcard_id: str
    user_answer: str

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
    
    # Exact Match Fast-Path
    if req.user_answer.strip().lower() == chunk.raw_text.strip().lower():
        distance = 0.0
        score = 1
        explanation = f"[Exact Match] (Distance: {distance:.4f})\n\nGround Truth: {chunk.raw_text}"
    else:
        # Cosine / L2 Distance Confidence Gate
        answer_embedding = services.generate_embedding(req.user_answer)
        distance = db.query(models.KnowledgeChunk.embedding.l2_distance(answer_embedding)).filter(models.KnowledgeChunk.id == chunk.id).scalar()
        
        if distance < 0.65:
            score = 1
            explanation = f"[High Match] (Distance: {distance:.4f})\n\nGround Truth: {chunk.raw_text}"
        elif distance < 1.15:
            # Local LLM Judge for Medium-Confidence matches
            sys_prompt = "You are a strict technical evaluator. You must output ONLY RAW JSON format."
            user_prompt = f"""Compare the Employee's Answer to the Ground Truth text.
Does the answer correctly address the core concept of the Question based ONLY on the Ground Truth?

Ground Truth: {chunk.raw_text}
Question: {review.flashcard.generated_question}
Employee Answer: {req.user_answer}

You must respond ONLY with a strict JSON format exactly like this, nothing else:
{{
    "score": 1, 
    "explanation": "1-sentence explanation of what was right or missing."
}}
(Use score 1 for Pass, 0 for Fail)"""

            try:
                judge_raw = services.local_llm_generate(sys_prompt, user_prompt)
                start_idx = judge_raw.find("{")
                end_idx = judge_raw.rfind("}") + 1
                judge_json = json.loads(judge_raw[start_idx:end_idx])
                score = int(judge_json.get("score", 0))
                explanation = f"[Medium Match Judge] (Distance: {distance:.4f})\n{judge_json.get('explanation', 'No explanation provided.')}\n\nGround Truth: {chunk.raw_text}"
            except Exception as e:
                print("LLM Judge fallback:", str(e))
                score = 0
                explanation = f"[Medium Match Error] (Distance: {distance:.4f})\nError parsing LLM evaluation.\n\nGround Truth: {chunk.raw_text}"
        else:
            # Off-topic / Weak Match -> Bounced to External API LLM
            score = 0
            prompt = f"The user tried to answer the question '{review.flashcard.generated_question}' with '{req.user_answer}'. Briefly explain the correct concept."
            external_context = services.mock_external_search(prompt)
            explanation = f"[Low Match External] (Distance: {distance:.4f})\nContext: {external_context}\n\nGround Truth: {chunk.raw_text}"

    # Progress Cache Tracking
    topic_id = chunk.topic_id
    cache = db.query(models.ProgressCache).filter_by(user_id=current_user.id, topic_id=topic_id).first()
    if not cache:
        cache = models.ProgressCache(user_id=current_user.id, topic_id=topic_id, status="red")
        db.add(cache)

    # SRS Mathematical Engine (SuperMemo-2 Inspired)
    if score >= 1:
        # Pass
        cache.status = "green"
        review.consecutive_passes += 1
        review.ease_factor = max(1.3, review.ease_factor + 0.1)
        if review.consecutive_passes == 1:
            review.interval_days = 1
        else:
            review.interval_days = int(max(1, review.interval_days * review.ease_factor))
    else:
        # Fail
        cache.status = "red"
        review.consecutive_passes = 0
        review.ease_factor = max(1.3, review.ease_factor - 0.2)
        review.interval_days = 0 
        
    # Reschedule
    if review.interval_days == 0:
        review.next_review_at = datetime.utcnow() # Push back to today's queue
    else:
        review.next_review_at = datetime.utcnow() + timedelta(days=review.interval_days)
        
    review.last_reviewed_at = datetime.utcnow()
    db.commit()
    
    return {
        "score": score,
        "explanation": explanation,
        "next_review_in_days": review.interval_days
    }

@router.get("/topic/{topic_id}/cards")
def get_topic_cards(topic_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    flashcards = db.query(models.Flashcard).join(models.KnowledgeChunk).filter(models.KnowledgeChunk.topic_id == topic_id).all()
    return [{"id": str(fc.id), "question": fc.generated_question} for fc in flashcards]

@router.post("/skip/{flashcard_id}")
def skip_flashcard(flashcard_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    from datetime import datetime, timedelta
    review = db.query(models.UserReview).filter_by(user_id=current_user.id, flashcard_id=flashcard_id).first()
    if review:
        review.next_review_at = datetime.utcnow() + timedelta(days=1)
        db.commit()
    return {"status": "skipped"}
