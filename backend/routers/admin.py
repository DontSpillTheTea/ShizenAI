import fitz  # PyMuPDF
import docx
from fastapi import APIRouter, Depends, UploadFile, Form
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter

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
    topic = models.Topic(title=topic_title, parent_id=parent_topic_id)
    db.add(topic)
    db.flush() # get topic.id
    
    # 3. LangChain Semantic Chunking
    splitter = RecursiveCharacterTextSplitter(chunk_size=750, chunk_overlap=100)
    chunks = splitter.split_text(text)
    
    # 4. Embed and Store
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
        
    db.commit()
    return {"message": f"Successfully ingested {len(chunks)} chunks into topic '{topic_title}'", "topic_id": topic.id}

@router.post("/flashcards/generate/{topic_id}")
def generate_flashcards(topic_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    chunks = db.query(models.KnowledgeChunk).filter(models.KnowledgeChunk.topic_id == topic_id).all()
    created = 0
    for chunk in chunks:
        # Prompt Llama 3 to generate a flashcard question
        prompt = f"Based on this text, generate ONE single specific probing open-ended question that tests the core concept. Output ONLY the question text:\n\n{chunk.raw_text}"
        question = services.generate_summary(prompt) # Raw LLM call
        
        fc = models.Flashcard(chunk_id=chunk.id, generated_question=question.strip())
        db.add(fc)
        created += 1
    db.commit()
    return {"message": f"Generated {created} flashcards for topic"}

@router.get("/users")
def get_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    users = db.query(models.User).filter(models.User.role == "employee").all()
    return [{"id": str(u.id), "name": u.name} for u in users]

@router.post("/assign")
def assign_topic(topic_id: str, target_user_id: str, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.get_current_admin)):
    flashcards = db.query(models.Flashcard).join(models.KnowledgeChunk).filter(models.KnowledgeChunk.topic_id == topic_id).all()
    assigned = 0
    for fc in flashcards:
        existing = db.query(models.UserReview).filter_by(user_id=target_user_id, flashcard_id=fc.id).first()
        if not existing:
            review = models.UserReview(user_id=target_user_id, flashcard_id=fc.id)
            db.add(review)
            assigned += 1
    db.commit()
    return {"message": f"Assigned {assigned} flashcards to user"}
