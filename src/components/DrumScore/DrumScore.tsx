import React, { useRef, useEffect, useState } from 'react';
import { DrumScore as DrumScoreType } from '../../services/scoreGenerator';
import './DrumScore.css';

interface DrumScoreProps {
  score: DrumScoreType;
  currentTime: number;
  bpm: number;
}

export function DrumScore({ score, currentTime, bpm }: DrumScoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 300 });

  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current?.parentElement) {
        const parent = canvasRef.current.parentElement;
        setCanvasSize({
          width: parent.clientWidth,
          height: 300,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo
    ctx.fillStyle = '#1f1f2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Líneas de la partitura
    const lineHeight = canvas.height / 5;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
      const y = (i + 1) * lineHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Labels
    const labels = ['Hi-hat', 'Tom', 'Snare', 'Kick'];
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';

    labels.forEach((label, i) => {
      ctx.fillText(label, 10, (i + 0.7) * lineHeight);
    });

    // Notas
    const beatDuration = (60 / bpm) * 1000;
    const pixelsPerMs = (canvas.width - 50) / score.duration;

    score.measures.forEach((measure) => {
      measure.notes.forEach((note) => {
        const x = 50 + note.time * pixelsPerMs;
        const y = (note.position + 0.5) * lineHeight;

        ctx.fillStyle = note.type === 'kick' ? '#ff6b6b' :
                       note.type === 'snare' ? '#4ecdc4' :
                       note.type === 'hat' ? '#ffd93d' : '#a8dadc';

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Cursor de reproducción
    const cursorX = 50 + currentTime * pixelsPerMs;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
  }, [canvasSize, score, currentTime, bpm]);

  return (
    <div className="drum-score">
      <canvas ref={canvasRef} className="score-canvas" />
    </div>
  );
}
