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

function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>('');

  const audioPlayback = useAudioPlayback(audioBuffer);
  const storage = useLocalStorage();

  const handleAudioLoaded = async (file: File, buffer: AudioBuffer) => {
    setAudioBuffer(buffer);
    setCurrentFileName(file.name);
    setIsAnalyzing(true);

    try {
      const result = await analyzeAudio(buffer);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    audioPlayback.stop();
    setAudioBuffer(null);
    setAnalysis(null);
    setCurrentFileName('');
  };

  // Pantalla de carga
  if (!audioBuffer || !analysis) {
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
            <span className="filename">{currentFileName}</span>
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
