import React, { useEffect, useState } from 'react';
import './MetronomeVisual.css';

interface MetronomeVisualProps {
  currentTime: number;
  bpm: number;
  timeSignature: string;
}

export function MetronomeVisual({ currentTime, bpm, timeSignature }: MetronomeVisualProps) {
  const [beatType, setBeatType] = useState<'strong' | 'normal'>('normal');

  useEffect(() => {
    const beatDuration = (60 / bpm) * 1000;
    const currentBeat = Math.floor(currentTime / beatDuration) % parseInt(timeSignature.split('/')[0]);

    // El primer beat (0) es más fuerte
    setBeatType(currentBeat === 0 ? 'strong' : 'normal');
  }, [currentTime, bpm, timeSignature]);

  return (
    <div className="metronome-visual">
      <div className={`metronome-circle ${beatType}`} />
      <p className="bpm-display">{bpm} BPM</p>
    </div>
  );
}
