from pydantic import BaseModel, Field
from typing import Optional,Any

class APIResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None

class IngestRequest(BaseModel):
    source_type: str = Field(..., description="'note' or 'url'")
    title: Optional[str] = Field(None, description="Optional title for text notes")
    content: Optional[str] = Field(None, description="Raw plain-text content")
    url: Optional[str] = Field(None, description="Target URL if source_type is 'url'")

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="User question for RAG lookup")