import React, { useState } from 'react';
import { AudioUploader } from './components/AudioUploader/AudioUploader';
import { Player } from './components/Player/Player';
import { DrumScore } from './components/DrumScore/DrumScore';
import { MetronomeVisual } from './components/MetronomeVisual/MetronomeVisual';
import { analyzeAudio } from './services/audioAnalyzer';
import { generateScore } from './services/scoreGenerator';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AnalysisResult } from './types';
import './App.css';

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
  const [drumFileName, setDrumFileName] = useState<string>('');
  const [songFileName, setSongFileName] = useState<string>('');

  // Usar el buffer de la canción si existe, sino la batería
  const playbackBuffer = songBuffer || drumBuffer;
  const audioPlayback = useAudioPlayback(playbackBuffer);
  const storage = useLocalStorage();

  const handleAudioLoaded = async (files: AudioFiles) => {
    if (!files.drumBuffer) return;

    setDrumBuffer(files.drumBuffer);
    setDrumFileName(files.drum?.name || '');
    setSongBuffer(files.songBuffer || null);
    setSongFileName(files.song?.name || '');
    setIsAnalyzing(true);

    try {
      // Analizar siempre la batería para la partitura
      const result = await analyzeAudio(files.drumBuffer);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    audioPlayback.stop();
    setDrumBuffer(null);
    setSongBuffer(null);
    setAnalysis(null);
    setDrumFileName('');
    setSongFileName('');
  };

  // Pantalla de carga
  if (!drumBuffer || !analysis) {
    return <AudioUploader onAudioLoaded={handleAudioLoaded} isLoading={isAnalyzing} />;
  }

  // Pantalla de práctica
  const score = generateScore(analysis);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>DRUMIA</h1>
          <div className="info">
            <div className="files-info">
              <span className="label">Batería:</span>
              <span className="filename">{drumFileName}</span>
            </div>
            {songFileName && (
              <div className="files-info">
                <span className="label">Canción:</span>
                <span className="filename">{songFileName}</span>
              </div>
            )}
            <span className="metadata">{analysis.bpm} BPM • {analysis.timeSignature}</span>
          </div>
        </div>
        <button className="reset-btn" onClick={handleReset}>
          Nueva canción
        </button>
      </header>

      <main className="app-main">
        <div className="practice-container">
          <MetronomeVisual
            currentTime={audioPlayback.currentTime}
            bpm={analysis.bpm}
            timeSignature={analysis.timeSignature}
          />

          <DrumScore score={score} currentTime={audioPlayback.currentTime} bpm={analysis.bpm} />

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
