"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Crown, Database, Shuffle, Wand2, Search, 
  Zap, Sparkles, ShieldCheck, RefreshCw, Terminal, Cpu 
} from "lucide-react";

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

  // Animating nodes helper
  const getNodeAnimate = (nodeId: string, baseClass = "") => {
    const isActive = activeAgent === nodeId;
    if (isActive) {
      return {
        scale: [1, 1.05, 1],
        borderColor: baseClass.includes("success") 
          ? ["#10b981", "#34d399", "#10b981"] 
          : baseClass.includes("warning")
          ? ["#f59e0b", "#fbbf24", "#f59e0b"]
          : baseClass.includes("danger")
          ? ["#ef4444", "#f87171", "#ef4444"]
          : ["#3b82f6", "#60a5fa", "#3b82f6"],
        boxShadow: baseClass.includes("success")
          ? ["0 0 0 rgba(16, 185, 129, 0)", "0 0 16px rgba(16, 185, 129, 0.4)", "0 0 0 rgba(16, 185, 129, 0)"]
          : baseClass.includes("warning")
          ? ["0 0 0 rgba(245, 158, 11, 0)", "0 0 16px rgba(245, 158, 11, 0.4)", "0 0 0 rgba(245, 158, 11, 0)"]
          : baseClass.includes("danger")
          ? ["0 0 0 rgba(239, 68, 68, 0)", "0 0 16px rgba(239, 68, 68, 0.4)", "0 0 0 rgba(239, 68, 68, 0)"]
          : ["0 0 0 rgba(59, 130, 246, 0)", "0 0 16px rgba(59, 130, 246, 0.4)", "0 0 0 rgba(59, 130, 246, 0)"]
      };
    }
    return { scale: 1 };
  };

  return (
    <div className="sleek-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ 
          fontSize: "0.85rem", 
          fontWeight: "700", 
          textTransform: "uppercase", 
          letterSpacing: "0.05em", 
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <Cpu size={16} style={{ color: "var(--primary)" }} /> Multi-Agent Orchestrator
        </h4>
        <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>Supervisor Workflow</span>
      </div>

      {/* SVG Canvas Area Centered for perfect coordinates */}
      <div style={{ display: "flex", justifyContent: "center", background: "#f8fafc", borderRadius: "16px", border: "1px solid var(--card-border)", overflow: "hidden" }}>
        <div style={{ position: "relative", width: "520px", height: "270px" }}>
          
          {/* SVG connection lines representing orchestrator coordination */}
          <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, zIndex: 0 }}>
            
            {/* Supervisor -> Cache Agent */}
            <path 
              d="M 210 130 L 115 130" 
              className={`connection-line ${isCacheChecked ? "active success" : ""}`}
              strokeWidth="1.5"
            />

            {/* Supervisor -> Router Agent */}
            <path 
              d="M 235 120 L 315 80" 
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
              d="M 235 140 L 315 180" 
              className={`connection-line ${isCacheMiss ? "active" : ""}`}
              strokeWidth="1.5"
            />

            {/* Hybrid Retriever -> Cheap LLM */}
            <path 
              d="M 395 180 Q 450 180 450 80" 
              fill="transparent"
              className={`connection-line ${isCheapAgentUsed ? "active" : ""}`}
              strokeWidth="1.5"
            />

            {/* Hybrid Retriever -> Expensive LLM */}
            <path 
              d="M 395 180 Q 450 200 450 230" 
              fill="transparent"
              className={`connection-line ${isExpensiveAgentUsed ? "active" : ""}`}
              strokeWidth="1.5"
            />

            {/* Cheap LLM -> Critic Agent */}
            <path 
              d="M 450 80 Q 235 50 210 105" 
              fill="transparent"
              className={`connection-line ${isCheapAgentUsed ? "active" : ""}`}
              strokeWidth="1.5"
            />

            {/* Expensive LLM -> Critic Agent */}
            <path 
              d="M 450 230 Q 235 250 210 155" 
              fill="transparent"
              className={`connection-line ${isExpensiveAgentUsed ? "active" : ""}`}
              strokeWidth="1.5"
            />

            {/* Critic Grader -> Cache Write (Success) */}
            <path 
              d="M 115 65 L 75 105" 
              className={`connection-line ${isSuccessActive && !cacheHit ? "active success" : ""}`}
              strokeWidth="1.5"
            />

            {/* Critic Grader -> Self-Correction Retry Node */}
            <path 
              d="M 75 155 Q 75 220 160 220" 
              fill="transparent"
              className={`connection-line ${isRetryActive ? "active warning" : ""}`}
              strokeWidth="1.5"
            />

            {/* Self-Correction -> Hybrid Retriever (Re-Search loop) */}
            <path 
              d="M 235 220 L 315 180" 
              className={`connection-line ${isRetryActive ? "active warning" : ""}`}
              strokeWidth="1.5"
            />

          </svg>

          {/* Node Cards (Representing Active Agents) */}

          {/* 1. SUPERVISOR ORCHESTRATOR AGENT (Center Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "supervisor" ? "active" : ""}`}
            animate={getNodeAnimate("supervisor")}
            transition={{ repeat: Infinity, duration: 2 }}
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
              fontSize: "1.1rem",
              color: "var(--primary)",
              zIndex: 10,
              cursor: "pointer"
            }}
          >
            <Crown size={22} style={{ color: activeAgent === "supervisor" ? "var(--primary)" : "var(--text-secondary)" }} />
          </motion.div>
          <div style={{ position: "absolute", left: "175px", top: "158px", fontSize: "0.62rem", fontWeight: "700", color: "var(--text-secondary)", width: "70px", textAlign: "center", textTransform: "uppercase" }}>
            Supervisor
          </div>

          {/* 2. CACHE AGENT (Left Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "cache_agent" ? "active" : ""} ${isCacheHit ? "success" : ""}`}
            animate={getNodeAnimate("cache_agent", isCacheHit ? "success" : "")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "20px",
              top: "110px",
              width: "95px",
              height: "44px",
              padding: "4px 8px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              zIndex: 2,
              cursor: "pointer"
            }}
          >
            <Database size={15} style={{ color: isCacheHit ? "var(--success)" : "var(--text-secondary)" }} />
            <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: "700" }}>Cache Agent</span>
              <span style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: "600" }}>
                {cacheHit ? "HIT ($0)" : isCacheMiss ? "MISS" : "Upstash"}
              </span>
            </div>
          </motion.div>

          {/* 3. ROUTER AGENT (Top Right Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "router_agent" ? "active" : ""}`}
            animate={getNodeAnimate("router_agent")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "315px",
              top: "60px",
              width: "80px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.65rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <Shuffle size={12} style={{ color: "var(--primary)" }} />
            <span>Router</span>
          </motion.div>

          {/* 4. HyDE QUERY TRANSFORMER AGENT (Middle Right Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "hyde_agent" ? "active" : ""}`}
            animate={getNodeAnimate("hyde_agent")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "315px",
              top: "112px",
              width: "80px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.65rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <Wand2 size={12} style={{ color: "#a855f7" }} />
            <span>HyDE Agent</span>
          </motion.div>

          {/* 5. HYBRID RETRIEVER AGENT (Bottom Right Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "retriever_agent" ? "active" : ""}`}
            animate={getNodeAnimate("retriever_agent")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "315px",
              top: "164px",
              width: "80px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.65rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <Search size={12} style={{ color: "var(--success)" }} />
            <span style={{ color: "var(--success)" }}>Retriever</span>
          </motion.div>

          {/* 6. CHEAP GENERATION AGENT (Top Right corner) */}
          <motion.div 
            className={`node-card ${activeAgent === "cheap_agent" ? "active" : ""}`}
            animate={getNodeAnimate("cheap_agent")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "415px",
              top: "40px",
              width: "85px",
              height: "38px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.65rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <Zap size={12} style={{ color: "#7c3aed" }} />
            <span style={{ color: "#7c3aed" }}>Fast Agent</span>
          </motion.div>

          {/* 7. EXPENSIVE GENERATION AGENT (Bottom Right corner) */}
          <motion.div 
            className={`node-card ${activeAgent === "expensive_agent" ? "active" : ""}`}
            animate={getNodeAnimate("expensive_agent")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "415px",
              top: "210px",
              width: "90px",
              height: "38px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.65rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <Sparkles size={12} style={{ color: "#d97706" }} />
            <span style={{ color: "#d97706" }}>Premium L4</span>
          </motion.div>

          {/* 8. CRITIC GRADER AGENT (Top Left corner) */}
          <motion.div 
            className={`node-card ${activeAgent === "critic_agent" ? "active" : ""} ${isRetryActive ? "danger" : (isSuccessActive && !cacheHit ? "success" : "")}`}
            animate={getNodeAnimate("critic_agent", isRetryActive ? "danger" : (isSuccessActive && !cacheHit ? "success" : ""))}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "20px",
              top: "40px",
              width: "95px",
              height: "44px",
              padding: "4px 8px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              zIndex: 2
            }}
          >
            <ShieldCheck size={15} style={{ 
              color: isRetryActive 
                ? "var(--danger)" 
                : (isSuccessActive && !cacheHit ? "var(--success)" : "var(--text-secondary)") 
            }} />
            <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: "700" }}>Critic Grader</span>
              <span style={{ fontSize: "0.52rem", color: "var(--text-muted)" }}>
                {isRetryActive ? "REJECTED" : (isSuccessActive && !cacheHit ? "APPROVED" : "Pending")}
              </span>
            </div>
          </motion.div>

          {/* 9. SELF-CORRECTION AGENT (Bottom Node) */}
          <motion.div 
            className={`node-card ${activeAgent === "retry_node" ? "active warning" : ""}`}
            animate={getNodeAnimate("retry_node")}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: "absolute",
              left: "160px",
              top: "200px",
              width: "95px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "0.62rem",
              fontWeight: "700",
              zIndex: 2
            }}
          >
            <RefreshCw size={11} style={{ color: "var(--warning)" }} />
            <span style={{ color: "var(--warning)" }}>Self-Correction</span>
          </motion.div>

        </div>
      </div>

      {/* Waterfall execution trace step log */}
      <div 
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#1e293b",
          borderRadius: "12px",
          padding: "12px 16px",
          border: "1px solid #334155"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #334155", paddingBottom: "6px", marginBottom: "4px" }}>
          <Terminal size={14} style={{ color: "var(--success)" }} />
          <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Live Engine Logs Trace Console
          </span>
        </div>
        <div 
          style={{
            maxHeight: "90px",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "0.72rem",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            lineHeight: "1.4"
          }}
        >
          {logs.length === 0 ? (
            <span style={{ color: "#64748b" }}>&gt; Waiting for active query logs...</span>
          ) : (
            logs.map((log, idx) => (
              <div 
                key={idx} 
                style={{ 
                  color: log.includes("Cache Hit") || log.includes("Success") || log.includes("completed") || log.includes("Passed")
                    ? "#34d399"
                    : log.includes("Self-Correcting") || log.includes("hallucination") || log.includes("retry")
                    ? "#fbbf24"
                    : "#cbd5e1" 
                }}
              >
                &gt; {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
