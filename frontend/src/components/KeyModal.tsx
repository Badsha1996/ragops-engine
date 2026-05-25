"use client";

import React, { useState, useEffect } from "react";

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

  if (!isOpen) return null;

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
    if (confirm("Are you sure you want to clear all locally saved keys?")) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-panel modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "24px", border: "1px solid #cbd5e1" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>Credentials & Configuration</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: "none", 
              border: "none", 
              color: "var(--text-secondary)", 
              fontSize: "1.5rem", 
              cursor: "pointer" 
            }}
          >
            &times;
          </button>
        </div>
        
        <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "18px", lineHeight: "1.4" }}>
          Configure API credentials. Keys are saved <strong>only in LocalStorage</strong> and used to communicate with your local uvicorn backend.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "70vh", overflowY: "auto", paddingRight: "4px" }}>
          
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
              Gemini API Key
            </label>
            <input 
              type="password"
              placeholder="AIzaSy..."
              value={gemini}
              onChange={(e) => setGemini(e.target.value)}
              className="text-input"
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
              Enables Gemini Flash & Gemini Pro execution
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
              OpenAI API Key
            </label>
            <input 
              type="password"
              placeholder="sk-proj-..."
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              className="text-input"
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
              Enables GPT-4o & OpenAI Embeddings
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
              Groq API Key
            </label>
            <input 
              type="password"
              placeholder="gsk_..."
              value={groq}
              onChange={(e) => setGroq(e.target.value)}
              className="text-input"
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
              Enables Llama 3 (Groq) fast agents
            </span>
          </div>

          {/* LangSmith Observability */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: "600" }}>🛡️ LangSmith Tracing</h3>
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
            
            {langchainTracing && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "2px" }}>
                    LangSmith API Key
                  </label>
                  <input 
                    type="password"
                    placeholder="lsv2_pt_..."
                    value={langchainApiKey}
                    onChange={(e) => setLangchainApiKey(e.target.value)}
                    className="text-input"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "2px" }}>
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
              </div>
            )}
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Sends agent graph steps, timings, and token metrics to your LangSmith Dashboard.
            </span>
          </div>

          {/* Upstash Redis */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "4px" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "8px" }}>⚡ Upstash Redis Cache</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <input 
                  type="text"
                  placeholder="Upstash Redis REST URL"
                  value={upstashUrl}
                  onChange={(e) => setUpstashUrl(e.target.value)}
                  className="text-input"
                  style={{ fontSize: "0.8rem" }}
                />
              </div>
              <div>
                <input 
                  type="password"
                  placeholder="Upstash Redis REST Token"
                  value={upstashToken}
                  onChange={(e) => setUpstashToken(e.target.value)}
                  className="text-input"
                />
              </div>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Powers serverless semantic caching. If blank, the app runs on a local memory-based cache.
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <button type="submit" className="button-primary" style={{ flex: 1 }}>
              Save Credentials
            </button>
            <button 
              type="button" 
              onClick={handleClear} 
              className="button-secondary"
              style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }}
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
