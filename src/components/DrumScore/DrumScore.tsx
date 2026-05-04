import React, { useRef, useEffect, useState } from 'react';
import { DrumScore as DrumScoreType, DRUM_LINES, getColorByType } from '../../services/scoreGenerator';
import './DrumScore.css';

interface DrumScoreProps {
  score: DrumScoreType;
  currentTime: number;
  bpm: number;
}

const PIXELS_PER_SECOND = 100; // Para el zoom
const LINE_HEIGHT = 28;
const LABEL_WIDTH = 100;

export function DrumScore({ score, currentTime, bpm }: DrumScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);

  // AutoScroll para mantener el cursor visible
  useEffect(() => {
    if (containerRef.current) {
      const cursorPixelPos = currentTime / 1000 * PIXELS_PER_SECOND;
      const viewportCenter = viewportWidth / 2;
      const scrollTarget = Math.max(0, cursorPixelPos - viewportCenter);

      containerRef.current.scrollLeft = scrollTarget;
      setScrollLeft(scrollTarget);
    }
  }, [currentTime, viewportWidth]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.clientWidth);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const totalWidth = score.duration / 1000 * PIXELS_PER_SECOND;
    const totalHeight = DRUM_LINES.length * LINE_HEIGHT + 40;

    canvas.width = totalWidth * window.devicePixelRatio;
    canvas.height = totalHeight * window.devicePixelRatio;
    canvas.style.width = totalWidth + 'px';
    canvas.style.height = totalHeight + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Fondo
    ctx.fillStyle = '#1f1f2e';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Líneas de la partitura
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    DRUM_LINES.forEach((line, index) => {
      const y = 30 + index * LINE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalWidth, y);
      ctx.stroke();
    });

    // Medidas cada compás (4 beats)
    const beatDuration = (60 / bpm) * 1000;
    const measureDuration = beatDuration * 4;
    const measurePixels = measureDuration / 1000 * PIXELS_PER_SECOND;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;

    for (let i = 0; i * measurePixels < totalWidth; i++) {
      const x = i * measurePixels;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, totalHeight - 5);
      ctx.stroke();
    }

    // Notas: solo mostrar si coinciden con tiempo actual (ventana de tolerancia)
    const activeWindow = 200; // ms de tolerancia para considerar "activo"

    score.measures.forEach((measure) => {
      measure.notes.forEach((note) => {
        const isActive = Math.abs(note.time - currentTime) < activeWindow;
        const x = note.time / 1000 * PIXELS_PER_SECOND;
        const y = 30 + note.position * LINE_HEIGHT + LINE_HEIGHT / 2;

        // Color de la nota
        const baseColor = getColorByType(note.type);

        // Nota principal
        ctx.fillStyle = isActive ? baseColor : baseColor + '40'; // Más opaco si activo
        ctx.beginPath();
        ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Contorno si está activo
        if (isActive) {
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Aura alrededor
          ctx.fillStyle = baseColor + '20';
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // Cursor de reproducción
    const cursorX = currentTime / 1000 * PIXELS_PER_SECOND;

    // Línea del cursor
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, totalHeight);
    ctx.stroke();

    // Marcador en el cursor
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(cursorX - 2, 5, 4, 15);
  }, [score, currentTime, bpm]);

  return (
    <div className="drum-score-wrapper">
      <div className="drum-score-labels">
        {DRUM_LINES.map((line) => (
          <div key={line.type} className="drum-label" style={{ height: LINE_HEIGHT }}>
            <div
              className="label-dot"
              style={{ backgroundColor: line.color }}
            />
            <span>{line.label}</span>
          </div>
        ))}
      </div>

      <div
        className="drum-score-container"
        ref={containerRef}
      >
        <canvas ref={canvasRef} className="score-canvas" />
      </div>

      <div className="zoom-info">
        <span>🔍 {PIXELS_PER_SECOND}px/sec • Scroll para navegar</span>
      </div>
    </div>
  );
}
