import uuid
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False) # 'admin' or 'employee'
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reviews = relationship("UserReview", back_populates="user")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subtopics = relationship("Topic", backref="parent", remote_side=[id])
    chunks = relationship("KnowledgeChunk", back_populates="topic")

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=True)
    raw_text = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    embedding = Column(Vector(768), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    topic = relationship("Topic", back_populates="chunks")
    flashcards = relationship("Flashcard", back_populates="chunk")

class Flashcard(Base):
    __tablename__ = "flashcards"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_chunks.id"), nullable=False)
    generated_question = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chunk = relationship("KnowledgeChunk", back_populates="flashcards")
    reviews = relationship("UserReview", back_populates="flashcard")

class UserReview(Base):
    __tablename__ = "user_reviews"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    flashcard_id = Column(UUID(as_uuid=True), ForeignKey("flashcards.id"), primary_key=True)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    next_review_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    interval_days = Column(Integer, default=0, nullable=False)
    consecutive_passes = Column(Integer, default=0, nullable=False)
    ease_factor = Column(Float, default=2.5, nullable=False)

    user = relationship("User", back_populates="reviews")
    flashcard = relationship("Flashcard", back_populates="reviews")
