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
            "question": rv.flashcard.generated_question
        })
    return {"queue": queue}

@router.post("/evaluate")
def evaluate_answer(req: EvaluationRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    review = db.query(models.UserReview).filter_by(user_id=current_user.id, flashcard_id=req.flashcard_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review task not found for user")
        
    chunk = review.flashcard.chunk
    
    # Strict LLM Judge Prompt
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
        judge_raw = services.llama_generate(sys_prompt, user_prompt)
        start_idx = judge_raw.find("{")
        end_idx = judge_raw.rfind("}") + 1
        judge_json = json.loads(judge_raw[start_idx:end_idx])
        score = int(judge_json.get("score", 0))
        explanation = judge_json.get("explanation", "No explanation provided.")
    except Exception as e:
        print("LLM Judge fallback:", str(e))
        score = 0
        explanation = "Error parsing LLM evaluation. Defaulting to fail."

    # SRS Mathematical Engine (SuperMemo-2 Inspired)
    if score >= 1:
        # Pass
        review.consecutive_passes += 1
        review.ease_factor = max(1.3, review.ease_factor + 0.1)
        if review.consecutive_passes == 1:
            review.interval_days = 1
        else:
            review.interval_days = int(max(1, review.interval_days * review.ease_factor))
    else:
        # Fail
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
