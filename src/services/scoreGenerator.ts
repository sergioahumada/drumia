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
  type: string;
  position: number;
  intensity: number;
  label: string;
}

export const DRUM_LINES = [
  { position: 0, type: 'ride', label: 'Ride', color: '#ffd93d' },
  { position: 1, type: 'crash', label: 'Crash', color: '#ffab40' },
  { position: 2, type: 'hat', label: 'Hi-hat', color: '#fbc02d' },
  { position: 3, type: 'tom1', label: 'Tom 1', color: '#a8dadc' },
  { position: 4, type: 'tom2', label: 'Tom 2', color: '#81c3d7' },
  { position: 5, type: 'tom3', label: 'Tom 3', color: '#4db8e8' },
  { position: 6, type: 'snare', label: 'Snare', color: '#4ecdc4' },
  { position: 7, type: 'kick', label: 'Kick', color: '#ff6b6b' },
];

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

    const notes: Note[] = measureEvents
      .map((event) => {
        const drumLine = DRUM_LINES.find((line) => line.type === event.type);
        if (!drumLine) return null;

        return {
          time: event.time,
          type: event.type,
          position: drumLine.position,
          intensity: event.intensity,
          label: drumLine.label,
        };
      })
      .filter((n) => n !== null) as Note[];

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

export function getColorByType(type: string): string {
  const drumLine = DRUM_LINES.find((line) => line.type === type);
  return drumLine?.color || '#999';
}
