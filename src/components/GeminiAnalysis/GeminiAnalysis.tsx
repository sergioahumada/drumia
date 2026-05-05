import React, { useState, useEffect } from "react";
import {
  initGemini,
  analyzeWithGemini,
  generatePracticeFeedback,
  generateDrumPattern,
  DetectionEvent,
} from "../../services/geminiAnalyzer";
import "./GeminiAnalysis.css";

interface GeminiAnalysisProps {
  events: DetectionEvent[];
  bpm: number;
  duration: number;
  songName?: string;
}

type AnalysisTab = "feedback" | "practice" | "pattern";

export function GeminiAnalysis({ events, bpm, duration, songName }: GeminiAnalysisProps) {
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [isConfigured, setIsConfigured] = useState(() => {
    return !!localStorage.getItem("gemini_api_key");
  });
  const [activeTab, setActiveTab] = useState<AnalysisTab>("feedback");
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [autoAnalysis, setAutoAnalysis] = useState<string>("");
  const [manualAnalysis, setManualAnalysis] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [patternStyle, setPatternStyle] = useState("rock");

  // Auto-análisis cuando hay nuevos eventos
  useEffect(() => {
    if (isConfigured && events.length > 0) {
      performAutoAnalysis();
    }
  }, [events, bpm]); // Solo cuando cambien los eventos o BPM

  const performAutoAnalysis = async () => {
    setAutoAnalyzing(true);
    try {
      const result = await analyzeWithGemini(events, bpm, duration, songName);
      setAutoAnalysis(result.feedback + "\n\n" + result.patternAnalysis);
    } catch (error) {
      console.error("Error en auto-análisis:", error);
    } finally {
      setAutoAnalyzing(false);
    }
  };

  const handleConfigureGemini = () => {
    if (apiKey.trim()) {
      initGemini(apiKey);
      localStorage.setItem("gemini_api_key", apiKey);
      setIsConfigured(true);
    }
  };

  const handleManualAnalyze = async () => {
    if (!isConfigured) {
      alert("Por favor configura tu API key de Gemini primero");
      return;
    }

    setAutoAnalyzing(true);
    try {
      if (activeTab === "feedback") {
        const result = await analyzeWithGemini(events, bpm, duration, songName);
        setManualAnalysis(result.feedback + "\n\n" + result.patternAnalysis);
      } else if (activeTab === "practice") {
        const feedback = await generatePracticeFeedback(events, bpm, difficulty);
        setManualAnalysis(feedback);
      } else if (activeTab === "pattern") {
        const pattern = await generateDrumPattern(bpm, difficulty, patternStyle);
        setManualAnalysis(pattern);
      }
    } catch (error) {
      setManualAnalysis("Error en el análisis. Verifica tu API key.");
    } finally {
      setAutoAnalyzing(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="gemini-setup">
        <div className="setup-card">
          <h3>🤖 Integración con Gemini Flash 2.5</h3>
          <p>Obtén análisis automático e inteligente de tu patrón de batería</p>

          <div className="setup-form">
            <label>API Key de Google Gemini:</label>
            <input
              type="password"
              placeholder="Pega tu API key aquí..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <small>
              Obtén una gratis en{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google AI Studio
              </a>
            </small>

            <button onClick={handleConfigureGemini} className="setup-btn">
              Conectar Gemini
            </button>
          </div>

          <div className="features-list">
            <h4>Características:</h4>
            <ul>
              <li>✨ Análisis automático al cargar audio</li>
              <li>🎯 Retroalimentación de práctica personalizada</li>
              <li>🎵 Generación de nuevos patrones</li>
              <li>💡 Consejos de mejora específicos</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-analysis">
      <div className="gemini-header">
        <div className="header-info">
          <h3>🤖 Análisis Automático con Gemini</h3>
          {autoAnalyzing && <span className="analyzing-indicator">⏳ Analizando...</span>}
        </div>
        <button onClick={() => setIsConfigured(false)} className="disconnect-btn">
          Cambiar API Key
        </button>
      </div>

      {/* Análisis Automático */}
      {autoAnalysis && (
        <div className="auto-analysis-section">
          <h4>📊 Análisis Automático</h4>
          <div className="analysis-result">
            <div className="result-text">
              {autoAnalysis.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Análisis Manual Adicionales */}
      <div className="manual-analysis-section">
        <h4>🎯 Análisis Adicionales</h4>

        <div className="tabs">
          <button
            className={`tab ${activeTab === "feedback" ? "active" : ""}`}
            onClick={() => setActiveTab("feedback")}
          >
            📊 Análisis Detallado
          </button>
          <button
            className={`tab ${activeTab === "practice" ? "active" : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            🎯 Práctica
          </button>
          <button
            className={`tab ${activeTab === "pattern" ? "active" : ""}`}
            onClick={() => setActiveTab("pattern")}
          >
            🎵 Generar Patrón
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "practice" && (
            <div className="options">
              <label>
                Dificultad:
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                  <option value="easy">Fácil</option>
                  <option value="medium">Medio</option>
                  <option value="hard">Difícil</option>
                </select>
              </label>
            </div>
          )}

          {activeTab === "pattern" && (
            <div className="options">
              <label>
                Estilo:
                <select value={patternStyle} onChange={(e) => setPatternStyle(e.target.value)}>
                  <option value="rock">Rock</option>
                  <option value="jazz">Jazz</option>
                  <option value="funk">Funk</option>
                  <option value="blues">Blues</option>
                  <option value="metal">Metal</option>
                  <option value="reggae">Reggae</option>
                </select>
              </label>
            </div>
          )}

          <button onClick={handleManualAnalyze} disabled={autoAnalyzing} className="analyze-btn">
            {autoAnalyzing ? "⏳ Analizando..." : "🚀 Generar Análisis"}
          </button>

          {manualAnalysis && (
            <div className="analysis-result">
              <div className="result-text">
                {manualAnalysis.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
