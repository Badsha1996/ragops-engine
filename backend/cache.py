import json
from typing import Dict, Any, Tuple, Optional
import config
from vector_db import get_mock_embedding, get_real_embedding, compute_cosine_similarity

# Local fallback in-memory cache
# Format: {query_string: {"vector": List[float], "response": Dict[str, Any]}}
_local_cache = {}

# Initialize Upstash Redis client if configured
redis_client = None
if not config.is_demo_mode() and config.UPSTASH_REDIS_REST_URL and config.UPSTASH_REDIS_REST_TOKEN:
    try:
        from upstash_redis import Redis
        redis_client = Redis(url=config.UPSTASH_REDIS_REST_URL, token=config.UPSTASH_REDIS_REST_TOKEN)
        print("Successfully initialized Upstash Redis client.")
    except Exception as e:
        print(f"Error initializing Upstash Redis: {e}. Falling back to in-memory cache.")

def get_query_embedding(query: str) -> list[float]:
    """Get embedding for caching."""
    if config.is_demo_mode():
        return get_mock_embedding(query)
    return get_real_embedding(query)

def get_cached_query(query: str, threshold: float = 0.90) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Search the semantic cache for a similar query.
    Returns: (cached_response, similarity_score) if hit (similarity >= threshold), else (None, 0.0)
    """
    query_vector = get_query_embedding(query)
    
    # 1. Check Redis Cache
    if redis_client is not None:
        try:
            # We store the list of cache entries in a Redis hash named "ragops_semantic_cache"
            # Field: stringified query, Value: JSON string containing {"vector": [...], "response": {...}}
            cache_keys = redis_client.hkeys("ragops_semantic_cache")
            best_score = 0.0
            best_response = None
            
            for field in cache_keys:
                field_str = field if isinstance(field, str) else field.decode('utf-8')
                cache_data_str = redis_client.hget("ragops_semantic_cache", field_str)
                if not cache_data_str:
                    continue
                
                cache_data = json.loads(cache_data_str)
                cached_vector = cache_data.get("vector")
                
                if cached_vector:
                    similarity = compute_cosine_similarity(query_vector, cached_vector)
                    if similarity > best_score:
                        best_score = similarity
                        best_response = cache_data.get("response")
            
            if best_score >= threshold:
                return best_response, best_score
                
        except Exception as e:
            print(f"Error checking Upstash Redis semantic cache: {e}. Falling back to local cache.")
            
    # 2. Check Local Cache (Fallback/Demo Mode)
    best_score = 0.0
    best_response = None
    
    for cached_query, cache_data in _local_cache.items():
        cached_vector = cache_data["vector"]
        similarity = compute_cosine_similarity(query_vector, cached_vector)
        if similarity > best_score:
            best_score = similarity
            best_response = cache_data["response"]
            
    if best_score >= threshold:
        return best_response, best_score
        
    return None, 0.0

def set_cached_query(query: str, response: Dict[str, Any]):
    """Store a query and its RAG response in the semantic cache."""
    query_vector = get_query_embedding(query)
    cache_entry = {
        "vector": query_vector,
        "response": response
    }
    
    # 1. Save to Redis
    if redis_client is not None:
        try:
            redis_client.hset("ragops_semantic_cache", query, json.dumps(cache_entry))
            print(f"Stored query in Upstash Redis semantic cache: '{query}'")
        except Exception as e:
            print(f"Error writing to Upstash Redis: {e}. Writing to local cache instead.")
            
    # 2. Save to Local Cache (always save locally as well for fast access/fallback)
    _local_cache[query] = cache_entry
    print(f"Stored query in local semantic cache: '{query}'")

def clear_cache():
    """Clear both Redis and local caches."""
    global _local_cache
    _local_cache.clear()
    
    if redis_client is not None:
        try:
            redis_client.delete("ragops_semantic_cache")
            print("Cleared Upstash Redis semantic cache.")
        except Exception as e:
            print(f"Error clearing Upstash Redis: {e}")
            
    print("Semantic cache cleared.")
