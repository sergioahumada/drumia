import React, { useState } from 'react';
import {
  initGemini,
  analyzeWithGemini,
  generatePracticeFeedback,
  generateDrumPattern,
  DetectionEvent,
} from '../../services/geminiAnalyzer';
import './GeminiAnalysis.css';

interface GeminiAnalysisProps {
  events: DetectionEvent[];
  bpm: number;
  duration: number;
  songName?: string;
}

type AnalysisTab = 'feedback' | 'practice' | 'pattern';

export function GeminiAnalysis({
  events,
  bpm,
  duration,
  songName,
}: GeminiAnalysisProps) {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('feedback');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [patternStyle, setPatternStyle] = useState('rock');

  const handleConfigureGemini = () => {
    if (apiKey.trim()) {
      initGemini(apiKey);
      setIsConfigured(true);
    }
  };

  const handleAnalyze = async () => {
    if (!isConfigured) {
      alert('Por favor configura tu API key de Gemini primero');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'feedback') {
        const result = await analyzeWithGemini(events, bpm, duration, songName);
        setAnalysis(result.feedback + '\n\n' + result.patternAnalysis);
      } else if (activeTab === 'practice') {
        const feedback = await generatePracticeFeedback(events, bpm, difficulty);
        setAnalysis(feedback);
      } else if (activeTab === 'pattern') {
        const pattern = await generateDrumPattern(bpm, difficulty, patternStyle);
        setAnalysis(pattern);
      }
    } catch (error) {
      setAnalysis('Error en el análisis. Verifica tu API key.');
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="gemini-setup">
        <div className="setup-card">
          <h3>🤖 Integración con Gemini Flash 2.5</h3>
          <p>Obtén análisis inteligente de tu patrón de batería con IA</p>

          <div className="setup-form">
            <label>API Key de Google Gemini:</label>
            <input
              type="password"
              placeholder="Pega tu API key aquí..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <small>
              Obtén una gratis en{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
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
              <li>✨ Análisis inteligente de patrones</li>
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
        <h3>🤖 Análisis Inteligente con Gemini</h3>
        <button onClick={() => setIsConfigured(false)} className="disconnect-btn">
          Cambiar API Key
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('feedback');
            setAnalysis('');
          }}
        >
          📊 Análisis
        </button>
        <button
          className={`tab ${activeTab === 'practice' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('practice');
            setAnalysis('');
          }}
        >
          🎯 Práctica
        </button>
        <button
          className={`tab ${activeTab === 'pattern' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('pattern');
            setAnalysis('');
          }}
        >
          🎵 Generar Patrón
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'practice' && (
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

        {activeTab === 'pattern' && (
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

        <button onClick={handleAnalyze} disabled={loading} className="analyze-btn">
          {loading ? '⏳ Analizando...' : '🚀 Generar Análisis'}
        </button>

        {analysis && (
          <div className="analysis-result">
            <div className="result-text">
              {analysis.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
