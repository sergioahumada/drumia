import { AnalysisResult } from '../types';

export interface DrumScore {
  bpm: number;
  timeSignature: string;
  duration: number;
  measures: Measure[];
}

export interface Measure {
  number: number;
  startTime: number;
  endTime: number;
  notes: Note[];
}

export interface Note {
  time: number;
  type: 'kick' | 'snare' | 'hat' | 'tom';
  position: number; // Línea en la partitura
  intensity: number;
}

export function generateScore(analysis: AnalysisResult): DrumScore {
  const beatDuration = (60 / analysis.bpm) * 1000;
  const timeSignature = analysis.timeSignature;
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]);
  const measureDuration = beatDuration * beatsPerMeasure;

  const measures: Measure[] = [];
  let measureNumber = 1;

  for (let time = 0; time < analysis.duration; time += measureDuration) {
    const endTime = Math.min(time + measureDuration, analysis.duration);
    const measureEvents = analysis.events.filter((e) => e.time >= time && e.time < endTime);

    const notes: Note[] = measureEvents.map((event) => ({
      time: event.time,
      type: event.type,
      position: getLinePosition(event.type),
      intensity: event.intensity,
    }));

    measures.push({
      number: measureNumber,
      startTime: time,
      endTime,
      notes,
    });

    measureNumber++;
  }

  return {
    bpm: analysis.bpm,
    timeSignature: analysis.timeSignature,
    duration: analysis.duration,
    measures,
  };
}

function getLinePosition(type: string): number {
  const positions: Record<string, number> = {
    hat: 0,
    tom: 1,
    snare: 2,
    kick: 3,
  };
  return positions[type] || 0;
}
