import math
import hashlib
import re
import numpy as np
from typing import List, Dict, Any, Tuple
import config

# In-memory parent document store (stores the rich, complete documents)
# Format: {doc_id: {"id": str, "text": str, "metadata": dict}}
_parent_documents = {}

# In-memory child document store (stores small chunks for matching)
# Format: [{"id": str, "parent_id": str, "text": str, "vector": List[float]}]
_child_documents = []

def clean_text(text: str) -> List[str]:
    """Tokenizes and cleans text for lexical sparse search."""
    # Remove punctuation and split by whitespace
    clean = re.sub(r'[^\w\s]', ' ', text.lower())
    return [word for word in clean.split() if len(word) > 1]

def compute_cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

def get_mock_embedding(text: str) -> List[float]:
    """Deterministic mock embedding generator (128-dim)."""
    dim = 128
    vector = np.zeros(dim)
    tokens = clean_text(text)
    
    if not tokens:
        return [0.0] * dim
        
    for token in tokens:
        hasher = hashlib.md5(token.encode('utf-8'))
        seed = int(hasher.hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        token_vector = rng.normal(0, 1, dim)
        vector += token_vector
        
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
        
    return vector.tolist()

def get_real_embedding(text: str) -> List[float]:
    """Fetches embedding vector from Gemini or OpenAI APIs."""
    if config.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=config.GEMINI_API_KEY)
            response = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return response['embedding']
        except Exception as e:
            print(f"Error fetching Gemini embedding: {e}")
            
    if config.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=config.OPENAI_API_KEY)
            response = client.embeddings.create(
                input=[text],
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error fetching OpenAI embedding: {e}")
            
    return get_mock_embedding(text)

# --- Hierarchical Chunking ---

def chunk_document(text: str, chunk_size: int = 150) -> List[str]:
    """Splits a parent text into small child chunks of approximately chunk_size characters."""
    # Split by sentences first to be clean
    sentences = re.split(r'(?<=[.?!])\s+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += (" " if current_chunk else "") + sentence
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence
            
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks

def add_document(doc_id: str, text: str, metadata: Dict[str, Any] = None):
    """
    Ingests a document using Hierarchical Retrieval:
    1. Stores the full document in the parent store.
    2. Chunks the document into small child snippets.
    3. Computes vector embeddings for the child snippets.
    """
    global _parent_documents, _child_documents
    
    metadata = metadata or {}
    
    # Store Parent
    _parent_documents[doc_id] = {
        "id": doc_id,
        "text": text,
        "metadata": metadata
    }
    
    # Remove existing children of this parent (to allow updating)
    _child_documents = [child for child in _child_documents if child["parent_id"] != doc_id]
    
    # Chunk and Store Children
    child_snippets = chunk_document(text)
    for idx, snippet in enumerate(child_snippets):
        child_id = f"{doc_id}_child_{idx}"
        vector = get_mock_embedding(snippet) if config.is_demo_mode() else get_real_embedding(snippet)
        
        _child_documents.append({
            "id": child_id,
            "parent_id": doc_id,
            "text": snippet,
            "vector": vector
        })
        
    print(f"Hierarchical Indexing: Added parent doc '{doc_id}' with {len(child_snippets)} child chunks.")

# --- Sparse BM25 Search Algorithm ---

def compute_bm25_scores(query: str) -> Dict[str, float]:
    """
    Computes BM25 lexical keyword scores for all child chunks.
    Formula: score(D, Q) = sum( IDF(qi) * (tf(qi, D) * (k1 + 1)) / (tf(qi, D) + k1 * (1 - b + b * (|D| / avgdl))) )
    """
    query_tokens = clean_text(query)
    scores = {child["id"]: 0.0 for child in _child_documents}
    
    if not query_tokens or not _child_documents:
        return scores
        
    # Calculate corpus parameters
    doc_lengths = {child["id"]: len(clean_text(child["text"])) for child in _child_documents}
    avgdl = sum(doc_lengths.values()) / len(_child_documents)
    
    k1 = 1.5
    b = 0.75
    
    # Calculate Document Frequency (df) for each token
    df = {}
    for token in query_tokens:
        df[token] = sum(1 for child in _child_documents if token in clean_text(child["text"]))
        
    # Compute BM25 scores
    num_docs = len(_child_documents)
    for token in query_tokens:
        if df.get(token, 0) == 0:
            continue
            
        # Inverse Document Frequency (IDF)
        idf = math.log((num_docs - df[token] + 0.5) / (df[token] + 0.5) + 1.0)
        
        for child in _child_documents:
            child_tokens = clean_text(child["text"])
            tf = child_tokens.count(token)
            
            if tf > 0:
                doc_len = doc_lengths[child["id"]]
                denominator = tf + k1 * (1.0 - b + b * (doc_len / avgdl))
                scores[child["id"]] += idf * (tf * (k1 + 1.0)) / denominator
                
    return scores

# --- Hybrid Search with RRF ---

def hybrid_search_rrf(query: str, top_k: int = 3, rrf_k: int = 60) -> List[Dict[str, Any]]:
    """
    Advanced Hybrid Search:
    1. Computes Dense Vector Search ranks.
    2. Computes Sparse BM25 Search ranks.
    3. Fuses rankings using Reciprocal Rank Fusion (RRF).
    4. Retrieves parent documents associated with top-ranking child snippets.
    Returns: list of parent documents with relevance details.
    """
    if not _child_documents:
        return []
        
    # 1. Run Dense Search
    query_vector = get_mock_embedding(query) if config.is_demo_mode() else get_real_embedding(query)
    dense_results = []
    for child in _child_documents:
        score = compute_cosine_similarity(query_vector, child["vector"])
        dense_results.append((child["id"], score))
        
    # Sort dense results to get rank
    dense_results.sort(key=lambda x: x[1], reverse=True)
    dense_ranks = {item[0]: idx + 1 for idx, item in enumerate(dense_results)}
    
    # 2. Run Sparse Search (BM25)
    sparse_scores = compute_bm25_scores(query)
    sparse_results = list(sparse_scores.items())
    
    # Sort sparse results to get rank
    sparse_results.sort(key=lambda x: x[1], reverse=True)
    sparse_ranks = {item[0]: idx + 1 for idx, item in enumerate(sparse_results)}
    
    # 3. Apply Reciprocal Rank Fusion (RRF)
    rrf_scores = {}
    for child in _child_documents:
        cid = child["id"]
        dense_rank = dense_ranks.get(cid, 9999)
        sparse_rank = sparse_ranks.get(cid, 9999)
        
        # RRF formula
        score = (1.0 / (rrf_k + dense_rank)) + (1.0 / (rrf_k + sparse_rank))
        rrf_scores[cid] = score
        
    # Sort children by RRF score descending
    sorted_children = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    # 4. Map to Parent Documents (with deduplication)
    retrieved_parents = []
    seen_parent_ids = set()
    
    # Gather top matching parents
    for child_id, rrf_score in sorted_children:
        # Find child object
        child_obj = next(child for child in _child_documents if child["id"] == child_id)
        parent_id = child_obj["parent_id"]
        
        if parent_id not in seen_parent_ids:
            seen_parent_ids.add(parent_id)
            parent_doc = _parent_documents[parent_id]
            
            retrieved_parents.append({
                "id": parent_id,
                "text": parent_doc["text"],
                "metadata": parent_doc["metadata"],
                "rrf_score": rrf_score,
                "child_match_snippet": child_obj["text"]
            })
            
            if len(retrieved_parents) >= top_k:
                break
                
    return retrieved_parents

# Wrapper search matching the prior signature
def search(query: str, top_k: int = 2) -> List[Dict[str, Any]]:
    """Standard search wrapper executing our advanced hybrid RRF search."""
    results = hybrid_search_rrf(query, top_k=top_k)
    # Map RRF output to match prior score output key
    for r in results:
        r["score"] = r["rrf_score"]
    return results

def clear_db():
    """Clears corpus databases."""
    global _parent_documents, _child_documents
    _parent_documents.clear()
    _child_documents.clear()

# Reset and seed defaults
def init_default_corpus():
    clear_db()
    
    add_document(
        "vacation_policy",
        "Corporate Vacation Policy: All full-time employees receive 25 days of paid time off (PTO) annually. "
        "PTO requests must be submitted through the HR Portal at least two weeks in advance. "
        "Up to 5 unused PTO days can be rolled over to the next calendar year, but they must be used by March 31st "
        "of that year or they will be forfeited. Region-specific holidays are granted in addition to this standard PTO.",
        {"title": "Vacation Policy", "category": "HR"}
    )
    
    add_document(
        "travel_policy",
        "Business Travel and Expense Guidelines: Employees traveling on company business must book flights and accommodation "
        "through the corporate travel agency, Navan. Meals are reimbursed up to $75 per day, and itemized receipts are required "
        "for any single expense exceeding $25. Alcohol is not reimbursable unless part of an pre-approved client entertainment event.",
        {"title": "Travel Policy", "category": "Finance"}
    )
    
    add_document(
        "parental_leave",
        "Parental Leave Benefits: We offer 16 weeks of fully paid parental leave for primary caregivers and 8 weeks for secondary "
        "caregivers. This policy applies to birth, adoption, or foster placement of a child. Parental leave must be taken within "
        "one year of the birth or placement, and can be split into a maximum of two separate blocks of time.",
        {"title": "Parental Leave Benefits", "category": "HR"}
    )
    
    add_document(
        "wfh_policy",
        "Work From Home (WFH) Guidelines: Employees are expected to work from the office on Tuesdays, Wednesdays, and Thursdays. "
        "Mondays and Fridays are flexible work-from-home days. A one-time stipend of $300 is provided to help set up a home office. "
        "Core collaboration hours are 10:00 AM to 4:00 PM in the employee's local timezone.",
        {"title": "WFH Guidelines", "category": "Operations"}
    )

init_default_corpus()
