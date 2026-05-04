import { AnalysisResult } from '../types';

// Dynamic import de Essentia.js
let essentia: any = null;

async function initEssentia() {
  if (essentia) return essentia;
  try {
    const module = await import('essentia.js');
    essentia = new module.Essentia(module.EssentiaWASM);
    return essentia;
  } catch (error) {
    console.warn('Essentia.js no disponible, usando análisis básico', error);
    return null;
  }
}

export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000;
  const channelData = audioBuffer.getChannelData(0);

  const essLib = await initEssentia();

  let bpm = 120;
  const timeSignature = '4/4';
  let events = [];

  if (essLib) {
    // Usar Essentia.js
    try {
      bpm = detectBPMWithEssentia(essLib, channelData, sampleRate);
      events = detectOnsetsWithEssentia(essLib, channelData, sampleRate);
    } catch (error) {
      console.warn('Error con Essentia, usando fallback', error);
      events = fallbackAnalysis(channelData, sampleRate, bpm);
    }
  } else {
    // Fallback sin Essentia
    events = fallbackAnalysis(channelData, sampleRate, bpm);
  }

  return {
    bpm,
    timeSignature,
    duration,
    events,
  };
}

function detectBPMWithEssentia(essLib: any, channelData: Float32Array, sampleRate: number): number {
  try {
    // RhythmExtractor2013 es el mejor detector de BPM en Essentia
    const result = essLib.RhythmExtractor2013({
      signal: Array.from(channelData),
    });

    return Math.round(result.bpm) || 120;
  } catch (error) {
    console.warn('BPM detection falló, usando default', error);
    return 120;
  }
}

function detectOnsetsWithEssentia(
  essLib: any,
  channelData: Float32Array,
  sampleRate: number
): Array<{
  time: number;
  type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
  intensity: number;
}> {
  const events: Array<{
    time: number;
    type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
    intensity: number;
  }> = [];

  try {
    const signal = Array.from(channelData);

    // OnsetDetection - detecta los momentos de golpes
    const onsetResult = essLib.OnsetDetection({
      signal,
      method: 'energy',
    });

    const onsetTimes: number[] = onsetResult.onsets || [];

    // Para cada onset, extraer características espectrales
    const hopSize = Math.floor(sampleRate * 0.01); // 10ms
    const windowSize = 2048;

    onsetTimes.forEach((onsetTime: number) => {
      const sampleIdx = Math.floor(onsetTime * sampleRate);
      const windowStart = Math.max(0, sampleIdx - windowSize / 2);
      const windowEnd = Math.min(channelData.length, sampleIdx + windowSize / 2);
      const window = Array.from(channelData.slice(windowStart, windowEnd));

      // Calcular características
      let features = {
        spectralCentroid: 0,
        energy: 0,
        zeroCrossingRate: 0,
      };

      try {
        // SpectralCentroid
        const scResult = essLib.SpectralCentroid({
          spectrum: window,
        });
        features.spectralCentroid = scResult.spectralCentroid || 0;

        // Energy
        const energyResult = essLib.Energy({
          array: window,
        });
        features.energy = energyResult.energy || 0;

        // ZeroCrossingRate
        const zcrResult = essLib.ZeroCrossingRate({
          signal: window,
        });
        features.zeroCrossingRate = zcrResult.zeroCrossingRate || 0;
      } catch (e) {
        // Calcular manualmente si Essentia falla
        features = computeFeaturesManually(window, sampleRate);
      }

      const type = classifyDrumInstrument(features);
      const intensity = Math.min(1, features.energy);

      events.push({
        time: onsetTime * 1000,
        type,
        intensity,
      });
    });
  } catch (error) {
    console.warn('Onset detection falló', error);
    return fallbackAnalysis(channelData, sampleRate, 120);
  }

  return events;
}

function computeFeaturesManually(
  window: number[],
  sampleRate: number
): { spectralCentroid: number; energy: number; zeroCrossingRate: number } {
  let energy = 0;
  for (let i = 0; i < window.length; i++) {
    energy += window[i] * window[i];
  }
  energy = Math.sqrt(energy / window.length);

  let zeroCrossings = 0;
  for (let i = 1; i < window.length; i++) {
    if ((window[i] > 0 && window[i - 1] < 0) || (window[i] < 0 && window[i - 1] > 0)) {
      zeroCrossings++;
    }
  }
  const zcr = zeroCrossings / window.length;

  // Estimar centroide espectral por zero-crossing rate
  const sc = (zcr / window.length) * (sampleRate / 2);

  return {
    spectralCentroid: sc,
    energy,
    zeroCrossingRate: zcr,
  };
}

function classifyDrumInstrument(features: {
  spectralCentroid: number;
  energy: number;
  zeroCrossingRate: number;
}): 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride' {
  const { spectralCentroid, zeroCrossingRate, energy } = features;

  // Rangos típicos de centroide espectral:
  // Kick: 0-200 Hz
  // Snare: 3000-6000 Hz
  // Hi-hat: 7000-12000 Hz
  // Crash: 8000-15000 Hz
  // Tom: 2000-5000 Hz

  if (spectralCentroid < 300) {
    return 'kick';
  } else if (spectralCentroid < 2000) {
    return 'tom3';
  } else if (spectralCentroid < 3500) {
    return 'tom2';
  } else if (spectralCentroid < 5000) {
    // Snare o Tom1
    return energy > 0.5 ? 'snare' : 'tom1';
  } else if (spectralCentroid < 7000) {
    return 'ride';
  } else if (spectralCentroid < 10000) {
    return 'hat';
  } else {
    return 'crash';
  }
}

function fallbackAnalysis(
  channelData: Float32Array,
  sampleRate: number,
  bpm: number
): Array<{
  time: number;
  type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
  intensity: number;
}> {
  const events = [];
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms
  const energyEnvelope: number[] = [];

  // Calcular energía
  for (let i = 0; i < channelData.length; i += hopSize) {
    const window = channelData.slice(i, Math.min(i + hopSize, channelData.length));
    let energy = 0;
    for (let j = 0; j < window.length; j++) {
      energy += window[j] * window[j];
    }
    energyEnvelope.push(Math.sqrt(energy / window.length));
  }

  // Detectar picos
  const threshold = computeThreshold(energyEnvelope);

  for (let i = 1; i < energyEnvelope.length - 1; i++) {
    const derivative = energyEnvelope[i] - energyEnvelope[i - 1];

    if (derivative > threshold && energyEnvelope[i] > 0.02) {
      const timeSinceLastOnset =
        (i - (events.length > 0 ? Math.floor(events[events.length - 1].time / 10) : 0)) * hopSize;

      if (timeSinceLastOnset > sampleRate * 0.05) {
        events.push({
          time: (i * hopSize / sampleRate) * 1000,
          type: 'hat' as const,
          intensity: Math.min(1, energyEnvelope[i]),
        });
      }
    }
  }

  return events;
}

function computeThreshold(energyEnvelope: number[]): number {
  const sorted = [...energyEnvelope].sort((a, b) => a - b);
  const q75 = sorted[Math.floor(sorted.length * 0.75)];
  return q75 * 0.5;
}
