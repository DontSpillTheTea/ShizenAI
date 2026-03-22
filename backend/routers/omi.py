import uuid
import json
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

import models, database, services, auth

router = APIRouter(prefix="/api/v1/integrations/omi", tags=["Omi Integration"])


# ── Request/Response Schemas ─────────────────────────────────────────────────

class WebhookTranscriptPayload(BaseModel):
    session_id: Optional[str] = None
    text: Optional[str] = None
    speaker_label: Optional[str] = None
    timestamp: Optional[str] = None

class ImportTextRequest(BaseModel):
    title: str
    text: str
    topic_path: Optional[str] = None

class FinalizeRequest(BaseModel):
    session_id: Optional[str] = None
    source_id: Optional[str] = None
    topic_path: Optional[str] = "Captured Informal Knowledge"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_topic_path(db: Session, path_string: str) -> models.Topic:
    """
    Parse a slash/arrow-delimited path like 'Engineering > Deployments > Rollback'
    and create nested topics if they don't exist.
    Returns the leaf Topic.
    """
    # Normalize separators
    parts = [p.strip() for p in path_string.replace(">", "/").split("/") if p.strip()]
    if not parts:
        parts = ["Captured Informal Knowledge"]

    parent_id = None
    parent_path = ""
    topic = None

    for part in parts:
        topic = db.query(models.Topic).filter_by(title=part, parent_id=parent_id).first()
        if not topic:
            topic = models.Topic(title=part, parent_id=parent_id)
            db.add(topic)
            db.flush()
            topic.path = f"{parent_path}/{str(topic.id)}" if parent_path else str(topic.id)
            db.flush()
        parent_id = topic.id
        parent_path = topic.path

    return topic


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/transcript")
async def receive_omi_transcript(request: Request, db: Session = Depends(database.get_db)):
    """
    Webhook endpoint for Omi Integration Apps (real-time transcript events).
    Accepts flexible payloads — stores raw chunk immediately and returns 200.
    No auth required so Omi can POST without user tokens.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    session_id = body.get("session_id") or body.get("uid") or str(uuid.uuid4())
    text = body.get("text") or body.get("transcript") or json.dumps(body)
    speaker = body.get("speaker_label") or body.get("speaker")

    capture = models.OmiCapture(
        session_id=session_id,
        speaker_label=speaker,
        raw_text=text,
    )
    db.add(capture)
    db.commit()
    return {"status": "ok"}


@router.post("/import-text")
def import_omi_text(
    req: ImportTextRequest,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin)
):
    """
    Manual fallback import: paste a transcript that came from Omi.
    Stores it as a KnowledgeSource immediately (no AI processing yet).
    Use /finalize to extract topics.
    """
    source = models.KnowledgeSource(
        origin="omi",
        source_type="informal",
        title=req.title,
        raw_content=req.text,
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    # Also store as an OmiCapture so /finalize can pick it up by source_id
    capture = models.OmiCapture(
        session_id=str(source.id),
        raw_text=req.text,
        source_label="omi-manual",
    )
    db.add(capture)
    db.commit()

    return {"status": "ok", "source_id": str(source.id)}


@router.post("/finalize")
def finalize_omi_import(
    req: FinalizeRequest,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin)
):
    """
    Extract topics from a session or source_id and create unchecked topics.
    This is the 'Finalize Import' demo button.
    """
    # Collect unprocessed captures for this session / source
    if req.source_id:
        captures = db.query(models.OmiCapture).filter_by(
            session_id=req.source_id, processed=False
        ).all()
        source = db.query(models.KnowledgeSource).filter_by(id=req.source_id).first()
    elif req.session_id:
        captures = db.query(models.OmiCapture).filter_by(
            session_id=req.session_id, processed=False
        ).all()
        source = None
    else:
        raise HTTPException(status_code=400, detail="Provide session_id or source_id")

    if not captures and not source:
        raise HTTPException(status_code=404, detail="No unprocessed captures found for that session")

    # Concatenate all raw text
    combined_text = "\n".join(c.raw_text for c in captures)
    if source and not combined_text:
        combined_text = source.raw_content

    # Create or reuse KnowledgeSource record
    if not source:
        source = models.KnowledgeSource(
            origin="omi",
            source_type="informal",
            title=req.session_id or "Omi conversation",
            session_id=req.session_id,
            raw_content=combined_text,
        )
        db.add(source)
        db.flush()

    # Run Perplexity extraction
    extracted = services.extract_topics_from_transcript(combined_text)

    topic_path = req.topic_path or "Captured Informal Knowledge"
    parent_topic = _get_or_create_topic_path(db, topic_path)

    created_topics = []
    for item in extracted:
        # Create leaf topic
        leaf = models.Topic(
            title=item["title"],
            parent_id=parent_topic.id,
            source_type="informal",
            source_id=source.id,
        )
        db.add(leaf)
        db.flush()
        leaf.path = f"{parent_topic.path}/{str(leaf.id)}"
        db.flush()

        # Create a KnowledgeChunk for embedding + flashcard generation
        summary = item.get("description") or item["title"]
        chunk_text = f"{item['title']}: {summary}"
        try:
            embedding = services.generate_embedding(chunk_text)
        except Exception:
            embedding = [0.0] * 768

        chunk = models.KnowledgeChunk(
            topic_id=leaf.id,
            raw_text=chunk_text,
            summary=summary,
            embedding=embedding,
        )
        db.add(chunk)
        db.flush()

        # Auto-generate flashcard
        question = services.generate_summary(
            f"Based on this knowledge topic, generate ONE clear flashcard question. Output only the question:\n\n{chunk_text}"
        )
        fc = models.Flashcard(chunk_id=chunk.id, generated_question=question.strip())
        db.add(fc)

        created_topics.append({
            "id": str(leaf.id),
            "title": leaf.title,
            "status": "unchecked",
            "source_type": "informal",
        })

    # Mark all captures as processed
    for cap in captures:
        cap.processed = True

    db.commit()

    return {
        "status": "ok",
        "source_id": str(source.id),
        "topics_created": created_topics,
        "message": f"Created {len(created_topics)} unchecked topic{'s' if len(created_topics) != 1 else ''} from informal knowledge. Newly captured informal knowledge remains unchecked until assigned and reviewed."
    }


@router.get("/captures")
def list_omi_captures(
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.get_current_admin)
):
    """List recent KnowledgeSource records for the manager UI."""
    sources = db.query(models.KnowledgeSource).order_by(
        models.KnowledgeSource.created_at.desc()
    ).limit(20).all()

    result = []
    for s in sources:
        topics = db.query(models.Topic).filter_by(source_id=s.id).all()
        result.append({
            "id": str(s.id),
            "title": s.title,
            "source_type": s.source_type,
            "origin": s.origin,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "topics_created_count": len(topics),
            "unchecked_count": len(topics),  # All newly created via Omi start unchecked
        })
    return result
