"use client";

import RAGICON from "../../public/rag-ops-icon.png";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, Cpu, Database, Settings, BarChart3, 
  Activity, Play, Sparkles, Key, RotateCcw, 
  Trash2, PlusCircle, CheckCircle, FileText, 
  ChevronsRight, AlertTriangle, ArrowRight, BookOpen, Clock, HeartHandshake
} from "lucide-react";

import KeyModal from "../components/KeyModal";
import Analytics from "../components/Analytics";
import Visualizer from "../components/Visualizer";

interface RAGResponse {
  query: string;
  response: string;
  context: string[];
  eval_results: {
    faithfulness?: number;
    relevance?: number;
    statements?: Array<{ statement: string; supported: boolean }>;
    justification?: string;
  };
  model_used: string;
  route_decision: string;
  retry_count: number;
  logs: string[];
  cost: number;
  latencies: Record<string, number>;
  cache_hit: boolean;
  cache_similarity?: number;
  cost_saved?: number;
  hyde_enabled?: boolean;
  multi_query_enabled?: boolean;
  hybrid_search_enabled?: boolean;
}

interface DocItem {
  id: string;
  title: string;
  category: string;
  text_preview: string;
}

interface TraceSpan {
  name: string;
  type: "Chain" | "Transform" | "Retriever" | "LLM" | "Evaluator" | "Cache";
  duration: number;
  cost: number;
  offset: number;
  width: number;
}

export default function Dashboard() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<"playground" | "trace" | "analytics" | "corpus" | "settings">("playground");
  
  // App States
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  
  // Collapsed state for referenced contexts
  const [expandedCtxIdx, setExpandedCtxIdx] = useState<number | null>(null);

  // Strategy Toggles
  const [hydeEnabled, setHydeEnabled] = useState(false);
  const [multiQueryEnabled, setMultiQueryEnabled] = useState(false);
  const [hybridSearchEnabled, setHybridSearchEnabled] = useState(true);

  // Accumulated Statistics
  const [totalQueries, setTotalQueries] = useState(0);
  const [accumulatedSavings, setAccumulatedSavings] = useState(0.0);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);
  const [latencySum, setLatencySum] = useState(0);
  const [cacheHitsCount, setCacheHitsCount] = useState(0);
  
  // Vector Corpus States
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [newDocId, setNewDocId] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("HR");
  const [newDocText, setNewDocText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  
  // Credentials State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    gemini: "",
    openai: "",
    groq: "",
    upstash_url: "",
    upstash_token: "",
    langchain_tracing: false,
    langchain_api_key: "",
    langchain_project: "ragops-engine"
  });
  const [backendActive, setBackendActive] = useState(false);

  // const BACKEND_URL = "http://127.0.0.1:8000";
  const BACKEND_URL = "https://ragops-engine.onrender.com";

  // Startup Hooks
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKeys = {
        gemini: localStorage.getItem("ragops_gemini_key") || "",
        openai: localStorage.getItem("ragops_openai_key") || "",
        groq: localStorage.getItem("ragops_groq_key") || "",
        upstash_url: localStorage.getItem("ragops_upstash_url") || "",
        upstash_token: localStorage.getItem("ragops_upstash_token") || "",
        langchain_tracing: localStorage.getItem("ragops_langchain_tracing") === "true",
        langchain_api_key: localStorage.getItem("ragops_langchain_api_key") || "",
        langchain_project: localStorage.getItem("ragops_langchain_project") || "ragops-engine"
      };
      setApiKeys(savedKeys);
      
      if (savedKeys.gemini || savedKeys.openai || savedKeys.groq) {
        setDemoMode(false);
      }

      setHydeEnabled(localStorage.getItem("ragops_opt_hyde") === "true");
      setMultiQueryEnabled(localStorage.getItem("ragops_opt_multiquery") === "true");
      setHybridSearchEnabled(localStorage.getItem("ragops_opt_hybrid") !== "false");

      setTotalQueries(Number(localStorage.getItem("ragops_stat_queries") || "0"));
      setAccumulatedSavings(Number(localStorage.getItem("ragops_stat_savings") || "0.0"));
      setCacheHitsCount(Number(localStorage.getItem("ragops_stat_cache_hits") || "0"));
      setLatencySum(Number(localStorage.getItem("ragops_stat_latency_sum") || "0"));
      const count = Number(localStorage.getItem("ragops_stat_queries") || "0");
      const sum = Number(localStorage.getItem("ragops_stat_latency_sum") || "0");
      if (count > 0) {
        setAvgLatency(Math.round(sum / count));
      }
    }

    checkBackendStatus();
    fetchDocuments();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      if (res.ok) {
        setBackendActive(true);
      } else {
        setBackendActive(false);
      }
    } catch {
      setBackendActive(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Could not fetch corpus documents:", e);
    }
  };

  const handleToggleChange = (strategy: "hyde" | "multiquery" | "hybrid", value: boolean) => {
    if (strategy === "hyde") {
      setHydeEnabled(value);
      localStorage.setItem("ragops_opt_hyde", value ? "true" : "false");
    } else if (strategy === "multiquery") {
      setMultiQueryEnabled(value);
      localStorage.setItem("ragops_opt_multiquery", value ? "true" : "false");
    } else if (strategy === "hybrid") {
      setHybridSearchEnabled(value);
      localStorage.setItem("ragops_opt_hybrid", value ? "true" : "false");
    }
  };

  const handleQuerySubmit = async (queryText = query) => {
    if (!queryText.trim()) return;
    
    setIsLoading(true);
    setResponse(null);
    setExpandedCtxIdx(null);
    await checkBackendStatus();

    try {
      const res = await fetch(`${BACKEND_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          demo_mode: demoMode,
          keys: apiKeys,
          hyde_enabled: hydeEnabled,
          multi_query_enabled: multiQueryEnabled,
          hybrid_search_enabled: hybridSearchEnabled
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Query execution failed.");
      }

      const data: RAGResponse = await res.json();
      setResponse(data);
      
      const newTotal = totalQueries + 1;
      setTotalQueries(newTotal);
      localStorage.setItem("ragops_stat_queries", newTotal.toString());

      const lat = data.latencies?.overall || 0;
      const newLatencySum = latencySum + lat;
      setLatencySum(newLatencySum);
      localStorage.setItem("ragops_stat_latency_sum", newLatencySum.toString());
      setAvgLatency(Math.round(newLatencySum / newTotal));

      if (data.cache_hit) {
        const newHits = cacheHitsCount + 1;
        setCacheHitsCount(newHits);
        localStorage.setItem("ragops_stat_cache_hits", newHits.toString());
        
        const savingsVal = data.cost_saved || 0.005;
        const newSavings = accumulatedSavings + savingsVal;
        setAccumulatedSavings(newSavings);
        localStorage.setItem("ragops_stat_savings", newSavings.toFixed(5));
      } else {
        if (data.route_decision === "cheap" && data.retry_count === 0) {
          const routingSaving = 0.005 - 0.0002; 
          const newSavings = accumulatedSavings + routingSaving;
          setAccumulatedSavings(newSavings);
          localStorage.setItem("ragops_stat_savings", newSavings.toFixed(5));
        }
      }
    } catch (e: any) {
      alert(`Connection failed: ${e.message}. Launch FastAPI backend locally first.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocId.trim() || !newDocText.trim()) return;

    setIsIngesting(true);
    setIngestMessage("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newDocId.replace(/\s+/g, "_").toLowerCase(),
          text: newDocText,
          title: newDocTitle,
          category: newDocCategory
        })
      });

      if (res.ok) {
        setIngestMessage("Indexed successfully!");
        setNewDocId("");
        setNewDocTitle("");
        setNewDocText("");
        fetchDocuments();
      } else {
        const err = await res.json();
        setIngestMessage(`Error: ${err.detail}`);
      }
    } catch (err: any) {
      setIngestMessage("Failed to connect.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm("Clear Upstash Cache?")) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/clear-cache`, { method: "POST" });
        if (res.ok) {
          alert("Semantic Cache Cleared!");
        }
      } catch {
        alert("Failed to connect.");
      }
    }
  };

  const handleResetCorpus = async () => {
    if (confirm("Reset corpus defaults?")) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reset-corpus`, { method: "POST" });
        if (res.ok) {
          alert("Corpus Reset Completed!");
          fetchDocuments();
        }
      } catch {
        alert("Failed.");
      }
    }
  };

  const handleClearStats = () => {
    if (confirm("Reset stats counters?")) {
      setTotalQueries(0);
      setLatencySum(0);
      setCacheHitsCount(0);
      setAccumulatedSavings(0.0);
      setAvgLatency(null);
      localStorage.removeItem("ragops_stat_queries");
      localStorage.removeItem("ragops_stat_latency_sum");
      localStorage.removeItem("ragops_stat_cache_hits");
      localStorage.removeItem("ragops_stat_savings");
    }
  };

  const sampleQueries = [
    { text: "What is the parental leave duration?", label: "👶 Simple (Fast Route)" },
    { text: "Compare vacation rollover guidelines vs work from home hybrid days.", label: "🏝️ Complex (Hybrid BM25 + RRF)" },
    { text: "Tell me about remote work guidelines and medical wellness stipends.", label: "⚙️ Hallucination Grader Retry Loop" }
  ];

  const getTraceSpans = (): TraceSpan[] => {
    if (!response || !response.latencies) return [];
    const lat = response.latencies;
    const overall = lat.overall || 1000;
    const spans: TraceSpan[] = [];
    let accTime = 0;

    const addSpan = (name: string, type: TraceSpan["type"], duration: number, cost: number) => {
      if (duration <= 0) return;
      spans.push({
        name,
        type,
        duration: Math.round(duration),
        cost,
        offset: (accTime / overall) * 100,
        width: (duration / overall) * 100
      });
      accTime += duration;
    };

    if (response.cache_hit) {
      addSpan("Upstash Cache semantic match", "Cache", lat.overall, 0.0);
      return spans;
    }

    addSpan("Complexity Router", "Chain", lat.router || 10, 0.0);
    if (response.hyde_enabled || response.multi_query_enabled) {
      addSpan("HyDE / Multi-Query rewrite", "Transform", lat.transformer || 400, 0.0001);
    }
    addSpan("BM25 Lexical & Cosine Retrieval", "Retriever", lat.retriever || 120, 0.0);
    
    const gen = lat.generator || 800;
    const ev = lat.evaluator || 50;

    if (response.retry_count > 0) {
      addSpan("Llama-3 (hallucinated wellness)", "LLM", gen * 0.4, 0.00015);
      addSpan("Evaluator (failed groundedness)", "Evaluator", ev * 0.5, 0.00015);
      addSpan("Stateful Escalation retry", "Transform", lat.retry || 500, 0.0);
      addSpan("GPT-4o Premium (accurate guidelines)", "LLM", gen * 0.6, 0.005);
      addSpan("Evaluator groundedness audit (passed)", "Evaluator", ev * 0.5, 0.00015);
    } else {
      addSpan(response.route_decision === "cheap" ? "Llama-3 Fast Agent" : "GPT-4o Premium Agent", "LLM", gen, response.route_decision === "cheap" ? 0.0002 : 0.005);
      addSpan("Groundedness Grader audit", "Evaluator", ev, 0.00015);
    }
    addSpan("Upstash cache synchronization", "Cache", 20, 0.0);
    return spans;
  };

  const traceSpans = getTraceSpans();

  const getBadgeClass = (type: TraceSpan["type"]) => {
    switch (type) {
      case "Chain": return "badge-blue";
      case "Transform": return "badge-purple";
      case "Retriever": return "badge-green";
      case "LLM": return "badge-amber";
      case "Evaluator": return "badge-red";
      case "Cache": return "badge-green glow-success";
    }
  };

  const pageTransition = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { type: "tween", ease: "easeInOut", duration: 0.25 }
  } as const;

  return (
    <div className="app-container">

      {/* HEADER SECTION  */}
      <header className="app-header">
        <div className="logo-text">
          <img src={RAGICON.src} alt="RAGOps Logo" style={{ width: "120px", height: "85px" }} />
        </div>
        <nav className="tab-navbar">
          <button 
            onClick={() => setActiveTab("playground")} 
            className={`nav-tab-button ${activeTab === "playground" ? "active" : ""}`}
          >
            <Terminal size={14} /> Console
          </button>
          <button 
            onClick={() => setActiveTab("trace")} 
            className={`nav-tab-button ${activeTab === "trace" ? "active" : ""}`}
          >
            <Cpu size={14} /> Orchestration
          </button>
          <button 
            onClick={() => setActiveTab("analytics")} 
            className={`nav-tab-button ${activeTab === "analytics" ? "active" : ""}`}
          >
            <BarChart3 size={14} /> ROI Analytics
          </button>
          <button 
            onClick={() => setActiveTab("corpus")} 
            className={`nav-tab-button ${activeTab === "corpus" ? "active" : ""}`}
          >
            <Database size={14} /> Knowledge DB
          </button>
          <button 
            onClick={() => setActiveTab("settings")} 
            className={`nav-tab-button ${activeTab === "settings" ? "active" : ""}`}
          >
            <Settings size={14} /> Settings
          </button>
        </nav>
      </header>

      {/* TOP METRICS */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
          gap: "12px",
          width: "100%",
        }}
      >
        <div className="mini-card" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mini-card-label">Engine queries</div>
            <div className="mini-card-value">{totalQueries}</div>
          </div>
          <div style={{ color: "var(--primary)", opacity: 0.15 }}>
            <Terminal size={32} />
          </div>
        </div>
        <div className="mini-card" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mini-card-label">Avg Latency</div>
            <div className="mini-card-value">{avgLatency !== null ? `${avgLatency}ms` : "N/A"}</div>
          </div>
          <div style={{ color: "var(--primary)", opacity: 0.15 }}>
            <Clock size={32} />
          </div>
        </div>
        <div className="mini-card" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mini-card-label">Semantic cache hits</div>
            <div className="mini-card-value" style={{ color: "var(--success)" }}>{cacheHitsCount}</div>
          </div>
          <div style={{ color: "var(--success)", opacity: 0.15 }}>
            <Database size={32} />
          </div>
        </div>
        <div className="mini-card" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mini-card-label">Accumulated savings</div>
            <div className="mini-card-value" style={{ color: "var(--success)" }}>${accumulatedSavings.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout with Page-level Transitions */}
      <main style={{ minHeight: "60vh" }}>
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Console / Playground */}
          {activeTab === "playground" && (
            <motion.div 
              key="playground"
              {...pageTransition}
              className={`chat-workspace ${response ? "split" : "full"}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Floating Input console (centered Perplexity style) */}
                <div className="sleek-card" style={{ padding: "24px" }}>
                  
                  {isLoading && (
                    <div style={{ width: "100%", height: "3px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden", marginBottom: "16px" }}>
                      <div style={{ height: "100%", background: "var(--primary)", width: "35%", borderRadius: "99px", animation: "dash 1.3s ease-in-out infinite" }}></div>
                    </div>
                  )}

                  <div className="search-container">
                    <input 
                      type="text"
                      placeholder="Search policy guidelines (e.g. Parental leave duration, travel stipends)..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="search-input"
                      onKeyDown={(e) => e.key === "Enter" && handleQuerySubmit()}
                      disabled={isLoading || !backendActive}
                    />
                    <button 
                      onClick={() => handleQuerySubmit()} 
                      className="search-submit-btn"
                      disabled={isLoading || !query.trim() || !backendActive}
                    >
                      <Play size={15} fill="#ffffff" />
                    </button>
                  </div>

                  {/* Strategy toggles with micro-explanations */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Expert RAG Strategies Activated:
                    </span>
                    <div className="strategy-row">
                      <button 
                        onClick={() => handleToggleChange("hybrid", !hybridSearchEnabled)}
                        className={`strategy-chip ${hybridSearchEnabled ? "active" : ""}`}
                        title="Runs keyword search (BM25) and dense vector search in parallel, merging results via Reciprocal Rank Fusion."
                      >
                       Hybrid RRF Retrieval
                      </button>
                      <button 
                        onClick={() => handleToggleChange("hyde", !hydeEnabled)}
                        className={`strategy-chip ${hydeEnabled ? "active" : ""}`}
                        title="Generates a hypothetical correct response first, using it as the embedding search query to drastically improve vector alignment."
                      >
                        HyDE Rewriting
                      </button>
                      <button 
                        onClick={() => handleToggleChange("multiquery", !multiQueryEnabled)}
                        className={`strategy-chip ${multiQueryEnabled ? "active" : ""}`}
                        title="Decomposes a single query into 3 sub-queries, gathering document chunks for all of them to synthesize robust answers."
                      >
                        Multi-Query Split
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output Bubble Response Panel */}
                <AnimatePresence>
                  {response && !isLoading && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="sleek-card" 
                      style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--card-border)", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="badge badge-purple">
                            {response.model_used.split(" ")[0]}
                          </span>
                          {response.cache_hit && <span className="badge badge-green">Cache Hit</span>}
                          {response.retry_count > 0 && <span className="badge badge-amber">Self-Corrected</span>}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                          Processed in {response.latencies?.overall || 0}ms
                        </span>
                      </div>

                      <p style={{ fontSize: "0.92rem", color: "var(--text-primary)", lineHeight: "1.6", whiteSpace: "pre-line" }}>
                        {response.response}
                      </p>

                      {/* Collapsible references block */}
                      <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "12px", marginTop: "4px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                            Source Context Chunks:
                          </span>
                          <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px" }}>
                            {response.context.map((ctx, idx) => {
                              const titleMatch = ctx.match(/^([^:]+):/);
                              const label = titleMatch ? titleMatch[1] : `Section ${idx + 1}`;
                              const isExpanded = expandedCtxIdx === idx;
                              return (
                                <button 
                                  key={idx} 
                                  onClick={() => setExpandedCtxIdx(isExpanded ? null : idx)} 
                                  className="ref-pill"
                                  style={{ 
                                    borderColor: isExpanded ? "var(--primary)" : "var(--card-border)",
                                    background: isExpanded ? "var(--primary-light)" : "rgba(241, 245, 249, 0.6)",
                                    color: isExpanded ? "var(--primary)" : "var(--text-secondary)"
                                  }}
                                >
                                  {label} {isExpanded ? "▲" : "▼"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {expandedCtxIdx !== null && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ 
                                background: "#f8fafc", 
                                border: "1px solid var(--card-border)", 
                                borderRadius: "10px", 
                                padding: "14px", 
                                fontSize: "0.8rem", 
                                color: "var(--text-secondary)", 
                                marginTop: "12px", 
                                lineHeight: "1.5" 
                              }}>
                                {response.context[expandedCtxIdx]}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Clean Preset Trigger Chips (Pills style) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Select a Preset Policy Query:
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {sampleQueries.map((sample, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuery(sample.text);
                          handleQuerySubmit(sample.text);
                        }}
                        disabled={isLoading || !backendActive}
                        style={{
                          background: "rgba(255, 255, 255, 0.7)",
                          border: "1.5px solid var(--card-border)",
                          borderRadius: "10px",
                          padding: "10px 14px",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "var(--transition-smooth)"
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--card-border)")}
                      >
                        <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: "500" }}>"{sample.text}"</span>
                        <span className="badge badge-blue" style={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: "4px" }}>
                          <ChevronsRight size={10} /> {idx === 0 ? "Fast Route" : idx === 1 ? "RRF Hybrid" : "Correction Loop"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar Active Run Specs (Only visible when response is present) */}
              {response && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  <div className="sleek-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h3 style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--card-border)", paddingBottom: "6px" }}>
                      Active Run Diagnostics
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Router Classify</span>
                        <span style={{ fontWeight: "600", color: "var(--primary)", textTransform: "capitalize" }}>
                          {response.route_decision === "cheap" ? "Simple (Fast)" : "Complex (Premium)"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Active Provider</span>
                        <span style={{ fontWeight: "600" }}>{response.model_used}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Latency Duration</span>
                        <span style={{ fontWeight: "600" }}>{response.latencies?.overall || 0} ms</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Calculated Cost</span>
                        <span style={{ fontWeight: "600", color: response.cache_hit ? "var(--success)" : "var(--text-primary)" }}>
                          ${response.cost.toFixed(5)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Cache Synchronization</span>
                        <span style={{ fontWeight: "600", color: "var(--success)" }}>
                          {response.cache_hit ? "HIT" : "Sync Complete"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Quality Auditor</span>
                        <span style={{ fontWeight: "600", color: response.retry_count > 0 ? "var(--warning)" : "var(--success)" }}>
                          {response.retry_count > 0 ? `Rejected ${response.retry_count}x` : "Approved"}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab("trace")} 
                      className="button-primary"
                      style={{ fontSize: "0.74rem", padding: "8px", width: "100%", marginTop: "6px" }}
                    >
                      Inspect Route Graph <ArrowRight size={12} />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* TAB 2: Multi-Agent Trace Visualizer */}
          {activeTab === "trace" && (
            <motion.div 
              key="trace"
              {...pageTransition}
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
                <Visualizer 
                  logs={response ? response.logs : []}
                  routeDecision={response ? response.route_decision : ""}
                  retryCount={response ? response.retry_count : 0}
                  modelUsed={response ? response.model_used : ""}
                  cacheHit={response ? response.cache_hit : false}
                  activeNode=""
                />

                {/* Chronological waterfall spans */}
                <div className="sleek-card waterfall-card" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                    <h3 style={{ fontSize: "0.88rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={16} style={{ color: "var(--primary)" }} /> Hierarchical Execution Waterfall Tracing
                    </h3>
                    {apiKeys.langchain_api_key && (
                      <span className="badge badge-green" style={{ fontSize: "0.58rem" }}>
                        Live LangSmith tracing active
                      </span>
                    )}
                  </div>

                  {response ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {traceSpans.map((span, idx) => (
                        <div key={idx} className="waterfall-row">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className={`badge ${getBadgeClass(span.type)}`} style={{ fontSize: "0.56rem", padding: "2px 6px" }}>
                              {span.type}
                            </span>
                            <span style={{ fontWeight: "600", fontSize: "0.78rem" }}>{span.name}</span>
                          </div>
                          <div style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.78rem", textAlign: "right" }}>
                            {span.duration} ms
                          </div>
                          <div className="duration-slider-track">
                            <div 
                              className="duration-slider-fill" 
                              style={{ 
                                marginLeft: `${span.offset}%`, 
                                width: `${span.width}%`,
                                background: span.type === "Evaluator" 
                                  ? "var(--danger)" 
                                  : span.type === "Retriever" 
                                  ? "var(--success)" 
                                  : "var(--primary)"
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", padding: "30px 10px" }}>
                      <AlertTriangle size={24} style={{ color: "var(--warning)", marginBottom: "8px" }} />
                      <p>Submit a policy query inside the Console to visualize chronological step timings.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Cost and ROI Analytics */}
          {activeTab === "analytics" && (
            <motion.div 
              key="analytics"
              {...pageTransition}
            >
              <Analytics 
                data={response ? {
                  latency: response.latencies?.overall || 0,
                  cost: response.cost,
                  costSaved: accumulatedSavings,
                  cacheHit: response.cache_hit,
                  cacheSimilarity: response.cache_similarity,
                  faithfulness: response.eval_results?.faithfulness,
                  relevance: response.eval_results?.relevance,
                  modelUsed: response.model_used,
                  retryCount: response.retry_count,
                } : null}
              />
            </motion.div>
          )}

          {/* TAB 4: Knowledge Database Manager */}
          {activeTab === "corpus" && (
            <motion.div 
              key="corpus"
              {...pageTransition}
              className="chat-workspace split"
            >
              {/* Document ingestion form */}
              <div className="sleek-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: "700" }}>Index Corporate Guidelines</h3>
                  <button 
                    onClick={handleResetCorpus} 
                    className="button-secondary" 
                    style={{ fontSize: "0.68rem", padding: "4px 8px" }}
                  >
                    <RotateCcw size={10} /> Reset Defaults
                  </button>
                </div>

                <form onSubmit={handleIngestSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                        Unique Document ID
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. travel_policy"
                        value={newDocId}
                        onChange={(e) => setNewDocId(e.target.value)}
                        className="text-input"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                        Category
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. HR"
                        value={newDocCategory}
                        onChange={(e) => setNewDocCategory(e.target.value)}
                        className="text-input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                      Document Title
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. Travel and Transport Stipends"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      className="text-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                      Policy Guideline Text
                    </label>
                    <textarea 
                      placeholder="Input the full text details of the guideline section..."
                      value={newDocText}
                      onChange={(e) => setNewDocText(e.target.value)}
                      className="textarea-input"
                      rows={5}
                      required
                      style={{ resize: "none" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--success)", fontWeight: "600" }}>{ingestMessage}</span>
                    <button 
                      type="submit" 
                      className="button-primary" 
                      style={{ padding: "8px 16px" }} 
                      disabled={isIngesting}
                    >
                      <PlusCircle size={14} /> {isIngesting ? "Indexing..." : "Index Guideline"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Indexed Files list */}
              <div className="sleek-card" style={{ padding: "24px" }}>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Active Guidelines Indexed Corpus
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                  {documents.length === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No files indexed. Click Reset Defaults above.</span>
                  ) : (
                    documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        style={{ 
                          background: "rgba(255,255,255,0.7)", 
                          border: "1px solid var(--card-border)", 
                          borderLeft: "4px solid var(--primary)", 
                          borderRadius: "10px", 
                          padding: "10px 14px", 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center" 
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "80%" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)" }}>{doc.title}</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>{doc.text_preview.slice(0, 75)}...</span>
                        </div>
                        <span className="badge badge-blue" style={{ fontSize: "0.56rem" }}>{doc.category}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: Settings / Credentials */}
          {activeTab === "settings" && (
            <motion.div 
              key="settings"
              {...pageTransition}
              style={{ maxWidth: "600px", margin: "0 auto" }}
            >
              <div className="sleek-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", borderBottom: "1px solid var(--card-border)", paddingBottom: "10px" }}>
                  System Credentials & Storage Management
                </h3>
                
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  Enter credentials to connect with external LLM providers, configure Upstash Redis cache storage, or manage LangSmith cloud traces.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                  <button 
                    onClick={() => setIsKeyModalOpen(true)} 
                    className="button-primary" 
                    style={{ width: "100%", padding: "12px", fontSize: "0.85rem" }}
                  >
                    <Key size={15} /> Configure Environment API Keys
                  </button>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
                    <button 
                      onClick={handleClearCache} 
                      className="button-secondary" 
                      style={{ padding: "10px" }}
                    >
                      <Trash2 size={13} style={{ color: "var(--danger)" }} /> Flush Upstash Cache
                    </button>
                    <button 
                      onClick={handleClearStats} 
                      className="button-secondary" 
                      style={{ padding: "10px" }}
                    >
                      <RotateCcw size={13} /> Reset Timings Stats
                    </button>
                  </div>
                </div>

                
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Setup API Credentials Modal overlay */}
      <KeyModal 
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={(savedKeys) => {
          setApiKeys(savedKeys);
          if (savedKeys.gemini || savedKeys.openai || savedKeys.groq) {
            setDemoMode(false);
          }
        }}
      />
    </div>
  );
}
