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
}

const PPS = 100; // pixels per second
const LINE_HEIGHT = 28;

export function DrumScore({
  score,
  getCurrentTime,
  bpm,
  focusSection,
  cleanMode = false,
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
          height: 300,
          backgroundColor: 0x1f1f2e,
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

        gridGraphics.setStrokeStyle({ width: 1, color: 0x2a2a3e });
        DRUM_LINES.forEach((_, i) => {
          const y = 30 + i * LINE_HEIGHT;
          gridGraphics.moveTo(0, y).lineTo(totalWidth, y);
        });

        const measurePx = (((60 / bpm) * 4 * 1000) / 1000) * PPS;
        gridGraphics.setStrokeStyle({ width: 1, color: 0x333333 });
        for (let i = 0; i * measurePx < totalWidth; i++) {
          const x = i * measurePx;
          gridGraphics.moveTo(x, 0).lineTo(x, totalHeight);
        }
        gridGraphics.stroke();

        if (focusSection) {
          const sx = (focusSection.startMs / 1000) * PPS;
          const ex = (focusSection.endMs / 1000) * PPS;
          const focusBg = new PIXI.Graphics();
          focusBg
            .beginFill(0x6366f1, 0.07)
            .drawRect(sx, 0, ex - sx, totalHeight)
            .endFill();
          focusBg.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.5 });
          focusBg
            .moveTo(sx, 0)
            .lineTo(sx, totalHeight)
            .moveTo(ex, 0)
            .lineTo(ex, totalHeight)
            .stroke();
          scoreContainer.addChild(focusBg);
        }

        const notesGraphics = new PIXI.Graphics();
        scoreContainer.addChild(notesGraphics);

        // --- Filtering Logic ---
        const MIN_DISTANCE_MS = 80;
        const processedNotes: Note[] = [];

        score.measures.forEach((m) => {
          m.notes.forEach((note) => {
            if (cleanMode) {
              const isOverlapping = processedNotes.some(
                (p: { type: string; time: number }) =>
                  p.type === note.type && Math.abs(p.time - note.time) < MIN_DISTANCE_MS,
              );
              if (isOverlapping) return;
            }
            processedNotes.push(note);

            const x = (note.time / 1000) * PPS;
            const y = 30 + note.position * LINE_HEIGHT + LINE_HEIGHT / 2;
            const color = PIXI.Color.shared.setValue(getColorByType(note.type)).toNumber();
            notesGraphics.beginFill(color, 0.3).drawCircle(x, y, 4).endFill();
          });
        });

        const activeNotesGraphics = new PIXI.Graphics();
        app.stage.addChild(activeNotesGraphics);

        const cursor = new PIXI.Graphics();
        cursor
          .beginFill(0x6366f1)
          .drawRect(-1.5, 0, 3, totalHeight)
          .drawRect(-4, 5, 8, 15)
          .endFill();
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

          score.measures.forEach((m) =>
            m.notes.forEach((note) => {
              const diff = Math.abs(note.time - t);
              if (diff < 150) {
                const nx = (note.time / 1000) * PPS;
                const ny = 30 + note.position * LINE_HEIGHT + LINE_HEIGHT / 2;
                const color = PIXI.Color.shared.setValue(getColorByType(note.type)).toNumber();
                const alpha = 1 - diff / 150;

                activeNotesGraphics
                  .beginFill(color, 0.2 * alpha)
                  .drawCircle(nx, ny, 11)
                  .endFill();
                activeNotesGraphics
                  .setStrokeStyle({ width: 1.5, color: 0xffffff, alpha: alpha })
                  .beginFill(color, alpha)
                  .drawCircle(nx, ny, 6)
                  .endFill()
                  .stroke();
              }
            }),
          );
        });

        // Handle Manual Resize
        const handleResize = () => {
          if (app && containerRef.current) {
            app.renderer.resize(containerRef.current.clientWidth, 300);
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
  }, [score, bpm, focusSection, cleanMode]);

  return (
    <div className="flex flex-col bg-[#1f1f2e] rounded-lg overflow-hidden my-5 border border-gray-800 h-[300px]">
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed labels */}
        <div className="flex flex-col bg-gradient-to-br from-[#2a2a3e] to-[#35354f] border-r-[3px] border-indigo-500 w-[110px] sm:w-[140px] shrink-0 overflow-y-auto z-20 pt-7.5 pb-1 sm:pt-[30px] sm:pb-[5px]">
          {DRUM_LINES.map((line) => (
            <div
              key={line.type}
              className="flex items-center justify-start gap-1.5 sm:gap-2.5 px-2 sm:px-2.5 border-b border-gray-700 text-[11px] sm:text-xs font-semibold text-gray-200 h-[26px] sm:h-[28px] whitespace-nowrap shrink-0 transition-all hover:bg-indigo-500/15 hover:text-indigo-500 hover:pl-3 cursor-default group"
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
        <div className="flex-1 relative overflow-hidden bg-[#1f1f2e]" ref={containerRef}>
          {/* PixiJS will inject the canvas here */}
        </div>
      </div>

      <div className="p-2 bg-[#2a2a3e] border-t border-gray-700 text-[11px] text-gray-500 text-center flex justify-between px-6">
        <span className="opacity-50 uppercase tracking-widest font-bold">
          GPU Accelerated Renderer
        </span>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 font-medium uppercase tracking-tighter">
            Modo Correctivo
          </span>
          <div className="w-8 h-4 bg-gray-700 rounded-full relative">
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${cleanMode ? "right-0.5 bg-indigo-500" : "left-0.5 bg-gray-500"}`}
            />
          </div>
          <span className="ml-4">{PPS}px/sec</span>
        </div>
      </div>
    </div>
  );
}
