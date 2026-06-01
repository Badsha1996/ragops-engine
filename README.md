# RAGOPS ENGINE

This document outlines the architectural of the RAGOps Engine to support **four expert-level RAG strategies** (Hierarchical Child-Parent retrieval, Hybrid Dense-Sparse Search with RRF, Query Transformations like HyDE and Multi-Query, and an Agentic Critic Grader loop) and **LangSmith observability**.

## How to run the APP?
> The app has two mode `dry run` where you can see how the app works overall
> `prod mode` where you can test it with your own LLM API key. you can find that section by going to setting
> FRONTEND : go to `cd frontend` and then run `npm run dev`
> for BACKEND `cd backend` and create env variable by `python3 -m venv venv` then `source venv/bin/activate` (for mac) then `pip install -r requirements.txt` to install all dependencies and at last `./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000`

## Open Questions

> [!NOTE]
> **Q1: Reciprocal Rank Fusion (RRF) Re-ranking Constant ($k$)**
> In RRF, the formula is $RRF(doc) = \sum_{m \in M} \frac{1}{k + Rank_m(doc)}$. We will use the industry-standard $k = 60$. 
>
> **Q2: Parent-Child Chunking Ratios**
> For Hierarchical retrieval, we will split documents into small **child chunks of 150 characters** (for highly specific vector lookup) linked to their **parent paragraphs/sections of 800+ characters**. This preserves context during generation. 

---

### 1. Expert RAG Strategies & Observability

* **Hierarchical Chunking**:
  * Add a `child_documents` collection. When a document is added, store its full text (parent), split it into sentences/small chunks (children), and index children with `parent_id` pointers.
* **Sparse BM25 Search**:
  * Build a BM25 TF-IDF lexical search over the child chunks. Calculates term frequency (TF) and inverse document frequency (IDF) for exact keyword matches.
* **Reciprocal Rank Fusion (RRF)**:
  * Perform dense search (vector similarity) and sparse search (BM25) in parallel.
  * Rank both result lists, compute the RRF score for each child document, re-rank, and fetch the top-K child documents.
  * Retrieve the full **parent document** content for the matching children, deduping the parent documents to build the final LLM prompt context.
* **Query Transformations**:
  * **HyDE (Hypothetical Document Embeddings)**: If enabled, pass the query to a fast LLM to generate a hypothetical answer. Embed this hypothetical answer and search the vector DB.
  * **Multi-Query**: If enabled, pass the query to an LLM to generate 3 sub-questions. Query the retriever for all 3 sub-questions, and combine context using RRF.
* **Critic Agent / Grader Node**:
  * Create a `critic_node` inside the LangGraph state machine. It evaluates if the generated answer is grounded in context.
  * If it fails (groundedness score $< 0.8$), it flags `hallucination_detected = true`, increments retry counter, rewrites the search query, and routes back to the retrieval node.

 
