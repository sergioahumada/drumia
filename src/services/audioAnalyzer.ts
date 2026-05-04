import { AnalysisResult } from '../types';

// TODO: Integrar Essentia.js o librería similar para análisis real
export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000; // en ms
  const channelData = audioBuffer.getChannelData(0);

  // Placeholder: Detectar BPM simple (se reemplazará con Essentia.js)
  const bpm = detectBPM(channelData, sampleRate);
  const timeSignature = '4/4'; // Placeholder

  // Placeholder: Generar eventos (se reemplazará con análisis real)
  const events = generatePlaceholderEvents(duration, bpm);

  return {
    bpm,
    timeSignature,
    duration,
    events,
  };
}

function detectBPM(channelData: Float32Array, sampleRate: number): number {
  // Placeholder simple: retorna un BPM fijo
  // Se reemplazará con algoritmo real usando Essentia.js
  return 120;
}

function generatePlaceholderEvents(durationMs: number, bpm: number) {
  const events = [];
  const beatDuration = (60 / bpm) * 1000; // duración de un beat en ms

  for (let time = 0; time < durationMs; time += beatDuration) {
    // Patrón básico: kick en beats 1 y 3, snare en 2 y 4
    const beatNumber = (time / beatDuration) % 4;

    if (beatNumber === 0 || beatNumber === 2) {
      events.push({ time, type: 'kick' as const, intensity: 0.8 });
    }
    if (beatNumber === 1 || beatNumber === 3) {
      events.push({ time, type: 'snare' as const, intensity: 0.7 });
    }
    // Hi-hat en cada octava de beat
    for (let i = 0; i < 8; i++) {
      events.push({
        time: time + (beatDuration / 8) * i,
        type: 'hat' as const,
        intensity: 0.5,
      });
    }
  }

  return events;
}
