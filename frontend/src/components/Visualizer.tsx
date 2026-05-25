"use client";

import React from "react";

interface VisualizerProps {
  logs: string[];
  routeDecision: string;
  retryCount: number;
  modelUsed: string;
  cacheHit: boolean;
  activeNode: string;
}

export default function Visualizer({ logs, routeDecision, retryCount, modelUsed, cacheHit }: VisualizerProps) {
  const hasLogs = logs.length > 0;
  
  // Active checks for routing
  const isCacheChecked = hasLogs;
  const isCacheHit = hasLogs && cacheHit;
  const isCacheMiss = hasLogs && !cacheHit;
  
  const isRouterActive = isCacheMiss;
  const isCheapAgentUsed = isCacheMiss && routeDecision === "cheap" && retryCount === 0;
  const isExpensiveAgentUsed = isCacheMiss && (routeDecision === "expensive" || retryCount > 0);
  const isEvaluatorActive = isCheapAgentUsed || isExpensiveAgentUsed;
  const isRetryActive = isCacheMiss && retryCount > 0;
  const isSuccessActive = hasLogs && (isCacheHit || (isEvaluatorActive && !isRetryActive) || (isRetryActive && isExpensiveAgentUsed));

  // Determine active agent node
  const getActiveAgent = () => {
    if (!hasLogs) return "idle";
    const lastLog = logs[logs.length - 1].toLowerCase();
    
    if (lastLog.includes("cache hit")) return "cache_agent";
    if (lastLog.includes("received query")) return "supervisor";
    if (lastLog.includes("complexity classification")) return "router_agent";
    if (lastLog.includes("hyde") || lastLog.includes("query transform") || lastLog.includes("splitting")) return "hyde_agent";
    if (lastLog.includes("retrieving top") || lastLog.includes("document")) return "retriever_agent";
    if (lastLog.includes("cheap agent")) return "cheap_agent";
    if (lastLog.includes("expensive agent") || lastLog.includes("premium")) return "expensive_agent";
    if (lastLog.includes("evaluating response") || lastLog.includes("auditing")) return "critic_agent";
    if (lastLog.includes("self-correcting")) return "retry_node";
    if (lastLog.includes("stored query") || lastLog.includes("completed") || lastLog.includes("served")) return "success";
    return "supervisor";
  };

  const activeAgent = getActiveAgent();

  return (
    <div className="sleek-card" style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #cbd5e1", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
          🤖 Multi-Agent Orchestrator
        </h4>
        <span className="badge badge-blue" style={{ fontSize: "0.6rem" }}>Supervisor Workflow</span>
      </div>

      <div style={{ position: "relative", width: "100%", height: "260px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
        
        {/* SVG connection lines representing orchestrator coordination */}
        <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, zIndex: 0 }}>
          
          {/* Supervisor -> Cache Agent */}
          <path 
            d="M 185 130 L 105 130" 
            className={`connection-line ${isCacheChecked ? "active success" : ""}`}
            strokeWidth="1.5"
          />

          {/* Supervisor -> Router Agent */}
          <path 
            d="M 235 130 L 315 80" 
            className={`connection-line ${isCacheMiss ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Supervisor -> Transform/HyDE Agent */}
          <path 
            d="M 235 130 L 315 130" 
            className={`connection-line ${isCacheMiss && (activeAgent === "hyde_agent" || logs.some(l => l.includes("HyDE") || l.includes("Query"))) ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Supervisor -> Hybrid Retriever Agent */}
          <path 
            d="M 235 130 L 315 180" 
            className={`connection-line ${isCacheMiss ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Hybrid Retriever -> Cheap LLM */}
          <path 
            d="M 375 180 Q 420 180 420 80" 
            fill="transparent"
            className={`connection-line ${isCheapAgentUsed ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Hybrid Retriever -> Expensive LLM */}
          <path 
            d="M 375 180 Q 450 200 450 230" 
            fill="transparent"
            className={`connection-line ${isExpensiveAgentUsed ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Cheap LLM -> Critic Agent */}
          <path 
            d="M 450 80 L 235 130" 
            className={`connection-line ${isCheapAgentUsed ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Expensive LLM -> Critic Agent */}
          <path 
            d="M 450 230 L 235 130" 
            className={`connection-line ${isExpensiveAgentUsed ? "active" : ""}`}
            strokeWidth="1.5"
          />

          {/* Critic Grader -> Cache Write (Success) */}
          <path 
            d="M 185 130 L 105 80" 
            className={`connection-line ${isSuccessActive && !cacheHit ? "active success" : ""}`}
            strokeWidth="1.5"
          />

          {/* Critic Grader -> Self-Correction Retry Node */}
          <path 
            d="M 210 160 L 210 215" 
            className={`connection-line ${isRetryActive ? "active warning" : ""}`}
            strokeWidth="1.5"
          />

          {/* Self-Correction -> Hybrid Retriever (Re-Search loop) */}
          <path 
            d="M 235 230 L 315 180" 
            className={`connection-line ${isRetryActive ? "active warning" : ""}`}
            strokeWidth="1.5"
          />

        </svg>

        {/* Node Cards (Representing Active Agents) */}

        {/* 1. SUPERVISOR ORCHESTRATOR AGENT (Center Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "supervisor" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "185px",
            top: "105px",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
            fontWeight: "bold",
            color: "var(--primary)",
            borderColor: activeAgent === "supervisor" ? "var(--primary)" : "#cbd5e1",
            zIndex: 2,
            boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
          }}
        >
          👑
        </div>
        <div style={{ position: "absolute", left: "175px", top: "158px", fontSize: "0.6rem", fontWeight: "600", color: "var(--text-secondary)", width: "70px", textAlign: "center" }}>
          Supervisor
        </div>

        {/* 2. CACHE AGENT (Left Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "cache_agent" ? "active" : ""} ${isCacheHit ? "success" : ""}`}
          style={{
            position: "absolute",
            left: "20px",
            top: "105px",
            width: "85px",
            height: "45px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600" }}>Cache Agent</div>
          <div style={{ fontSize: "0.55rem", color: "var(--text-secondary)" }}>
            {cacheHit ? "HIT ($0)" : isCacheMiss ? "MISS" : "Upstash Redis"}
          </div>
        </div>

        {/* 3. ROUTER AGENT (Top Right Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "router_agent" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "315px",
            top: "60px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600" }}>Complexity Router</div>
        </div>

        {/* 4. HyDE QUERY TRANSFORMER AGENT (Middle Right Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "hyde_agent" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "315px",
            top: "110px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600" }}>HyDE Agent</div>
        </div>

        {/* 5. HYBRID RETRIEVER AGENT (Bottom Right Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "retriever_agent" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "315px",
            top: "160px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600", color: "var(--success)" }}>Hybrid retriever</div>
        </div>

        {/* 6. CHEAP GENERATION AGENT (Top Right corner) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "cheap_agent" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "410px",
            top: "40px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600", color: "#7c3aed" }}>Fast Agent</div>
        </div>

        {/* 7. EXPENSIVE GENERATION AGENT (Bottom Right corner) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "expensive_agent" ? "active" : ""}`}
          style={{
            position: "absolute",
            left: "410px",
            top: "210px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600", color: "#d97706" }}>Premium Agent</div>
        </div>

        {/* 8. CRITIC GRADER AGENT (Top Left corner) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "critic_agent" ? "active" : ""} ${isRetryActive ? "danger" : (isSuccessActive && !cacheHit ? "success" : "")}`}
          style={{
            position: "absolute",
            left: "20px",
            top: "40px",
            width: "85px",
            height: "45px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600" }}>Critic Grader</div>
        </div>

        {/* 9. SELF-CORRECTION AGENT (Bottom Node) */}
        <div 
          className={`node-card glass-panel ${activeAgent === "retry_node" ? "active warning" : ""}`}
          style={{
            position: "absolute",
            left: "170px",
            top: "210px",
            width: "80px",
            height: "40px",
            padding: "4px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            textAlign: "center",
            zIndex: 2
          }}
        >
          <div style={{ fontWeight: "600", color: "var(--warning)" }}>Self-Correction</div>
        </div>

      </div>

      {/* Waterfall execution trace step log */}
      <div 
        style={{
          maxHeight: "90px",
          overflowY: "auto",
          background: "#f1f5f9",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          padding: "8px",
          fontFamily: "monospace",
          fontSize: "0.72rem",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>Waiting for orchestrator query...</span>
        ) : (
          logs.map((log, idx) => (
            <div 
              key={idx} 
              style={{ 
                color: log.includes("Cache Hit") || log.includes("Success") || log.includes("completed") || log.includes("Passed")
                  ? "var(--success)"
                  : log.includes("Self-Correcting") || log.includes("hallucination")
                  ? "var(--warning)"
                  : "var(--text-primary)" 
              }}
            >
              &gt; {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
