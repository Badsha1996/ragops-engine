import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

import config
import vector_db
import cache
import agent

app = FastAPI(title="Self-Optimizing Multi-Agent RAGOps Engine API")

# Configure CORS so the Next.js frontend can communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# *************** Pydantic Schemas ***************
class APIKeys(BaseModel):
    gemini: Optional[str] = ""
    openai: Optional[str] = ""
    groq: Optional[str] = ""
    upstash_url: Optional[str] = ""
    upstash_token: Optional[str] = ""
    # LangSmith Observability
    langchain_tracing: Optional[bool] = False
    langchain_api_key: Optional[str] = ""
    langchain_project: Optional[str] = "ragops-engine"

class QueryRequest(BaseModel):
    query: str
    demo_mode: Optional[bool] = None
    keys: Optional[APIKeys] = None
    # Advanced RAG Strategies Toggles
    hyde_enabled: Optional[bool] = False
    multi_query_enabled: Optional[bool] = False
    hybrid_search_enabled: Optional[bool] = True

class IngestRequest(BaseModel):
    id: str
    text: str
    title: Optional[str] = ""
    category: Optional[str] = "General"

# *************** Endpoints ***************
@app.get("/api/status")
async def get_status():
    """Returns the current backend status, configured keys, and Demo Mode status."""
    return {
        "demo_mode": config.DEMO_MODE,
        "keys_configured": {
            "gemini": bool(config.GEMINI_API_KEY),
            "openai": bool(config.OPENAI_API_KEY),
            "groq": bool(config.GROQ_API_KEY),
            "upstash": bool(config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN),
            "langsmith": bool(config.LANGCHAIN_API_KEY)
        }
    }

@app.post("/api/query")
async def process_query(req: QueryRequest):
    """Processes a user query through the RAGOps engine with dynamic strategic overrides."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    # Apply dynamic key overrides if supplied in the request
    if req.keys:
        if req.keys.gemini:
            config.GEMINI_API_KEY = req.keys.gemini
            os.environ["GEMINI_API_KEY"] = req.keys.gemini
        if req.keys.openai:
            config.OPENAI_API_KEY = req.keys.openai
            os.environ["OPENAI_API_KEY"] = req.keys.openai
        if req.keys.groq:
            config.GROQ_API_KEY = req.keys.groq
            os.environ["GROQ_API_KEY"] = req.keys.groq
            
        # Upstash Redis Cache credentials
        if req.keys.upstash_url and req.keys.upstash_token:
            config.UPSTASH_REDIS_REST_URL = req.keys.upstash_url
            config.UPSTASH_REDIS_REST_TOKEN = req.keys.upstash_token
            os.environ["UPSTASH_REDIS_REST_URL"] = req.keys.upstash_url
            os.environ["UPSTASH_REDIS_REST_TOKEN"] = req.keys.upstash_token
            
            # Re-initialize Redis client with new credentials
            try:
                from upstash_redis import Redis
                cache.redis_client = Redis(
                    url=config.UPSTASH_REDIS_REST_URL, 
                    token=config.UPSTASH_REDIS_REST_TOKEN
                )
            except Exception as e:
                print(f"Failed to re-initialize Redis: {e}")

        # LangSmith Cloud Tracing variables
        if req.keys.langchain_api_key:
            config.LANGCHAIN_API_KEY = req.keys.langchain_api_key
            config.LANGCHAIN_TRACING_V2 = True
            config.LANGCHAIN_PROJECT = req.keys.langchain_project or "ragops-engine"
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = req.keys.langchain_api_key
            os.environ["LANGCHAIN_PROJECT"] = config.LANGCHAIN_PROJECT

    # Set demo mode override if specified
    if req.demo_mode is not None:
        config.DEMO_MODE = req.demo_mode
    else:
        # If no keys are set, force demo mode
        if not config.GEMINI_API_KEY and not config.OPENAI_API_KEY and not config.GROQ_API_KEY:
            config.DEMO_MODE = True

    try:
        response = agent.run_ragops_engine(
            query=req.query,
            hyde_enabled=bool(req.hyde_enabled),
            multi_query_enabled=bool(req.multi_query_enabled),
            hybrid_search_enabled=bool(req.hybrid_search_enabled)
        )
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error executing engine: {str(e)}")

@app.post("/api/ingest")
async def ingest_document(req: IngestRequest):
    """Ingests a new text document into the vector database corpus using Hierarchical Retrieval."""
    if not req.id.strip() or not req.text.strip():
        raise HTTPException(status_code=400, detail="ID and text cannot be empty.")
        
    try:
        metadata = {
            "title": req.title or req.id.replace("_", " ").title(),
            "category": req.category or "General"
        }
        vector_db.add_document(req.id, req.text, metadata)
        return {"status": "success", "message": f"Document '{req.id}' successfully ingested."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ingesting document: {str(e)}")

@app.get("/api/documents")
async def get_documents():
    """Lists all documents stored in the vector database parent index."""
    docs = []
    for pid, doc in vector_db._parent_documents.items():
        docs.append({
            "id": doc["id"],
            "title": doc["metadata"].get("title", doc["id"]),
            "category": doc["metadata"].get("category", "General"),
            "text_preview": doc["text"][:150] + "..." if len(doc["text"]) > 150 else doc["text"]
        })
    return docs

@app.post("/api/clear-cache")
async def clear_cache():
    """Clears both local and Upstash Redis semantic cache databases."""
    try:
        cache.clear_cache()
        return {"status": "success", "message": "Cache successfully cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing cache: {str(e)}")

@app.post("/api/reset-corpus")
async def reset_corpus():
    """Resets the vector database back to the default parent-child corporate corpus."""
    try:
        vector_db.init_default_corpus()
        return {"status": "success", "message": "Vector DB reset to default corporate corpus."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting corpus: {str(e)}")

if __name__ == "__main__":
    import os
    import uvicorn
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
    
