import { useRef, useEffect } from "react";
import * as PIXI from "pixi.js";
import {
  DrumScore as DrumScoreType,
  Note,
  DRUM_LINES,
  getColorByType,
} from "../../services/scoreGenerator";

interface DrumScoreProps {
  score: DrumScoreType;
  getCurrentTime: () => number;
  bpm: number;
  focusSection?: { startMs: number; endMs: number } | null;
  cleanMode?: boolean;
  minDistance?: number;
}

const PPS = 120; // Aumentamos velocidad de scroll visual
const LINE_HEIGHT = 45;

export function DrumScore({
  score,
  getCurrentTime,
  bpm,
  focusSection,
  cleanMode = false,
  minDistance = 150,
}: DrumScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const totalHeight = DRUM_LINES.length * LINE_HEIGHT + 40;

  useEffect(() => {
    let mounted = true;
    let app: PIXI.Application | null = null;

    const initPixi = async () => {
      if (!containerRef.current) return;

      app = new PIXI.Application();
      try {
        await app.init({
          width: containerRef.current.clientWidth,
          height: 500,
          backgroundColor: 0x1a1a2e,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (!mounted) {
          app.destroy(true, { children: true, texture: true });
          return;
        }

        appRef.current = app;
        containerRef.current.appendChild(app.canvas);

        const scoreContainer = new PIXI.Container();
        app.stage.addChild(scoreContainer);

        const gridGraphics = new PIXI.Graphics();
        scoreContainer.addChild(gridGraphics);

        const totalWidth = (score.duration / 1000) * PPS;

        DRUM_LINES.forEach((_, i) => {
          const y = 30 + i * LINE_HEIGHT;
          gridGraphics.moveTo(0, y).lineTo(totalWidth, y);
        });
        gridGraphics.stroke({ width: 1, color: 0x24243e });

        const measurePx = (((60 / bpm) * 4 * 1000) / 1000) * PPS;
        for (let i = 0; i * measurePx < totalWidth; i++) {
          const x = i * measurePx;
          gridGraphics.moveTo(x, 0).lineTo(x, totalHeight);
        }
        gridGraphics.stroke({ width: 1, color: 0x333333 });

        if (focusSection) {
          const sx = (focusSection.startMs / 1000) * PPS;
          const ex = (focusSection.endMs / 1000) * PPS;
          const focusBg = new PIXI.Graphics();
          focusBg.rect(sx, 0, ex - sx, totalHeight).fill({ color: 0x8b5cf6, alpha: 0.07 });
          focusBg
            .moveTo(sx, 0)
            .lineTo(sx, totalHeight)
            .moveTo(ex, 0)
            .lineTo(ex, totalHeight)
            .stroke({ width: 2, color: 0x8b5cf6, alpha: 0.5 });
          scoreContainer.addChild(focusBg);
        }

        const notesGraphics = new PIXI.Graphics();
        scoreContainer.addChild(notesGraphics);

        const processedNotes: Note[] = [];

        score.measures.forEach((m) => {
          m.notes.forEach((note) => {
            if (cleanMode) {
              const isOverlapping = processedNotes.some(
                (p: { type: string; time: number }) =>
                  p.type === note.type && Math.abs(p.time - note.time) < minDistance,
              );
              if (isOverlapping) return;
            }
            processedNotes.push(note);

            const x = (note.time / 1000) * PPS;
            const y = 30 + note.position * LINE_HEIGHT + LINE_HEIGHT / 2;
            const color = PIXI.Color.shared.setValue(getColorByType(note.type)).toNumber();
            notesGraphics.circle(x, y, 8).fill({ color, alpha: 0.4 });
          });
        });

        const activeNotesGraphics = new PIXI.Graphics();
        app.stage.addChild(activeNotesGraphics);

        const cursor = new PIXI.Graphics();
        cursor
          .rect(-1.5, 0, 3, totalHeight)
          .rect(-4, 5, 8, 15)
          .fill(0x06b6d4);
        app.stage.addChild(cursor);

        app.ticker.add(() => {
          if (!mounted || !app || !app.stage || !app.renderer) return;

          const t = getCurrentTime();
          const viewW = app.screen.width;
          const cursorX = (t / 1000) * PPS;

          scoreContainer.x = -cursorX + viewW / 2;
          cursor.x = viewW / 2;

          activeNotesGraphics.clear();
          activeNotesGraphics.x = scoreContainer.x;

          processedNotes.forEach((note) => {
            const diff = Math.abs(note.time - t);
            if (diff < 150) {
              const nx = (note.time / 1000) * PPS;
              const ny = 30 + note.position * LINE_HEIGHT + LINE_HEIGHT / 2;
              const color = PIXI.Color.shared.setValue(getColorByType(note.type)).toNumber();
              const alpha = 1 - diff / 150;

              activeNotesGraphics.circle(nx, ny, 22).fill({ color, alpha: 0.2 * alpha });
              activeNotesGraphics
                .circle(nx, ny, 12)
                .fill({ color, alpha: alpha })
                .stroke({ width: 2.5, color: 0xffffff, alpha: alpha });
            }
          });
        });

        // Handle Manual Resize
        const handleResize = () => {
          if (app && containerRef.current) {
            app.renderer.resize(containerRef.current.clientWidth, 500);
          }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      } catch (err) {
        console.error("PixiJS init failed:", err);
      }
    };

    const cleanupResize = initPixi();

    return () => {
      mounted = false;
      cleanupResize.then((fn) => fn?.());
      if (app) {
        try {
          if (app.renderer) {
            app.destroy(true, { children: true, texture: true });
          }
        } catch (e) {
          console.warn("Silent fail during Pixi destroy:", e);
        }
        appRef.current = null;
      }
    };
  }, [score, bpm, focusSection, cleanMode, minDistance]);

  return (
    <div className="flex flex-col bg-bg-dark rounded-xl overflow-hidden my-6 border border-gray-800 h-[500px] shadow-2xl">
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed labels */}
        <div className="flex flex-col bg-linear-to-br from-bg-dark to-[#24243e] border-r-[3px] border-primary w-[110px] sm:w-[140px] shrink-0 overflow-y-auto z-20 pt-7.5 pb-1 sm:pt-[30px] sm:pb-[5px]">
          {DRUM_LINES.map((line) => (
            <div
              key={line.type}
              className="flex items-center justify-start gap-3 px-4 border-b border-gray-700/50 text-xs sm:text-sm font-bold text-gray-200 h-[45px] whitespace-nowrap shrink-0 transition-all hover:bg-indigo-500/15 hover:text-indigo-500 hover:pl-6 cursor-default group"
            >
              <div
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 opacity-90 transition-all group-hover:scale-125 group-hover:shadow-[0_0_12px_currentColor]"
                style={{ backgroundColor: line.color, boxShadow: `0 0 6px ${line.color}` }}
              />
              <span>{line.label}</span>
            </div>
          ))}
        </div>

        {/* WebGL Viewport */}
        <div className="flex-1 relative overflow-hidden bg-bg-dark" ref={containerRef}>
          {/* PixiJS will inject the canvas here */}
        </div>
      </div>

      <div className="p-2 bg-[#2a2a3e] border-t border-gray-700 text-[11px] text-gray-500 text-center flex justify-between px-6"></div>
    </div>
  );
}
