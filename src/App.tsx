import React, { useState } from "react";
import { AudioUploader } from "./components/AudioUploader/AudioUploader";
import { Player } from "./components/Player/Player";
import { DrumScore } from "./components/DrumScore/DrumScore";
import { MetronomeVisual } from "./components/MetronomeVisual/MetronomeVisual";
import { analyzeAudio } from "./services/audioAnalyzer";
import { generateScore } from "./services/scoreGenerator";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { AnalysisResult } from "./types";

interface AudioFiles {
  drum: File | null;
  drumBuffer: AudioBuffer | null;
  song?: File | null;
  songBuffer?: AudioBuffer | null;
}

function App() {
  const [drumBuffer, setDrumBuffer] = useState<AudioBuffer | null>(null);
  const [songBuffer, setSongBuffer] = useState<AudioBuffer | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [drumFileName, setDrumFileName] = useState<string>("");
  const [songFileName, setSongFileName] = useState<string>("");
  const [focusSection, setFocusSection] = useState<{ startMs: number; endMs: number } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cleanMode, setCleanMode] = useState(false);
  const [minDistance, setMinDistance] = useState(180);
  const [zenMode, setZenMode] = useState(false);

  // Usar el buffer de la canción si existe, sino la batería
  const playbackBuffer = songBuffer || drumBuffer;
  const audioPlayback = useAudioPlayback(playbackBuffer);
  const score = React.useMemo(() => (analysis ? generateScore(analysis) : null), [analysis]);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZenMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAudioLoaded = async (files: AudioFiles) => {
    if (!files.drumBuffer) return;

    setDrumBuffer(files.drumBuffer);
    setDrumFileName(files.drum?.name || "");
    setSongBuffer(files.songBuffer || null);
    setSongFileName(files.song?.name || "");
    setIsAnalyzing(true);

    try {
      setAnalysisError(null);
      // Analizar siempre la batería para la partitura
      const result = await analyzeAudio(files.drumBuffer);
      setAnalysis(result);
    } catch (error) {
      console.error("Error analyzing audio:", error);
      setAnalysisError(
        "Hubo un problema al analizar el audio. Intenta con un archivo más corto o de mejor calidad.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    audioPlayback.stop();
    setDrumBuffer(null);
    setSongBuffer(null);
    setAnalysis(null);
    setDrumFileName("");
    setSongFileName("");
    setFocusSection(null);
  };

  // Pantalla de carga
  if (!drumBuffer || !analysis || !score) {
    return (
      <AudioUploader
        onAudioLoaded={handleAudioLoaded}
        isLoading={isAnalyzing}
        externalError={analysisError}
      />
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col bg-bg-darker transition-all duration-500`}>
      {!zenMode && (
        <header className="p-6 bg-bg-dark/80 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Drumia Logo" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                DRUMIA
              </h1>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium min-w-[70px]">Batería:</span>
                <span className="text-white font-medium max-w-[200px] sm:max-w-[300px] truncate">
                  {drumFileName}
                </span>
              </div>
              {songFileName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium min-w-[70px]">Canción:</span>
                  <span className="text-white font-medium max-w-[200px] sm:max-w-[300px] truncate">
                    {songFileName}
                  </span>
                </div>
              )}
              <span className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">
                {analysis.bpm} BPM • {analysis.timeSignature}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all text-xs font-bold"
              onClick={() => setZenMode(true)}
            >
              📺 MODO ZEN
            </button>
            {cleanMode && (
              <div className="flex items-center gap-3 bg-bg-dark/50 px-3 py-1.5 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">
                  Margen: {minDistance}ms
                </span>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="10"
                  value={minDistance}
                  onChange={(e) => setMinDistance(parseInt(e.target.value))}
                  className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold ${
                cleanMode
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-gray-800/40 border-gray-700 text-gray-400"
              }`}
              onClick={() => setCleanMode(!cleanMode)}
            >
              {cleanMode ? "✨ MODO CORRECTIVO ON" : "🧹 MODO CORRECTIVO OFF"}
            </button>
            <button
              className="px-4 py-2 bg-primary/10 text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-all text-sm font-medium"
              onClick={handleReset}
            >
              Nueva canción
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 flex items-center justify-center p-4 sm:p-6 ${zenMode ? 'py-10' : ''}`}>
        <div className={`w-full max-w-[1600px] flex flex-col gap-6 transition-all duration-700 ${zenMode ? 'scale-105' : ''}`}>
          {zenMode && (
            <div className="flex justify-between items-center px-4 animate-[fadeIn_0.8s_ease-out]">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Drumia Logo" className="w-8 h-8 object-contain opacity-50" />
                <span className="text-gray-600 text-[10px] font-bold tracking-[0.2em] uppercase">Zen Practice Mode</span>
              </div>
              <button 
                onClick={() => setZenMode(false)}
                className="text-gray-500 hover:text-white text-xs font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all"
              >
                ESC PARA SALIR
              </button>
            </div>
          )}

          {!zenMode && (
            <MetronomeVisual
              currentTime={audioPlayback.currentTime}
              bpm={analysis.bpm}
              timeSignature={analysis.timeSignature}
            />
          )}

          <DrumScore
            score={score!}
            getCurrentTime={audioPlayback.getCurrentTime}
            bpm={analysis.bpm}
            focusSection={focusSection}
            cleanMode={cleanMode}
            minDistance={minDistance}
          />

          <Player
            isPlaying={audioPlayback.isPlaying}
            currentTime={audioPlayback.currentTime}
            duration={audioPlayback.duration}
            speed={audioPlayback.speed}
            onPlayClick={audioPlayback.play}
            onPauseClick={audioPlayback.pause}
            onSeek={audioPlayback.seek}
            onSpeedChange={audioPlayback.changeSpeed}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
