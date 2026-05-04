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
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 350 });

  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current?.parentElement) {
        const parent = canvasRef.current.parentElement;
        setCanvasSize({
          width: parent.clientWidth,
          height: 350,
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

    canvas.width = canvasSize.width * window.devicePixelRatio;
    canvas.height = canvasSize.height * window.devicePixelRatio;
    canvas.style.width = canvasSize.width + 'px';
    canvas.style.height = canvasSize.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Fondo
    ctx.fillStyle = '#1f1f2e';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    const padding = 80;
    const contentWidth = canvasSize.width - padding;
    const contentHeight = canvasSize.height - 40;

    // Líneas de la partitura
    const lineHeight = contentHeight / 4;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    const labels = ['Hi-hat', 'Tom', 'Snare', 'Kick'];

    for (let i = 0; i < 4; i++) {
      const y = 40 + (i + 1) * lineHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasSize.width - 20, y);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#888';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';

    labels.forEach((label, i) => {
      ctx.fillText(label, 10, 55 + i * lineHeight);
    });

    // Medidas
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    const beatDuration = (60 / bpm) * 1000;
    const beatsPerMeasure = 4;
    const measureDuration = beatDuration * beatsPerMeasure;

    let measureX = padding;
    while (measureX < canvasSize.width) {
      ctx.beginPath();
      ctx.moveTo(measureX, 30);
      ctx.lineTo(measureX, canvasSize.height - 10);
      ctx.stroke();
      measureX += (contentWidth * measureDuration) / score.duration;
    }

    // Notas
    const pixelsPerMs = contentWidth / score.duration;

    const noteRadius = 5;
    const colorMap: Record<string, string> = {
      hat: '#ffd93d',
      tom: '#a8dadc',
      snare: '#4ecdc4',
      kick: '#ff6b6b',
    };

    score.measures.forEach((measure) => {
      measure.notes.forEach((note) => {
        const x = padding + note.time * pixelsPerMs;
        const y = 40 + (note.position + 0.5) * lineHeight;

        // Nota
        ctx.fillStyle = colorMap[note.type] || '#999';
        ctx.beginPath();
        ctx.arc(x, y, noteRadius, 0, Math.PI * 2);
        ctx.fill();

        // Contorno si es visible
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });

    // Cursor de reproducción
    const cursorX = padding + currentTime * pixelsPerMs;

    // Sombra del cursor
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fillRect(cursorX - 10, 0, 20, canvasSize.height);

    // Línea del cursor
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cursorX, 20);
    ctx.lineTo(cursorX, canvasSize.height - 5);
    ctx.stroke();

    // Círculo en el cursor
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(cursorX, 15, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [canvasSize, score, currentTime, bpm]);

  return (
    <div className="drum-score">
      <canvas ref={canvasRef} className="score-canvas" />
    </div>
  );
}
