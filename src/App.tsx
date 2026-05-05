import React, { useState } from "react";
import { AudioUploader } from "./components/AudioUploader/AudioUploader";
import { Player } from "./components/Player/Player";
import { DrumScore } from "./components/DrumScore/DrumScore";
import { MetronomeVisual } from "./components/MetronomeVisual/MetronomeVisual";
import { SongStructureComponent } from "./components/SongStructure/SongStructure";
import { analyzeAudio } from "./services/audioAnalyzer";
import { generateScore } from "./services/scoreGenerator";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { AnalysisResult, DrumEventType } from "./types";
import { SongStructure } from "./services/songStructureParser";

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

  // Usar el buffer de la canción si existe, sino la batería
  const playbackBuffer = songBuffer || drumBuffer;
  const audioPlayback = useAudioPlayback(playbackBuffer);
  const storage = useLocalStorage();
  const score = React.useMemo(() => analysis ? generateScore(analysis) : null, [analysis]);

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
      setAnalysisError("Hubo un problema al analizar el audio. Intenta con un archivo más corto o de mejor calidad.");
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

  const handleFocusSectionChange = (startMs: number, endMs: number) => {
    setFocusSection({ startMs, endMs });
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
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-bg-darker to-bg-dark">
      <header className="p-6 bg-bg-dark/80 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
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
        <button
          className="px-4 py-2 bg-primary/10 text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-all text-sm font-medium"
          onClick={handleReset}
        >
          Nueva canción
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[1200px] flex flex-col gap-6">
          <MetronomeVisual
            currentTime={audioPlayback.currentTime}
            bpm={analysis.bpm}
            timeSignature={analysis.timeSignature}
          />

          <DrumScore
            score={score!}
            getCurrentTime={audioPlayback.getCurrentTime}
            bpm={analysis.bpm}
            focusSection={focusSection}
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
