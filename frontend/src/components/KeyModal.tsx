"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, X, Server, Shield, Database, Eye, EyeOff, CheckCircle } from "lucide-react";

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: {
    gemini: string;
    openai: string;
    groq: string;
    upstash_url: string;
    upstash_token: string;
    langchain_tracing: boolean;
    langchain_api_key: string;
    langchain_project: string;
  }) => void;
}

export default function KeyModal({ isOpen, onClose, onSave }: KeyModalProps) {
  const [gemini, setGemini] = useState("");
  const [openai, setOpenai] = useState("");
  const [groq, setGroq] = useState("");
  const [upstashUrl, setUpstashUrl] = useState("");
  const [upstashToken, setUpstashToken] = useState("");
  
  // LangSmith Configs
  const [langchainTracing, setLangchainTracing] = useState(false);
  const [langchainApiKey, setLangchainApiKey] = useState("");
  const [langchainProject, setLangchainProject] = useState("ragops-engine");

  // Show/Hide password states
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showUpstash, setShowUpstash] = useState(false);
  const [showLangsmith, setShowLangsmith] = useState(false);

  // Load keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setGemini(localStorage.getItem("ragops_gemini_key") || "");
      setOpenai(localStorage.getItem("ragops_openai_key") || "");
      setGroq(localStorage.getItem("ragops_groq_key") || "");
      setUpstashUrl(localStorage.getItem("ragops_upstash_url") || "");
      setUpstashToken(localStorage.getItem("ragops_upstash_token") || "");
      
      setLangchainTracing(localStorage.getItem("ragops_langchain_tracing") === "true");
      setLangchainApiKey(localStorage.getItem("ragops_langchain_api_key") || "");
      setLangchainProject(localStorage.getItem("ragops_langchain_project") || "ragops-engine");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to localStorage
    localStorage.setItem("ragops_gemini_key", gemini);
    localStorage.setItem("ragops_openai_key", openai);
    localStorage.setItem("ragops_groq_key", groq);
    localStorage.setItem("ragops_upstash_url", upstashUrl);
    localStorage.setItem("ragops_upstash_token", upstashToken);
    
    localStorage.setItem("ragops_langchain_tracing", langchainTracing ? "true" : "false");
    localStorage.setItem("ragops_langchain_api_key", langchainApiKey);
    localStorage.setItem("ragops_langchain_project", langchainProject);

    onSave({
      gemini,
      openai,
      groq,
      upstash_url: upstashUrl,
      upstash_token: upstashToken,
      langchain_tracing: langchainTracing,
      langchain_api_key: langchainApiKey,
      langchain_project: langchainProject
    });
    
    onClose();
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all locally saved credentials?")) {
      localStorage.removeItem("ragops_gemini_key");
      localStorage.removeItem("ragops_openai_key");
      localStorage.removeItem("ragops_groq_key");
      localStorage.removeItem("ragops_upstash_url");
      localStorage.removeItem("ragops_upstash_token");
      localStorage.removeItem("ragops_langchain_tracing");
      localStorage.removeItem("ragops_langchain_api_key");
      localStorage.removeItem("ragops_langchain_project");
      
      setGemini("");
      setOpenai("");
      setGroq("");
      setUpstashUrl("");
      setUpstashToken("");
      setLangchainTracing(false);
      setLangchainApiKey("");
      setLangchainProject("ragops-engine");
      
      onSave({
        gemini: "",
        openai: "",
        groq: "",
        upstash_url: "",
        upstash_token: "",
        langchain_tracing: false,
        langchain_api_key: "",
        langchain_project: "ragops-engine"
      });
      
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ zIndex: 1000 }}
        >
          <motion.div 
            className="modal-content" 
            initial={{ y: -30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              maxHeight: "85vh", 
              width: "100%", 
              maxWidth: "500px" 
            }}
          >
            {/* Modal Header */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "20px 24px", 
              borderBottom: "1px solid var(--card-border)",
              background: "#ffffff"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ 
                  background: "var(--primary-light)", 
                  color: "var(--primary)", 
                  padding: "6px", 
                  borderRadius: "8px" 
                }}>
                  <Key size={18} />
                </div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-primary)" }}>Credentials Config</h2>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "var(--text-secondary)", 
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  borderRadius: "50%",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Form */}
            <form onSubmit={handleSubmit} style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "16px", 
              overflowY: "auto", 
              padding: "24px",
              background: "rgba(255, 255, 255, 0.4)"
            }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", lineHeight: "1.4" }}>
                Configure environment API keys. Credentials are saved **only in your local browser storage** and are never sent to any external server besides your own FastAPI local instance.
              </p>

              {/* LLM Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontSize: "0.78rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Shield size={12} /> Model Provider Keys
                </h3>

                {/* Gemini API Key */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                    Gemini API Key
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showGemini ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={gemini}
                      onChange={(e) => setGemini(e.target.value)}
                      className="text-input"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGemini(!showGemini)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      {showGemini ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* OpenAI API Key */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                    OpenAI API Key
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showOpenai ? "text" : "password"}
                      placeholder="sk-proj-..."
                      value={openai}
                      onChange={(e) => setOpenai(e.target.value)}
                      className="text-input"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      {showOpenai ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Groq API Key */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                    Groq API Key
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showGroq ? "text" : "password"}
                      placeholder="gsk_..."
                      value={groq}
                      onChange={(e) => setGroq(e.target.value)}
                      className="text-input"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroq(!showGroq)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      {showGroq ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Upstash Cache Section */}
              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={{ fontSize: "0.78rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Database size={12} /> Semantic Cache (Upstash Redis)
                </h3>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                    REST URL
                  </label>
                  <input 
                    type="text"
                    placeholder="https://your-database.upstash.io"
                    value={upstashUrl}
                    onChange={(e) => setUpstashUrl(e.target.value)}
                    className="text-input"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                    REST Token
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showUpstash ? "text" : "password"}
                      placeholder="Upstash Token..."
                      value={upstashToken}
                      onChange={(e) => setUpstashToken(e.target.value)}
                      className="text-input"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowUpstash(!showUpstash)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      {showUpstash ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  If left blank, the server will fallback to a fast in-memory query cache.
                </span>
              </div>

              {/* LangSmith Tracing Section */}
              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "0.78rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Server size={12} /> Observability (LangSmith)
                  </h3>
                  <label className="switch-container">
                    <input 
                      type="checkbox" 
                      checked={langchainTracing} 
                      onChange={(e) => setLangchainTracing(e.target.checked)}
                      className="switch-input"
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
                
                <AnimatePresence>
                  {langchainTracing && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                          LangSmith API Key
                        </label>
                        <div style={{ position: "relative" }}>
                          <input 
                            type={showLangsmith ? "text" : "password"}
                            placeholder="lsv2_pt_..."
                            value={langchainApiKey}
                            onChange={(e) => setLangchainApiKey(e.target.value)}
                            className="text-input"
                            style={{ paddingRight: "40px" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowLangsmith(!showLangsmith)}
                            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                          >
                            {showLangsmith ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                          Project Name
                        </label>
                        <input 
                          type="text"
                          placeholder="ragops-engine"
                          value={langchainProject}
                          onChange={(e) => setLangchainProject(e.target.value)}
                          className="text-input"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  Streams complete hierarchical traces, evaluation grades, and latency graphs to your LangSmith account.
                </span>
              </div>
            </form>

            {/* Modal Footer */}
            <div style={{ 
              display: "flex", 
              gap: "12px", 
              padding: "20px 24px", 
              borderTop: "1px solid var(--card-border)",
              background: "#ffffff"
            }}>
              <button 
                type="submit" 
                onClick={handleSubmit} 
                className="button-primary" 
                style={{ flex: 1 }}
              >
                <CheckCircle size={15} /> Save Credentials
              </button>
              <button 
                type="button" 
                onClick={handleClear} 
                className="button-secondary"
                style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.2)" }}
              >
                Clear All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
