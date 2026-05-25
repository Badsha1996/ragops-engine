import time
from typing import Dict, Any, List, TypedDict, Literal
from langgraph.graph import StateGraph, START, END
import config
import vector_db
import evaluator
import cache

# Define the updated state schema for our multi-agent system
class AgentState(TypedDict):
    query: str                       # Original user query
    current_query: str               # Active query being searched (could be HyDE doc)
    sub_queries: List[str]           # Sub-queries generated in Multi-Query mode
    context: List[str]               # Retrieved parent documents
    response: str                    # Generated response
    eval_results: Dict[str, Any]      # Critic agent evaluation results
    model_used: str                  # Name of active LLM model
    route_decision: str              # "cheap" or "expensive"
    retry_count: int                 # Self-correction loop count
    logs: List[str]                  # Chronological execution traces
    cost: float                      # Estimated API cost
    latencies: Dict[str, float]      # Duration of each node
    # Toggles passed from settings
    hyde_enabled: bool
    multi_query_enabled: bool
    hybrid_search_enabled: bool

# --- Query Transformation Helpers ---

def call_llm(prompt: str, expensive: bool = False) -> str:
    """Invokes LLM (Gemini/OpenAI) depending on availability."""
    if config.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=config.GEMINI_API_KEY)
            model_name = "gemini-1.5-pro" if expensive else "gemini-2.0-flash"
            model = genai.GenerativeModel(model_name)
            return model.generate_content(prompt).text.strip()
        except Exception as e:
            print(f"Gemini error in agent helpers: {e}")
            
    if config.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=config.OPENAI_API_KEY)
            model_name = "gpt-4o" if expensive else "gpt-4o-mini"
            response = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model_name,
                temperature=0.0
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI error in agent helpers: {e}")
            
    return ""

def run_hyde_transformation(query: str) -> str:
    """Ask LLM to write a hypothetical fact-filled passage answering the query."""
    prompt = f"""
Write a brief, hypothetical, and factual-sounding paragraph answering this query.
Do NOT say 'Here is an answer' or preface it. Write it as if it were a snippet from an official corporate policy manual.
Query: "{query}"
Passage:
"""
    if config.is_demo_mode():
        # Simulated HyDE answers
        query_lower = query.lower()
        if "vacation" in query_lower:
            return "Vacation guidelines specify that full-time workers receive 25 days of annual PTO. Unused PTO up to 5 days can carry over."
        if "wfh" in query_lower or "remote" in query_lower:
            return "Our hybrid workplace policy allows work from home on Mondays and Fridays. A stipend of $300 is provided."
        return f"This document outlines corporate regulations and guidelines regarding {query}."
        
    hyde_doc = call_llm(prompt, expensive=False)
    return hyde_doc if hyde_doc else query

def run_multi_query_generation(query: str) -> List[str]:
    """Break query down into 3 sub-questions to cover all perspectives."""
    prompt = f"""
You are an AI assistant. Generate exactly 3 distinct search queries to retrieve relevant documents for: "{query}"
Your sub-questions should analyze different facets of the main question.
Output each query on a new line. Do NOT prefix with numbers.
Queries:
"""
    if config.is_demo_mode():
        return [
            f"corporate rules for {query}",
            f"stipends and reimbursement regarding {query}",
            f"HR guidelines about {query}"
        ]
        
    response = call_llm(prompt, expensive=False)
    if response:
        queries = [q.strip() for q in response.split("\n") if q.strip()]
        return queries[:3]
    return [query]

# --- Node Handlers ---

def router_node(state: AgentState) -> Dict[str, Any]:
    """Orchestrator Router: Determines query complexity and logs state parameters."""
    start_time = time.time()
    query = state["query"]
    logs = list(state.get("logs", []))
    
    logs.append(f"[Start] Received user query: '{query}'")
    
    # Classification decision
    decision = "cheap"
    if config.is_demo_mode():
        query_lower = query.lower()
        if "compare" in query_lower or "vs" in query_lower or "difference" in query_lower or len(query.split()) > 15:
            decision = "expensive"
    else:
        classifier_prompt = f"Analyze if this query requires simple retrieval (Simple) or complex analysis (Complex): '{query}'. Output ONLY the word 'Simple' or 'Complex'."
        resp = call_llm(classifier_prompt, expensive=False).lower()
        if "complex" in resp:
            decision = "expensive"
            
    logs.append(f"[Router] Complexity classified as: {decision.upper()} -> Routed to {decision.upper()} model.")
    return {
        "route_decision": decision,
        "logs": logs,
        "latencies": {"router": round((time.time() - start_time) * 1000, 2)}
    }

def query_transform_node(state: AgentState) -> Dict[str, Any]:
    """Transforms raw user query using HyDE or Multi-Query models."""
    start_time = time.time()
    query = state["query"]
    logs = list(state["logs"])
    
    current_query = query
    sub_queries = []
    
    # 1. HyDE
    if state.get("hyde_enabled"):
        logs.append("[HyDE] Generating Hypothetical Document Embedding...")
        hyde_doc = run_hyde_transformation(query)
        current_query = hyde_doc
        logs.append(f"[HyDE] Created hypothetical document: '{hyde_doc[:90]}...'")
        
    # 2. Multi-Query
    if state.get("multi_query_enabled"):
        logs.append("[Multi-Query] Splitting main query into sub-questions...")
        sub_queries = run_multi_query_generation(query)
        for i, sq in enumerate(sub_queries):
            logs.append(f" - Sub-Query {i+1}: '{sq}'")
            
    return {
        "current_query": current_query,
        "sub_queries": sub_queries,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "transformer": round((time.time() - start_time) * 1000, 2)}
    }

def retrieve_node(state: AgentState) -> Dict[str, Any]:
    """Retrieves document context from the upgraded hybrid BM25/Vector DB."""
    start_time = time.time()
    current_query = state["current_query"]
    sub_queries = state["sub_queries"]
    retry_count = state["retry_count"]
    logs = list(state["logs"])
    
    top_k = 4 if retry_count > 0 else 2
    
    # Check if we should execute Multi-Query retrieval
    if state.get("multi_query_enabled") and sub_queries:
        logs.append(f"[Retriever] Performing Multi-Query Hybrid Search (Top-{top_k} RRF re-ranked parents for 3 queries)...")
        all_results = []
        seen_ids = set()
        
        # Search for each sub-query
        for sq in sub_queries:
            results = vector_db.hybrid_search_rrf(sq, top_k=top_k)
            for r in results:
                if r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    all_results.append(r)
                    
        # Sort combined parents by score
        all_results.sort(key=lambda x: x["rrf_score"], reverse=True)
        results = all_results[:top_k]
    else:
        logs.append(f"[Retriever] Querying Vector Database using Hybrid Dense + BM25 Sparse Search (RRF top-{top_k})...")
        results = vector_db.hybrid_search_rrf(current_query, top_k=top_k)
        
    context = [r["text"] for r in results]
    for r in results:
        logs.append(f" - Retrieved parent doc '{r['id']}' | Matching child snippet: \"{r['child_match_snippet'][:60]}...\"")
        
    return {
        "context": context,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "retriever": round((time.time() - start_time) * 1000, 2)}
    }

def cheap_agent_node(state: AgentState) -> Dict[str, Any]:
    """Fast model generation node."""
    start_time = time.time()
    query = state["query"]
    context = state["context"]
    logs = list(state["logs"])
    
    logs.append("[Generation] Invoking Cheap Agent (Llama 3 8B / Gemini Flash)...")
    
    if config.is_demo_mode():
        # Simulated responses
        query_lower = query.lower()
        if "vacation" in query_lower or "pto" in query_lower:
            response = "All full-time employees receive 25 days of paid time off (PTO) annually. Requests must be submitted at least 2 weeks in advance."
        elif "parental" in query_lower or "leave" in query_lower:
            response = "We offer 16 weeks of fully paid parental leave for primary caregivers and 8 weeks for secondary caregivers."
        elif "wfh" in query_lower or "remote" in query_lower or "home" in query_lower:
            response = "Employees work from home on Mondays and Fridays. A stipend of $300 is provided."
            if "stipend" in query_lower and ("health" in query_lower or "medical" in query_lower):
                # Hallucination trigger
                response += " Also, there is a $50/month medical wellness reimbursement stipend."
        else:
            response = "We couldn't find details matching your query in standard corporate policies."
        time.sleep(0.8)
        cost = 0.00015
        model_used = "Llama-3-8b (Groq)"
    else:
        response = get_cheap_llm_response(query, context)
        cost = 0.0002
        model_used = "Llama-3-8B (Groq)" if config.GROQ_API_KEY else "Gemini-2.0-Flash"
        
    logs.append(f"[Generation] Completed using {model_used}.")
    return {
        "response": response,
        "model_used": model_used,
        "cost": state.get("cost", 0) + cost,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "generator": round((time.time() - start_time) * 1000, 2)}
    }

def get_cheap_llm_response(query: str, context: List[str]) -> str:
    context_str = "\n\n".join(context)
    prompt = f"Context:\n{context_str}\n\nQuestion: {query}\n\nAnswer based only on the context. If not mentioned, state that you don't know."
    return call_llm(prompt, expensive=False)

def expensive_agent_node(state: AgentState) -> Dict[str, Any]:
    """Premium reasoning model generation node."""
    start_time = time.time()
    query = state["query"]
    context = state["context"]
    logs = list(state["logs"])
    
    logs.append("[Generation] Invoking Expensive Agent (GPT-4o / Gemini Pro)...")
    
    if config.is_demo_mode():
        # High quality responses
        query_lower = query.lower()
        if "stipend" in query_lower and ("health" in query_lower or "medical" in query_lower):
            response = (
                "The corporate guidelines detail a one-time stipend of $300 to help set up a home office. "
                "However, there is no policy or documentation describing a monthly health, medical, or wellness stipend."
            )
        elif "vacation" in query_lower or "pto" in query_lower:
            response = (
                "Our corporate vacation guidelines allocate 25 days of paid time off (PTO) annually. "
                "Requests must be submitted in the HR Portal 2 weeks in advance. Up to 5 unused days "
                "can roll over to the next year, but they must be used by March 31st of that year or be forfeited."
            )
        else:
            response = "Based on official corporate documents, I could not find information to support this request."
        time.sleep(1.8)
        cost = 0.005
        model_used = "GPT-4o (OpenAI)"
    else:
        response = get_expensive_llm_response(query, context)
        cost = 0.010
        model_used = "GPT-4o (OpenAI)" if config.OPENAI_API_KEY else "Gemini-1.5-Pro"
        
    logs.append(f"[Generation] Completed using {model_used}.")
    return {
        "response": response,
        "model_used": model_used,
        "cost": state.get("cost", 0) + cost,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "generator": round((time.time() - start_time) * 1000, 2)}
    }

def get_expensive_llm_response(query: str, context: List[str]) -> str:
    context_str = "\n\n".join(context)
    prompt = f"Context:\n{context_str}\n\nQuestion: {query}\n\nWrite a highly accurate response based on context. If information is missing, report the lack of information clearly."
    return call_llm(prompt, expensive=True)

def critic_grader_node(state: AgentState) -> Dict[str, Any]:
    """Critic Agent Grader: Audits the generated answer against retrieved parent contexts."""
    start_time = time.time()
    query = state["query"]
    context = state["context"]
    response = state["response"]
    logs = list(state["logs"])
    
    logs.append("[Critic Grader] Auditing response for hallucinations and policy grounding...")
    
    eval_results = evaluator.evaluate_response(query, context, response)
    
    faith = eval_results.get("faithfulness", 1.0)
    relevance = eval_results.get("relevance", 1.0)
    justification = eval_results.get("justification", "")
    
    logs.append(f"[Critic Grader] Audit complete | Groundedness score: {faith:.2f} (Threshold: 0.80)")
    logs.append(f"[Critic Grader] Relevance score: {relevance:.2f}")
    logs.append(f"[Critic Grader] Justification: {justification}")
    
    eval_cost = 0.00015 if config.is_demo_mode() else 0.0003
    
    return {
        "eval_results": eval_results,
        "cost": state.get("cost", 0) + eval_cost,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "evaluator": round((time.time() - start_time) * 1000, 2)}
    }

def retry_node(state: AgentState) -> Dict[str, Any]:
    """Retry Node: Expands search scope, escalates routing, rewrites query."""
    start_time = time.time()
    query = state["query"]
    retry_count = state["retry_count"]
    logs = list(state["logs"])
    
    new_retry_count = retry_count + 1
    logs.append(f"[Self-Correction] Grader loop trigger (Attempt {new_retry_count}/1) -> Re-optimizing parameters:")
    
    # 1. Expand query to pull broader categories
    if config.is_demo_mode():
        expanded_query = f"{query} remote work stipend health benefits guidelines"
        time.sleep(0.4)
    else:
        prompt = f"The query: '{query}' failed validation. Generate an expanded query to retrieve more specific policy files. Output ONLY the query."
        expanded_query = call_llm(prompt, expensive=False)
        if not expanded_query:
            expanded_query = f"{query} policy specifications"
            
    logs.append(f" - Expanded query: '{expanded_query}'")
    logs.append(" - Escalate Router: Routing future generation to EXPENSIVE agent (GPT-4o/Gemini Pro)")
    
    return {
        "current_query": expanded_query,
        "sub_queries": [], # Reset multi-queries to avoid complex routing on retry
        "route_decision": "expensive", # Force escalation
        "retry_count": new_retry_count,
        "logs": logs,
        "latencies": {**state.get("latencies", {}), "retry": round((time.time() - start_time) * 1000, 2)}
    }

# --- Routing Nodes ---

def route_after_router(state: AgentState) -> Literal["query_transform"]:
    return "query_transform"

def route_after_transform(state: AgentState) -> Literal["retrieve"]:
    return "retrieve"

def route_after_retrieve(state: AgentState) -> Literal["cheap_agent", "expensive_agent"]:
    if state["route_decision"] == "expensive":
        return "expensive_agent"
    return "cheap_agent"

def route_after_grader(state: AgentState) -> Literal["retry", "end"]:
    faithfulness = state["eval_results"].get("faithfulness", 1.0)
    retry_count = state["retry_count"]
    
    if faithfulness < 0.80 and retry_count < 1:  # Allow 1 retry max
        return "retry"
    return "end"

# --- LangGraph Architecture Setup ---

workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("router", router_node)
workflow.add_node("query_transform", query_transform_node)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("cheap_agent", cheap_agent_node)
workflow.add_node("expensive_agent", expensive_agent_node)
workflow.add_node("evaluator", critic_grader_node)
workflow.add_node("retry", retry_node)

# Connect Edges
workflow.add_edge(START, "router")

workflow.add_conditional_edges(
    "router",
    route_after_router,
    {"query_transform": "query_transform"}
)

workflow.add_conditional_edges(
    "query_transform",
    route_after_transform,
    {"retrieve": "retrieve"}
)

workflow.add_conditional_edges(
    "retrieve",
    route_after_retrieve,
    {
        "cheap_agent": "cheap_agent",
        "expensive_agent": "expensive_agent"
    }
)

workflow.add_edge("cheap_agent", "evaluator")
workflow.add_edge("expensive_agent", "evaluator")

workflow.add_conditional_edges(
    "evaluator",
    route_after_grader,
    {
        "retry": "retry",
        "end": END
    }
)

workflow.add_edge("retry", "retrieve")

app_graph = workflow.compile()

# --- Run Engine Wrapper ---

def run_ragops_engine(
    query: str, 
    hyde_enabled: bool = False, 
    multi_query_enabled: bool = False, 
    hybrid_search_enabled: bool = True
) -> Dict[str, Any]:
    """Runs query through semantic cache check, then LangGraph state machine, then updates cache."""
    start_overall_time = time.time()
    
    # 1. Check Cache
    cached_resp, similarity = cache.get_cached_query(query)
    if cached_resp is not None:
        latency = round((time.time() - start_overall_time) * 1000, 2)
        cached_resp = dict(cached_resp)
        cached_resp["cache_hit"] = True
        cached_resp["cache_similarity"] = round(similarity, 3)
        cached_resp["latencies"] = {"overall": latency, "cache": latency}
        cached_resp["cost_saved"] = cached_resp.get("cost", 0.005)
        cached_resp["cost"] = 0.0
        cached_resp["logs"] = [
            f"[Start] Received user query: '{query}'",
            f"[Cache] Semantic Cache Hit (Similarity: {similarity:.3f} >= 0.90)",
            f"[Cache] Served response directly from Upstash Redis in {latency}ms for $0 cost."
        ]
        return cached_resp
        
    # 2. Invoke Graph
    initial_state = {
        "query": query,
        "current_query": query,
        "sub_queries": [],
        "context": [],
        "response": "",
        "eval_results": {},
        "model_used": "",
        "route_decision": "",
        "retry_count": 0,
        "logs": [],
        "cost": 0.0,
        "latencies": {},
        "hyde_enabled": hyde_enabled,
        "multi_query_enabled": multi_query_enabled,
        "hybrid_search_enabled": hybrid_search_enabled
    }
    
    result_state = app_graph.invoke(initial_state)
    
    overall_latency = round((time.time() - start_overall_time) * 1000, 2)
    result_state["latencies"]["overall"] = overall_latency
    
    response_payload = {
        "query": result_state["query"],
        "response": result_state["response"],
        "context": result_state["context"],
        "eval_results": result_state["eval_results"],
        "model_used": result_state["model_used"],
        "route_decision": result_state["route_decision"],
        "retry_count": result_state["retry_count"],
        "logs": result_state["logs"],
        "cost": round(result_state["cost"], 5),
        "latencies": result_state["latencies"],
        "cache_hit": False,
        # Toggles saved for cache updates
        "hyde_enabled": result_state["hyde_enabled"],
        "multi_query_enabled": result_state["multi_query_enabled"],
        "hybrid_search_enabled": result_state["hybrid_search_enabled"]
    }
    
    # 3. Write Cache on success
    faithfulness = result_state["eval_results"].get("faithfulness", 1.0)
    if faithfulness >= 0.80:
        cache.set_cached_query(query, response_payload)
        
    return response_payload
