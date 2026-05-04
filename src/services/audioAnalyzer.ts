import { AnalysisResult } from '../types';

export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000; // en ms
  const channelData = audioBuffer.getChannelData(0);

  const bpm = detectBPM(channelData, sampleRate);
  const timeSignature = '4/4';

  const events = analyzeOnsetAndInstruments(channelData, sampleRate, duration, bpm);

  return {
    bpm,
    timeSignature,
    duration,
    events,
  };
}

function detectBPM(channelData: Float32Array, sampleRate: number): number {
  // Detectar energía por ventanas para estimar tempo
  const windowSize = sampleRate * 0.5; // 500ms ventanas
  const energies: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    const window = channelData.slice(i, Math.min(i + windowSize, channelData.length));
    let energy = 0;
    for (let j = 0; j < window.length; j++) {
      energy += window[j] * window[j];
    }
    energies.push(energy);
  }

  // Buscar periodicidad en la energía para estimar BPM
  // Por ahora: usar 120 como default, mejorable con FFT
  return 120;
}

function analyzeOnsetAndInstruments(
  channelData: Float32Array,
  sampleRate: number,
  durationMs: number,
  bpm: number
) {
  const events = [];
  const beatDuration = (60 / bpm) * 1000;

  // Generar patrón realista de batería
  // Esto se reemplazará con análisis real usando onset detection

  for (let time = 0; time < durationMs; time += beatDuration) {
    const beatNumber = (time / beatDuration) % 4;

    // Kick: beats 1, 2.5, 3
    if (beatNumber === 0 || beatNumber === 1 || beatNumber === 2 || beatNumber === 2.5) {
      if (Math.floor(beatNumber) !== Math.floor((time + beatDuration) / beatDuration)) {
        events.push({ time, type: 'kick' as const, intensity: 0.85 });
      }
    }

    // Snare: beats 2 y 4 (backbeat)
    if (beatNumber === 1 || beatNumber === 3) {
      events.push({ time, type: 'snare' as const, intensity: 0.75 });
    }

    // Hi-hat cerrado: cada 8va nota
    for (let i = 0; i < 8; i++) {
      const hatTime = time + (beatDuration / 8) * i;
      if (hatTime < durationMs) {
        events.push({
          time: hatTime,
          type: 'hat' as const,
          intensity: 0.4 + Math.random() * 0.2,
        });
      }
    }

    // Crash: cada 4 beats
    if (beatNumber === 0) {
      events.push({ time, type: 'crash' as const, intensity: 0.9 });
    }

    // Ride: pulsos fuertes en beats pares
    if (beatNumber === 0 || beatNumber === 2) {
      events.push({
        time: time + beatDuration * 0.5,
        type: 'ride' as const,
        intensity: 0.6,
      });
    }

    // Toms: fills ocasionales
    if (beatNumber === 3 && Math.random() > 0.7) {
      // Fill con toms
      for (let j = 0; j < 3; j++) {
        events.push({
          time: time + (beatDuration * (0.5 + j * 0.15)),
          type: (['tom1', 'tom2', 'tom3'] as const)[j],
          intensity: 0.7,
        });
      }
    }
  }

  return events.sort((a, b) => a.time - b.time);
}
