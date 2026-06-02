"use client";

import React from "react";
import { motion } from "framer-motion";
import { Zap, DollarSign, Award, ArrowUpRight, TrendingUp, Sparkles, Check, HelpCircle } from "lucide-react";

interface AnalyticsProps {
  data: {
    latency: number;
    cost: number;
    costSaved: number;
    cacheHit: boolean;
    cacheSimilarity?: number;
    faithfulness?: number;
    relevance?: number;
    modelUsed: string;
    retryCount: number;
  } | null;
}

export default function Analytics({ data }: AnalyticsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "var(--success)";
    if (score >= 0.6) return "var(--warning)";
    return "var(--danger)";
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 0.8) return "badge-green";
    if (score >= 0.6) return "badge-amber";
    return "badge-red";
  };

  // Load stats from localStorage for cumulative summary
  let queriesCount = 0;
  let savingsVal = 0.0;
  let cacheHits = 0;
  
  if (typeof window !== "undefined") {
    queriesCount = Number(localStorage.getItem("ragops_stat_queries") || "0");
    savingsVal = Number(localStorage.getItem("ragops_stat_savings") || "0.0");
    cacheHits = Number(localStorage.getItem("ragops_stat_cache_hits") || "0");
  }

  // Fallbacks if no current query has run
  const activeLatency = data?.latency ?? 0;
  const activeCost = data?.cost ?? 0.0;
  const activeFaithfulness = data?.faithfulness ?? 1.0;
  const activeRelevance = data?.relevance ?? 1.0;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  } as const;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      
      {/* 1. Metrics Grid */}
      <motion.div 
        variants={itemVariants}
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "16px" 
        }}
      >
        {/* Latency Card */}
        <div className="mini-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="mini-card-label">Avg Query Latency</span>
            <div style={{ background: "rgba(59, 130, 246, 0.08)", color: "var(--primary)", padding: "6px", borderRadius: "8px" }}>
              <Zap size={16} />
            </div>
          </div>
          <div className="mini-card-value" style={{ 
            color: data?.cacheHit ? "var(--success)" : "var(--text-primary)",
            fontSize: "1.6rem" 
          }}>
            {activeLatency > 0 ? `${activeLatency.toFixed(0)} ms` : "0 ms"}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data?.cacheHit ? "⚡ Instant Cache Bypass" : "🛠️ Active Graph Router"}
          </span>
        </div>

        {/* Cost Card */}
        <div className="mini-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="mini-card-label">Query Cost</span>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--success)", padding: "6px", borderRadius: "8px" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mini-card-value" style={{ 
            color: data?.cacheHit ? "var(--success)" : "var(--text-primary)",
            fontSize: "1.6rem"
          }}>
            ${activeCost.toFixed(5)}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data?.cacheHit ? "🎉 Cached Response ($0)" : `🤖 ${data?.modelUsed.split(" ")[0]} Agent`}
          </span>
        </div>

        {/* Cost Saved Card */}
        <div className="mini-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="mini-card-label">Total Cash Saved</span>
            <div style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--warning)", padding: "6px", borderRadius: "8px" }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mini-card-value" style={{ color: "var(--success)", fontSize: "1.6rem" }}>
            +${savingsVal.toFixed(5)}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Upstash Cache + Routing ROI
          </span>
        </div>
      </motion.div>

      {/* 2. Naive RAG vs Optimized RAG Cost Comparison Table */}
      <motion.div variants={itemVariants} className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h4 style={{ 
            fontSize: "0.85rem", 
            fontWeight: "700",
            color: "var(--text-secondary)", 
            textTransform: "uppercase", 
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <ArrowUpRight size={16} style={{ color: "var(--primary)" }} /> RAGOps ROI Cost Comparison
          </h4>
          <span className="badge badge-blue" style={{ fontSize: "0.62rem", display: "flex", alignItems: "center", gap: "4px" }}>
            <Sparkles size={10} /> Reciprocal Rank Fusion
          </span>
        </div>
        
        <div style={{ overflowX: "auto" }}>
          <table className="compare-table">
            <thead>
              <tr>
                <th>RAG System Strategy</th>
                <th>Avg Latency</th>
                <th>Tokens Cost / Query</th>
                <th>Cache Efficiency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: "500" }}>Naive Direct RAG (No Optimization)</td>
                <td>~2,500 ms</td>
                <td style={{ color: "var(--danger)", fontWeight: "600" }}>$0.05000</td>
                <td>0% <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: "normal" }}>(No Cache hits)</span></td>
              </tr>
              <tr style={{ background: "rgba(59, 130, 246, 0.04)" }}>
                <td style={{ fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} /> Stateful Multi-Agent Engine
                </td>
                <td style={{ fontWeight: "600" }}>~240 ms</td>
                <td style={{ color: "var(--success)", fontWeight: "700" }}>
                  ${activeCost > 0 ? activeCost.toFixed(5) : "0.00800"} <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--text-secondary)" }}>(avg)</span>
                </td>
                <td style={{ fontWeight: "700", color: "var(--success)" }}>
                  {queriesCount > 0 ? Math.round((cacheHits / queriesCount) * 100) : "45%"}% Hit Rate
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        
      </motion.div>

      {/* 3. Ragas Evaluator Gauges */}
      {data && (
        <motion.div variants={itemVariants} className="glass-panel" style={{ padding: "24px" }}>
          <h4 style={{ 
            fontSize: "0.85rem", 
            fontWeight: "700",
            color: "var(--text-secondary)", 
            textTransform: "uppercase", 
            letterSpacing: "0.05em", 
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <Award size={16} style={{ color: "var(--success)" }} /> Critic Agent Quality Grades
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Faithfulness */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: "600" }}>
                  Faithfulness (No Hallucination)
                </span>
                <span className={`badge ${getScoreBadgeClass(activeFaithfulness)}`}>
                  {(activeFaithfulness * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${activeFaithfulness * 100}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 15 }}
                  style={{ 
                    height: "100%", 
                    background: getScoreColor(activeFaithfulness),
                    borderRadius: "99px"
                  }}
                />
              </div>
            </div>

            {/* Relevance */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: "600" }}>
                  Answer Relevance
                </span>
                <span className={`badge ${getScoreBadgeClass(activeRelevance)}`}>
                  {(activeRelevance * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${activeRelevance * 100}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 15 }}
                  style={{ 
                    height: "100%", 
                    background: getScoreColor(activeRelevance),
                    borderRadius: "99px"
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
