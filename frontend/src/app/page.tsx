"use client";

import React, { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"playground" | "trace" | "corpus" | "settings">("playground");
  
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

  const BACKEND_URL = "http://127.0.0.1:8000";

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

  return (
    <div className="app-container" style={{ maxWidth: "1200px", padding: "16px 24px", gap: "16px" }}>
      
      {/* 1. Header (Balanced Padding & Clean Alignment) */}
      <header className="app-header" style={{ paddingBottom: "12px", marginBottom: "4px" }}>
        <div className="logo-text">
          <span>🚀 RAGOps Engine</span>
          <span style={{ fontSize: "0.72rem", background: "var(--primary-light)", color: "var(--primary)", padding: "2px 8px", borderRadius: "6px", fontWeight: "600" }}>
            Stateful Multi-Agent
          </span>
        </div>

        {/* Tab Navbar (Perfect Line Height) */}
        <nav className="tab-navbar">
          <button onClick={() => setActiveTab("playground")} className={`nav-tab-button ${activeTab === "playground" ? "active" : ""}`}>
            Console
          </button>
          <button onClick={() => setActiveTab("trace")} className={`nav-tab-button ${activeTab === "trace" ? "active" : ""}`}>
            Traces
          </button>
          <button onClick={() => setActiveTab("corpus")} className={`nav-tab-button ${activeTab === "corpus" ? "active" : ""}`}>
            Knowledge DB
          </button>
          <button onClick={() => setActiveTab("settings")} className={`nav-tab-button ${activeTab === "settings" ? "active" : ""}`}>
            Settings
          </button>
        </nav>
      </header>

      {/* Global Counters Dashboard Mini bar (Flush aligned, zero waste padding) */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
          gap: "10px",
          width: "100%",
          marginBottom: "8px"
        }}
      >
        <div className="mini-card" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--card-border)" }}>
          <span className="mini-card-label" style={{ fontSize: "0.68rem" }}>Engine runs</span>
          <span className="mini-card-value" style={{ fontSize: "1.05rem", marginTop: 0 }}>{totalQueries}</span>
        </div>
        <div className="mini-card" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--card-border)" }}>
          <span className="mini-card-label" style={{ fontSize: "0.68rem" }}>Latency</span>
          <span className="mini-card-value" style={{ fontSize: "1.05rem", marginTop: 0 }}>{avgLatency !== null ? `${avgLatency}ms` : "N/A"}</span>
        </div>
        <div className="mini-card" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--card-border)" }}>
          <span className="mini-card-label" style={{ fontSize: "0.68rem" }}>Cache Hit</span>
          <span className="mini-card-value" style={{ fontSize: "1.05rem", marginTop: 0, color: "var(--success)" }}>{cacheHitsCount}</span>
        </div>
        <div className="mini-card" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--card-border)" }}>
          <span className="mini-card-label" style={{ fontSize: "0.68rem" }}>Saved USD</span>
          <span className="mini-card-value" style={{ fontSize: "1.05rem", marginTop: 0, color: "var(--success)" }}>${accumulatedSavings.toFixed(5)}</span>
        </div>
      </div>

      {/* 2. Main Workspace Layout (Perfect Dual Column Balance) */}
      <div className="chat-workspace split" style={{ display: "grid", gap: "20px" }}>
        
        {/* LEFT COLUMN: Main focused Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* TAB 1: Console / Playground */}
          {activeTab === "playground" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* Floating Input console (centered Perplexity style) */}
              <div className="sleek-card" style={{ padding: "16px" }}>
                
                {isLoading && (
                  <div style={{ width: "100%", height: "2px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden", marginBottom: "12px" }}>
                    <div style={{ height: "100%", background: "var(--primary)", width: "35%", borderRadius: "99px", animation: "dash 1.3s ease-in-out infinite" }}></div>
                  </div>
                )}

                <div className="search-container">
                  <input 
                    type="text"
                    placeholder="Ask corporate policy details (e.g. Vacation roll-overs, WFH stipend guidelines)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="search-input"
                    onKeyDown={(e) => e.key === "Enter" && handleQuerySubmit()}
                    disabled={isLoading || !backendActive}
                    style={{ padding: "12px 50px 12px 14px", borderRadius: "10px", fontSize: "0.9rem" }}
                  />
                  <button 
                    onClick={() => handleQuerySubmit()} 
                    className="search-submit-btn"
                    disabled={isLoading || !query.trim() || !backendActive}
                    style={{ width: "32px", height: "32px", right: "6px" }}
                  >
                    ➔
                  </button>
                </div>

                {/* Micro Toggles direct pill switches */}
                <div className="strategy-row" style={{ marginTop: "8px", gap: "6px" }}>
                  <button 
                    onClick={() => handleToggleChange("hybrid", !hybridSearchEnabled)}
                    className={`strategy-chip ${hybridSearchEnabled ? "active" : ""}`}
                    style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                  >
                    ⚡ Hybrid RRF Search
                  </button>
                  <button 
                    onClick={() => handleToggleChange("hyde", !hydeEnabled)}
                    className={`strategy-chip ${hydeEnabled ? "active" : ""}`}
                    style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                  >
                    🔎 HyDE Transformer
                  </button>
                  <button 
                    onClick={() => handleToggleChange("multiquery", !multiQueryEnabled)}
                    className={`strategy-chip ${multiQueryEnabled ? "active" : ""}`}
                    style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                  >
                    🧬 Multi-Query Split
                  </button>
                </div>
              </div>

              {/* Output Bubble Response Panel */}
              {response && !isLoading && (
                <div className="sleek-card" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>{response.model_used.split(" ")[0]}</span>
                      {response.cache_hit && <span className="badge badge-green" style={{ fontSize: "0.62rem" }}>Cache Hit</span>}
                      {response.retry_count > 0 && <span className="badge badge-amber" style={{ fontSize: "0.62rem" }}>Self-corrected</span>}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                      Query executed in {response.latencies?.overall || 0}ms
                    </span>
                  </div>

                  <p style={{ fontSize: "0.92rem", color: "var(--text-primary)", lineHeight: "1.55", whiteSpace: "pre-line" }}>
                    {response.response}
                  </p>

                  {/* Collapsible references block */}
                  <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "8px", marginTop: "2px" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginRight: "6px" }}>
                      References:
                    </span>
                    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px" }}>
                      {response.context.map((ctx, idx) => {
                        const titleMatch = ctx.match(/^([^:]+):/);
                        const label = titleMatch ? titleMatch[1] : `Doc ${idx + 1}`;
                        const isExpanded = expandedCtxIdx === idx;
                        return (
                          <button 
                            key={idx} 
                            onClick={() => setExpandedCtxIdx(isExpanded ? null : idx)} 
                            className="ref-pill"
                            style={{ borderColor: isExpanded ? "var(--primary)" : "#cbd5e1", padding: "2px 6px", fontSize: "0.7rem" }}
                          >
                            📄 {label} {isExpanded ? "▴" : "▾"}
                          </button>
                        );
                      })}
                    </div>
                    
                    {expandedCtxIdx !== null && (
                      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 10px", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.4" }}>
                        {response.context[expandedCtxIdx]}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Clean Preset Trigger Chips (Pills style) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  One-Click Sample Policies Query triggers:
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
                  {sampleQueries.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(sample.text);
                        handleQuerySubmit(sample.text);
                      }}
                      disabled={isLoading || !backendActive}
                      style={{
                        background: "#ffffff",
                        border: "1px solid var(--card-border)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "var(--transition-smooth)"
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: "500" }}>"{sample.text}"</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: "600", color: idx === 2 ? "var(--warning)" : "var(--primary)", background: idx === 2 ? "var(--warning-light)" : "var(--primary-light)", padding: "2px 8px", borderRadius: "4px" }}>
                        {idx === 0 ? "Fast" : idx === 1 ? "Hybrid" : "Grader retry"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Observibility timeline (Chronological waterfall spans) */}
          {activeTab === "trace" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="sleek-card waterfall-card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: "700" }}>Chronological Waterfall Timeline (LangSmith Tracing)</h3>
                  {apiKeys.langchain_api_key && <span className="badge badge-green" style={{ fontSize: "0.58rem" }}>Live LangSmith active</span>}
                </div>

                {response ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {traceSpans.map((span, idx) => (
                      <div key={idx} className="waterfall-row" style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={`badge ${getBadgeClass(span.type)}`} style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "4px" }}>
                            {span.type}
                          </span>
                          <span style={{ fontWeight: "500", fontSize: "0.78rem" }}>{span.name}</span>
                        </div>
                        <div style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.76rem" }}>
                          {span.duration}ms
                        </div>
                        <div className="duration-slider-track" style={{ height: "3px" }}>
                          <div 
                            className="duration-slider-fill" 
                            style={{ 
                              marginLeft: `${span.offset}%`, 
                              width: `${span.width}%`,
                              background: span.type === "Evaluator" ? "var(--danger)" : span.type === "Retriever" ? "var(--success)" : "var(--primary)"
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", padding: "20px" }}>
                    Submit a query to inspect the LangSmith traces timeline waterfall.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Knowledge Database manager */}
          {activeTab === "corpus" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="sleek-card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "0.9rem" }}>Index Corporate guidelines File</h3>
                  <button onClick={handleResetCorpus} className="button-secondary" style={{ fontSize: "0.68rem", padding: "3px 6px" }}>
                    Reset Defaults
                  </button>
                </div>

                <form onSubmit={handleIngestSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input 
                      type="text"
                      placeholder="Doc ID (e.g. travel_expenses)"
                      value={newDocId}
                      onChange={(e) => setNewDocId(e.target.value)}
                      className="text-input"
                      required
                      style={{ fontSize: "0.8rem", padding: "8px 10px", flex: 1 }}
                    />
                    <input 
                      type="text"
                      placeholder="Category"
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value)}
                      className="text-input"
                      style={{ fontSize: "0.8rem", padding: "8px 10px", width: "90px" }}
                    />
                  </div>
                  <input 
                    type="text"
                    placeholder="Doc Title (e.g. Travel Stipends guidelines)"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="text-input"
                    style={{ fontSize: "0.8rem", padding: "8px 10px" }}
                  />
                  <textarea 
                    placeholder="Policy content body text..."
                    value={newDocText}
                    onChange={(e) => setNewDocText(e.target.value)}
                    className="textarea-input"
                    rows={3}
                    required
                    style={{ fontSize: "0.8rem", padding: "8px 10px", resize: "none" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--success)" }}>{ingestMessage}</span>
                    <button type="submit" className="button-primary" style={{ padding: "6px 12px", fontSize: "0.76rem" }} disabled={isIngesting}>
                      {isIngesting ? "indexing..." : "Ingest Policy"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Indexed Files list */}
              <div className="sleek-card" style={{ padding: "16px" }}>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: "600" }}>
                  Active Guidelines Indexed Corpus:
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid var(--primary)", borderRadius: "6px", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", maxWidth: "80%" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text-primary)" }}>{doc.title}</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{doc.text_preview.slice(0, 60)}...</span>
                      </div>
                      <span className="badge badge-blue" style={{ fontSize: "0.52rem", padding: "1px 4px" }}>{doc.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Credentials Configuration */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="sleek-card" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: "700" }}>System Credentials Setup</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button onClick={() => setIsKeyModalOpen(true)} className="button-primary" style={{ width: "100%", padding: "10px", fontSize: "0.85rem" }}>
                    🔑 Configure API Keys & LangSmith cloud
                  </button>
                  
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button onClick={handleClearCache} className="button-secondary" style={{ flex: 1, padding: "8px", fontSize: "0.76rem" }}>
                      🧹 Flush Upstash cache
                    </button>
                    <button onClick={handleClearStats} className="button-secondary" style={{ flex: 1, padding: "8px", fontSize: "0.76rem" }}>
                      🗑️ Reset performance stats
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Permanent Visual Diagnostics (Extremely clean & stylish) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Dynamic multi agent diagram map */}
          <Visualizer 
            logs={response ? response.logs : []}
            routeDecision={response ? response.route_decision : ""}
            retryCount={response ? response.retry_count : 0}
            modelUsed={response ? response.model_used : ""}
            cacheHit={response ? response.cache_hit : false}
            activeNode=""
          />

          {/* Analytics Cost & Comparison block */}
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

        </div>

      </div>

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
