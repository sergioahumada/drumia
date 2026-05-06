import React, { useState } from "react";
import { AudioUploader } from "./components/AudioUploader/AudioUploader";
import { Player } from "./components/Player/Player";
import { DrumScore } from "./components/DrumScore/DrumScore";
import { analyzeAudio } from "./services/audioAnalyzer";
import { generateScore } from "./services/scoreGenerator";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { AnalysisResult } from "./types";
import { decodeAudioFile, validateAudioFile } from "./services/audioProcessor";

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
  const songInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingSong, setIsUploadingSong] = useState(false);

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

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAudioFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setIsUploadingSong(true);
    try {
      const buffer = await decodeAudioFile(file);
      setSongBuffer(buffer);
      setSongFileName(file.name);
    } catch (err) {
      console.error("Error loading song:", err);
      alert("Error al cargar la canción");
    } finally {
      setIsUploadingSong(false);
      if (songInputRef.current) songInputRef.current.value = "";
    }
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
        <header className="p-6 bg-bg-[#0C0E2A] border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 animate-[fadeIn_0.5s_ease-out]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <img src="/logo_simple.png" alt="Drumia Logo" className="w-10 h-10 object-contain" />
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
              {songFileName ? (
                <div className="flex items-center gap-2 text-xs group relative">
                  <span className="text-gray-500 font-medium min-w-[70px]">Canción:</span>
                  <span className="text-white font-medium max-w-[200px] sm:max-w-[300px] truncate">
                    {songFileName}
                  </span>
                  <button
                    onClick={() => songInputRef.current?.click()}
                    className="ml-2 p-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title="Cambiar canción"
                  >
                    ✏️
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium min-w-[70px]">Canción:</span>
                  <button
                    onClick={() => songInputRef.current?.click()}
                    disabled={isUploadingSong}
                    className="text-primary hover:brightness-125 font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {isUploadingSong ? "Cargando..." : "+ Agregar acompañamiento"}
                  </button>
                </div>
              )}
              <input
                ref={songInputRef}
                type="file"
                accept="audio/*"
                onChange={handleSongUpload}
                className="hidden"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">
                {analysis.bpm} BPM • {analysis.timeSignature}
              </span>
            </div>
          </div>
          <button
            className="px-4 py-2 bg-primary/10 text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-all text-sm font-medium"
            onClick={handleReset}
          >
            Nueva canción
          </button>
        </header>
      )}

      <main
        className={`flex-1 flex items-center justify-center p-4 sm:p-6 ${zenMode ? "py-10" : ""}`}
      >
        <div
          className={`w-full max-w-[1600px] flex flex-col gap-6 transition-all duration-700 ${zenMode ? "scale-105" : ""}`}
        >
          {zenMode ? (
            <div className="flex justify-between items-center px-4 animate-[fadeIn_0.8s_ease-out]">
              <div className="flex items-center gap-4">
                <img
                  src="/logo.png"
                  alt="Drumia Logo"
                  className="w-8 h-8 object-contain opacity-50"
                />
                <span className="text-gray-600 text-[10px] font-bold tracking-[0.2em] uppercase">
                  Zen Practice Mode
                </span>
              </div>
              <button
                onClick={() => setZenMode(false)}
                className="text-gray-500 hover:text-white text-xs font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all"
              >
                ESC PARA SALIR
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-bg-dark/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl animate-[fadeIn_0.8s_ease-out] gap-4 sm:gap-0">
              <div className="flex items-center gap-4 sm:gap-6">
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105 ${
                    cleanMode
                      ? "bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setCleanMode(!cleanMode)}
                >
                  <span className="text-lg">{cleanMode ? "✨" : "🧹"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Modo Correctivo {cleanMode ? "ON" : "OFF"}
                  </span>
                </button>

                {cleanMode && (
                  <div className="flex items-center gap-3 sm:gap-4 sm:pl-6 sm:border-l border-white/10">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                      Margen: {minDistance}ms
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={minDistance}
                      onChange={(e) => setMinDistance(parseInt(e.target.value))}
                      className="w-24 sm:w-32 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary h-1.5"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:block w-px h-8 bg-white/10 mx-2" />
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all hover:scale-105"
                  onClick={() => setZenMode(true)}
                >
                  <span className="text-lg">📺</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Modo Zen</span>
                </button>
              </div>
            </div>
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
