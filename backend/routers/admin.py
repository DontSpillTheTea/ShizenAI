import fitz  # PyMuPDF
import docx
from fastapi import APIRouter, Depends, UploadFile, Form
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter
import uuid

import models, database, auth, services

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

@router.post("/upload")
async def upload_document(
    file: UploadFile, 
    topic_title: str = Form(...), 
    parent_topic_id: str = Form(None), 
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(auth.get_current_admin)
):
    # 1. Parse File
    text = ""
    if file.filename.endswith(".pdf"):
        doc = fitz.open(stream=await file.read(), filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
    elif file.filename.endswith(".docx"):
        doc = docx.Document(file.file)
        text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    else:
        text = (await file.read()).decode("utf-8")
        
    # 2. Topic Management
    topic = db.query(models.Topic).filter_by(title=topic_title, parent_id=parent_topic_id).first()
    if not topic:
        topic = models.Topic(title=topic_title, parent_id=parent_topic_id)
        db.add(topic)
        db.flush() # get topic.id
        
        if parent_topic_id:
            parent = db.query(models.Topic).filter_by(id=parent_topic_id).first()
            topic.path = f"{parent.path}/{topic.id}" if parent and parent.path else str(topic.id)
        else:
            topic.path = str(topic.id)
        db.flush()
    
    # 3. LangChain Semantic Chunking
    splitter = RecursiveCharacterTextSplitter(chunk_size=750, chunk_overlap=100)
    chunks = splitter.split_text(text)
    
    # 4. Embed, Store, and Auto-Generate Flashcards
    created_flashcards = 0
    for chunk_text in chunks:
        summary = services.generate_summary(chunk_text)
        embedding = services.generate_embedding(summary)
        db_chunk = models.KnowledgeChunk(
            topic_id=topic.id,
            raw_text=chunk_text,
            summary=summary,
            embedding=embedding
        )
        db.add(db_chunk)
        db.flush() # get db_chunk.id
        
        # Auto-gen via atomic pipeline
        prompt = f"Based on this exact text, generate ONE highly specific flashcard question where the correct answer is literally the exact definition or core sentence from the text. Make it unambiguous. Output ONLY the question text:\n\n{chunk_text}"
        question = services.generate_summary(prompt)
        
        fc = models.Flashcard(chunk_id=db_chunk.id, generated_question=question.strip())
        db.add(fc)
        created_flashcards += 1
        
    db.commit()
    return {"message": f"Successfully ingested {len(chunks)} chunks and synthesized {created_flashcards} flashcards into topic '{topic_title}'", "topic_id": topic.id}

from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str

@router.post("/users")
def create_employee(req: UserCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    existing = db.query(models.User).filter_by(name=req.name).first()
    if existing:
        return {"id": str(existing.id), "name": existing.name}
    hashed_pw = auth.pwd_context.hash("password")
    new_user = models.User(name=req.name, role="employee", hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": str(new_user.id), "name": new_user.name}

@router.get("/users")
def get_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    users = db.query(models.User).filter(models.User.role == "employee").all()
    return [{"id": str(u.id), "name": u.name} for u in users]

@router.post("/assign")
def assign_topic(topic_id: str, target_user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    topic_uuid = uuid.UUID(topic_id)
    user_uuid = uuid.UUID(target_user_id)

    # 1. Create or Overwrite Assignment
    assignment = db.query(models.UserAssignment).filter_by(user_id=user_uuid, topic_id=topic_uuid).first()
    if not assignment:
        assignment = models.UserAssignment(user_id=user_uuid, topic_id=topic_uuid)
        db.add(assignment)
        
    # 2. Init Progress Cache
    cache = db.query(models.ProgressCache).filter_by(user_id=user_uuid, topic_id=topic_uuid).first()
    if not cache:
        cache = models.ProgressCache(user_id=user_uuid, topic_id=topic_uuid, status="red")
        db.add(cache)
    else:
        cache.status = "red"

    # 3. Seed SRS rows
    flashcards = db.query(models.Flashcard).join(models.KnowledgeChunk).filter(models.KnowledgeChunk.topic_id == topic_uuid).all()
    from sqlalchemy.sql import func
    assigned = 0
    for fc in flashcards:
        existing = db.query(models.UserReview).filter_by(user_id=user_uuid, flashcard_id=fc.id).first()
        if not existing:
            review = models.UserReview(user_id=user_uuid, flashcard_id=fc.id)
            db.add(review)
            assigned += 1
        else:
            existing.next_review_at = func.now()
            existing.interval_days = 0
            existing.consecutive_passes = 0
            assigned += 1
    db.commit()
    return {"message": f"Assigned {assigned} flashcards to user and tracked in matrix"}

@router.get("/hierarchy/topics")
def get_topic_hierarchy(user_id: str = None, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    # Simple hierarchy grab for admin view
    topics = db.query(models.Topic).all()
    payload = []
    for t in topics:
        status = "gray"
        if user_id:
            c = db.query(models.ProgressCache).filter_by(topic_id=t.id, user_id=user_id).first()
            if c:
                status = c.status
        payload.append({"id": str(t.id), "title": t.title, "path": t.path, "parent_id": str(t.parent_id) if t.parent_id else None, "status": status})
    return payload
