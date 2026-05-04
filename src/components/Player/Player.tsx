import React from 'react';
import './Player.css';

interface PlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  onPlayClick: () => void;
  onPauseClick: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function Player({
  isPlaying,
  currentTime,
  duration,
  speed,
  onPlayClick,
  onPauseClick,
  onSeek,
  onSpeedChange,
}: PlayerProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="player">
      <div className="progress-container">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="progress-slider"
        />
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="controls">
        <button
          className="control-btn"
          onClick={isPlaying ? onPauseClick : onPlayClick}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="speed-control">
          <label>Velocidad:</label>
          <select value={speed} onChange={(e) => onSpeedChange(parseFloat(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
