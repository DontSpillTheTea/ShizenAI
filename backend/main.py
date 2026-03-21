from fastapi import FastAPI, Depends, HTTPException
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

@app.post("/api/v1/search", response_model=schemas.SearchResponse)
def search_records(request: schemas.SearchRequest, db: Session = Depends(get_db)):
    try:
        query_embedding = services.generate_embedding(request.query)
        
        # Cosine similarity search using pgvector
        results = db.query(
            models.KnowledgeRecord,
            models.KnowledgeRecord.embedding.cosine_distance(query_embedding).label("distance")
        ).order_by("distance").limit(request.limit).all()
        
        search_results = []
        for record, distance in results:
            # cosine_distance is 1 - cosine_similarity
            similarity_score = 1.0 - float(distance)
            search_results.append(schemas.SearchResultItem(
                id=record.id,
                summary=record.summary,
                similarity_score=similarity_score
            ))
            
        return schemas.SearchResponse(results=search_results)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
