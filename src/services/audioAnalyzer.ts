import { AnalysisResult } from '../types';

const FFT_SIZE = 2048;

export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000;
  const channelData = audioBuffer.getChannelData(0);

  // Detectar BPM
  const bpm = detectBPM(channelData, sampleRate);
  const timeSignature = '4/4';

  // Detectar onsets (momentos donde hay golpes)
  const onsets = detectOnsets(channelData, sampleRate);

  // Clasificar cada onset por instrumento basándose en espectro
  const events = classifyOnsets(channelData, sampleRate, onsets);

  return {
    bpm,
    timeSignature,
    duration,
    events,
  };
}

function detectBPM(channelData: Float32Array, sampleRate: number): number {
  // Dividir en ventanas y calcular energía
  const windowSize = Math.floor(sampleRate * 0.5); // 500ms
  const energies: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    const window = channelData.slice(i, Math.min(i + windowSize, channelData.length));
    let energy = 0;
    for (let j = 0; j < window.length; j++) {
      energy += window[j] * window[j];
    }
    energies.push(Math.sqrt(energy / window.length));
  }

  // Buscar el BPM detectando periodicidad en la energía
  let bestBPM = 120;
  let maxScore = 0;

  for (let bpm = 60; bpm < 200; bpm += 5) {
    const beatsPerWindow = (windowSize / sampleRate) * (bpm / 60);
    let score = 0;

    for (let i = 1; i < energies.length - 1; i++) {
      const expectedBeatPos = Math.round(i / beatsPerWindow) * beatsPerWindow;
      if (Math.abs(i - expectedBeatPos) < beatsPerWindow * 0.2) {
        score += energies[i];
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestBPM = bpm;
    }
  }

  return bestBPM;
}

function detectOnsets(channelData: Float32Array, sampleRate: number): number[] {
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const onsets: number[] = [];
  const energyEnvelope: number[] = [];

  // Calcular envolvente de energía
  for (let i = 0; i < channelData.length; i += hopSize) {
    const window = channelData.slice(i, Math.min(i + hopSize, channelData.length));
    let energy = 0;
    for (let j = 0; j < window.length; j++) {
      energy += window[j] * window[j];
    }
    energyEnvelope.push(Math.sqrt(energy / window.length));
  }

  // Detectar picos (onsets) usando derivada
  const threshold = computeAdaptiveThreshold(energyEnvelope);

  for (let i = 1; i < energyEnvelope.length - 1; i++) {
    const derivative = energyEnvelope[i] - energyEnvelope[i - 1];

    if (derivative > threshold && energyEnvelope[i] > 0.02) {
      // Validar que no sea muy cercano al onset anterior
      const timeSinceLastOnset = (i - (onsets.length > 0 ? onsets[onsets.length - 1] : 0)) * hopSize;

      if (timeSinceLastOnset > sampleRate * 0.05) {
        // Mínimo 50ms entre onsets
        onsets.push(i * hopSize);
      }
    }
  }

  return onsets;
}

function computeAdaptiveThreshold(energyEnvelope: number[]): number {
  const sorted = [...energyEnvelope].sort((a, b) => a - b);
  const q75 = sorted[Math.floor(sorted.length * 0.75)];
  return q75 * 0.5; // 50% del percentil 75
}

function classifyOnsets(
  channelData: Float32Array,
  sampleRate: number,
  onsetSamples: number[]
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

  onsetSamples.forEach((onsetSample) => {
    const windowStart = Math.max(0, onsetSample - FFT_SIZE / 2);
    const windowEnd = Math.min(channelData.length, onsetSample + FFT_SIZE / 2);
    const window = channelData.slice(windowStart, windowEnd);

    // Calcular espectro simple por bandas de frecuencia
    const spectrum = computeSimpleSpectrum(window, sampleRate);

    // Clasificar basándose en contenido espectral
    const type = classifyBySpectrum(spectrum);
    const intensity = computeIntensity(window);

    events.push({
      time: (onsetSample / sampleRate) * 1000,
      type,
      intensity: Math.min(1, intensity * 1.2),
    });
  });

  return events;
}

function computeSimpleSpectrum(window: Float32Array, sampleRate: number): Record<string, number> {
  // Dividir en bandas de frecuencia sin FFT completo
  const bands = {
    bass: 0, // 0-150 Hz (kick)
    lowMid: 0, // 150-500 Hz
    mid: 0, // 500-2000 Hz (snare)
    highMid: 0, // 2000-5000 Hz (tom)
    presence: 0, // 5000-12000 Hz (hat, crash)
    high: 0, // 12000+ Hz
  };

  // RMS por banda (aproximación sin FFT)
  let rms = 0;
  for (let i = 0; i < window.length; i++) {
    rms += window[i] * window[i];
  }
  rms = Math.sqrt(rms / window.length);

  // Usar características temporales para aproximar contenido espectral
  const zeroCrossings = countZeroCrossings(window);
  const spectralCentroid = estimateSpectralCentroid(window);

  bands.bass = rms * Math.max(0, 1 - zeroCrossings / 100);
  bands.mid = rms * (zeroCrossings / 150);
  bands.presence = rms * Math.max(0, zeroCrossings / 200);
  bands.high = rms * Math.max(0, (zeroCrossings - 200) / 200);

  return bands;
}

function countZeroCrossings(window: Float32Array): number {
  let count = 0;
  for (let i = 1; i < window.length; i++) {
    if ((window[i] > 0 && window[i - 1] < 0) || (window[i] < 0 && window[i - 1] > 0)) {
      count++;
    }
  }
  return count;
}

function estimateSpectralCentroid(window: Float32Array): number {
  let sum = 0;
  let weightedSum = 0;

  for (let i = 0; i < window.length; i++) {
    const mag = Math.abs(window[i]);
    sum += mag;
    weightedSum += mag * i;
  }

  return sum === 0 ? 0 : weightedSum / sum;
}

function classifyBySpectrum(spectrum: Record<string, number>): 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride' {
  const bass = spectrum.bass;
  const mid = spectrum.mid;
  const presence = spectrum.presence;
  const high = spectrum.high;

  // Lógica de clasificación basada en contenido espectral
  if (bass > mid && bass > presence) {
    return 'kick';
  } else if (mid > bass && mid > presence) {
    return 'snare';
  } else if (presence > mid && presence > bass && presence > high) {
    return 'hat';
  } else if (high > presence) {
    return 'crash';
  } else if (mid > presence && mid > bass) {
    return 'ride';
  } else if (presence > bass) {
    // Tom clasificación por intensidad
    const intensity = bass + mid + presence;
    if (intensity > 0.8) return 'tom1';
    if (intensity > 0.5) return 'tom2';
    return 'tom3';
  }

  return 'hat'; // Default
}

function computeIntensity(window: Float32Array): number {
  let rms = 0;
  for (let i = 0; i < window.length; i++) {
    rms += window[i] * window[i];
  }
  return Math.sqrt(rms / window.length);
}
