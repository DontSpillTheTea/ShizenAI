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
    # Fetch UserReviews where next_review_at <= today
    today = datetime.utcnow()
    reviews = db.query(models.UserReview).filter(
        models.UserReview.user_id == current_user.id,
        models.UserReview.next_review_at <= today
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
    
    # Cosine / L2 Distance Confidence Gate
    answer_embedding = services.generate_embedding(req.user_answer)
    distance = db.query(models.KnowledgeChunk.embedding.l2_distance(answer_embedding)).filter(models.KnowledgeChunk.id == chunk.id).scalar()
    
    if distance < 0.75:
        # Local LLM Judge for High-Confidence matches
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
            explanation = judge_json.get("explanation", "No explanation provided.")
        except Exception as e:
            print("LLM Judge fallback:", str(e))
            score = 0
            explanation = "Error parsing LLM evaluation. Defaulting to fail."
    else:
        # Off-topic / Weak Match -> Bounced to External API LLM
        score = 0
        prompt = f"The user tried to answer the question '{review.flashcard.generated_question}' with '{req.user_answer}'. Briefly explain the correct concept."
        external_context = services.mock_external_search(prompt)
        explanation = f"[External API LLM Call] Answer was structurally off-topic (Distance: {distance:.2f}). Web Context: {external_context}"

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
