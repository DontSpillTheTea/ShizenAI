from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from database import Base
from pgvector.sqlalchemy import Vector

class KnowledgeRecord(Base):
    __tablename__ = "knowledge_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    raw_text = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    # Using 1536 as default size, will adapt based on model used (Nomic is 768 or OpenAI is 1536)
    # Assuming standard OpenAI text-embedding-ada-002 or text-embedding-3-small (1536) 
    # Or Nomic output. Let's use 768 for Nomic if used strictly locally, but let's leave flexible or use 1536 as PRD requested.
    embedding = Column(Vector(1536), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
