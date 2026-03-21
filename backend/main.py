from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import traceback
from database import get_db, engine, Base
import models
import schemas
import services

# For MVP, auto-create tables instead of using alembic right away to simplify startup.
# We will still set up alembic for future migrations if needed.
# Note: creating pgvector extension before creating tables
from sqlalchemy import text

app = FastAPI(title="ShizenAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)

@app.post("/api/v1/ingest", response_model=schemas.IngestResponse)
def ingest_text(request: schemas.IngestRequest, db: Session = Depends(get_db)):
    try:
        summary = services.generate_summary(request.text)
        embedding = services.generate_embedding(summary)
        
        record = models.KnowledgeRecord(
            raw_text=request.text,
            summary=summary,
            embedding=embedding
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        
        return schemas.IngestResponse(
            status="success",
            record_id=record.id,
            summary=record.summary
        )
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/records", response_model=list[schemas.RecordResponse])
def get_records(db: Session = Depends(get_db), limit: int = 50):
    records = db.query(models.KnowledgeRecord).order_by(models.KnowledgeRecord.created_at.desc()).limit(limit).all()
    return records

@app.post("/api/v1/search", response_model=schemas.UnifiedQueryResponse)
def search_records(request: schemas.SearchRequest, db: Session = Depends(get_db)):
    try:
        query_embedding = services.generate_embedding(request.query)
        
        # Cosine similarity search using pgvector
        results = db.query(
            models.KnowledgeRecord,
            models.KnowledgeRecord.embedding.cosine_distance(query_embedding).label("distance")
        ).order_by("distance").limit(request.limit).all()
        
        top_similarity = 0.0
        if results:
            top_record, distance = results[0]
            top_similarity = 1.0 - float(distance)
            
        # Confidence Gateway
        if top_similarity >= 0.75:
            answer_text = top_record.summary
            source_origin = "local_db"
            final_similarity = top_similarity
        else:
            answer_text = services.mock_external_search(request.query)
            source_origin = "external_search"
            final_similarity = top_similarity if results else None
            
        audio_url = services.mock_audio_synthesis(answer_text)
            
        return schemas.UnifiedQueryResponse(
            text=answer_text,
            source_origin=source_origin,
            similarity_score=final_similarity,
            audio_url=audio_url
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/mock-audio")
def get_mock_audio():
    # Return empty bytes that satisfy the browser audio player as a mock TTS return format
    return Response(content=b'', media_type="audio/mpeg")
