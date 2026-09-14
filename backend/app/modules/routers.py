from fastapi import APIRouter, HTTPException
import app.modules.schemas as schema
import app.modules.services as service
from app.modules.repository import get_all_sources
import logging
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/ingest", response_model=schema.APIResponse)
async def ingest_source(payload: schema.IngestRequest):
    if payload.source_type == "url" and not payload.url:
        raise HTTPException(
            status_code=400, 
            detail="Field 'url' is required when source_type is 'url'."
        )
    if payload.source_type == "note" and not payload.content :
        raise HTTPException(
            status_code=400, 
            detail="Field 'content' is required when source_type is 'note'."
        )
    if payload.source_type == "note" and not payload.title :
        raise HTTPException(
            status_code=400, 
            detail="Field 'title' is required when source_type is 'note'."
        )

    try:
        result = await service.save_data(payload)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to ingest source: {str(e)}"
        )

@router.get("/items", response_model=schema.APIResponse)
def get_saved_items():
    try:
        items = get_all_sources() 
        return {
            "status": "success",
            "code": 200,
            "message": "Retrieved saved items",
            "data": items,
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch saved items: {str(e)}"
        )

@router.post("/query", response_model=schema.APIResponse)
async def query_knowledge_base(payload: schema.QueryRequest):

    try:
        response = await service.question_response(payload.question)

        if response :
            return {
                "status": "success",
                "code": 200,
                "message": "Answer generated successfully",
                "data": {
                    "question": payload.question,
                    "answer":response.get('answer', 'No answer synthesized.'),
                    "source": response.get('source', [])
                },
                "error": None
            }
        return response

    except RateLimitError as e:
        logger.warning(f"Rate limit hit: {e}")
        raise HTTPException(status_code=429, detail=str(e)) from e

    except APITimeoutError as e:
        logger.error(f"Timeout: {e}")
        raise HTTPException(status_code=504, detail="AI service timed out.") from e

    except APIConnectionError as e:
        logger.error(f"Connection error: {e}")
        raise HTTPException(status_code=503, detail="AI service unavailable.") from e

    except APIStatusError as e:
        logger.error(f"Upstream status error: {e}")
        raise HTTPException(status_code=502, detail="AI service returned an error.") from e

    except RuntimeError as e:
        logger.error(f"Service error: {e}")
        raise HTTPException(status_code=503, detail=str(e)) from e


    except Exception as e:
        logger.exception("Unexpected RAG query failure")
        raise HTTPException(
            status_code=500, 
            detail=f"RAG query failed: {str(e)}"
        )