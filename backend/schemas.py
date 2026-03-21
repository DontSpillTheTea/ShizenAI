from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

class IngestRequest(BaseModel):
    text: str = Field(..., description="Raw unstructured text to ingest")

class IngestResponse(BaseModel):
    status: str
    record_id: uuid.UUID
    summary: str

class RecordResponse(BaseModel):
    id: uuid.UUID
    summary: str
    created_at: datetime

class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    mode: str = "text"

class UnifiedQueryResponse(BaseModel):
    text: str
    source_origin: str
    similarity_score: Optional[float] = None
    audio_url: Optional[str] = None
