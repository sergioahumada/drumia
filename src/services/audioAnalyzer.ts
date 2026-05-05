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

  // Normalizar valores
  const sc = Math.max(0, Math.min(15000, spectralCentroid || 5000));
  const zcr = Math.max(0, Math.min(1, zeroCrossingRate || 0.5));
  const e = Math.max(0, Math.min(1, energy || 0.5));

  // Clasificación basada en características:
  // Kick: baja frecuencia + baja energía (ataque lento)
  // Snare: media-alta frecuencia + energía media + alto ZCR
  // Hat: alta frecuencia + energía media-baja + muy alto ZCR
  // Crash: muy alta frecuencia + energía baja + muy alto ZCR
  // Tom: frecuencia media + energía alta
  // Ride: frecuencia media-alta + energía media + ZCR bajo

  // Prioridad 1: Detectar Kick (frecuencia muy baja)
  if (sc < 400) {
    return 'kick';
  }

  // Prioridad 2: Detectar Crash (frecuencia muy alta + ZCR muy alto)
  if (sc > 10000 && zcr > 0.6) {
    return 'crash';
  }

  // Prioridad 3: Detectar Hi-hat (frecuencia alta + ZCR alto + energía media)
  if (sc > 7000 && zcr > 0.5 && e < 0.7) {
    return 'hat';
  }

  // Prioridad 4: Detectar Snare (frecuencia media + energía + ZCR)
  if (sc > 3000 && sc < 7000 && zcr > 0.4 && e > 0.4) {
    return 'snare';
  }

  // Prioridad 5: Detectar Ride (frecuencia media-alta + ZCR bajo-medio)
  if (sc > 5000 && sc < 8000 && zcr < 0.4) {
    return 'ride';
  }

  // Prioridad 6: Detectar Toms (frecuencia media + energía alta)
  if (sc > 1500 && sc < 5000 && e > 0.5) {
    // Clasificar por altura (espectrocentroid)
    if (sc > 3500) {
      return 'tom1'; // Tom agudo
    } else if (sc > 2500) {
      return 'tom2'; // Tom medio
    } else {
      return 'tom3'; // Tom grave
    }
  }

  // Fallback: por ZCR
  if (zcr > 0.6) return 'hat';
  if (zcr > 0.4) return 'snare';
  if (e > 0.5) return 'tom2';

  return 'hat'; // Default final
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
