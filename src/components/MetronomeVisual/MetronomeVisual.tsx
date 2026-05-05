import React, { useEffect, useState } from 'react';

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
    <div className="flex flex-col items-center gap-2">
      <div 
        className={`w-12 h-12 rounded-full border-4 transition-all duration-100 ${
          beatType === 'strong' 
            ? 'bg-pink-500 border-pink-300 scale-125 shadow-[0_0_20px_rgba(236,72,153,0.6)]' 
            : 'bg-indigo-500 border-indigo-300 scale-100'
        }`} 
      />
      <p className="text-gray-400 font-medium tracking-widest">{bpm} BPM</p>
    </div>
  );
}
