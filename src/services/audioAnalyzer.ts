import { AnalysisResult } from '../types';
import { DrumClassifier, extractAudioFeatures } from './drumClassifier';

let classifier: DrumClassifier | null = null;

async function initClassifier() {
  if (classifier) return classifier;
  try {
    classifier = new DrumClassifier();
    await classifier.initialize();
    return classifier;
  } catch (error) {
    console.warn('TensorFlow classifier not available', error);
    return null;
  }
}

export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000;
  const channelData = audioBuffer.getChannelData(0);

  // Inicializar clasificador TensorFlow
  const tfClassifier = await initClassifier();

  let bpm = 120;
  const timeSignature = '4/4';
  let events = [];

  try {
    // Detectar BPM
    bpm = detectBPM(channelData, sampleRate);

    // Detectar onsets con mejor análisis espectral
    const onsets = detectOnsets(channelData, sampleRate);

    // Clasificar con TensorFlow si disponible, sino con heurística
    if (tfClassifier) {
      events = await classifyOnsetsWithTensorFlow(tfClassifier, channelData, sampleRate, onsets);
    } else {
      events = classifyOnsetsHeuristic(channelData, sampleRate, onsets);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    events = fallbackAnalysis(channelData, sampleRate, bpm);
  }

  return {
    bpm,
    timeSignature,
    duration,
    events,
  };
}

function detectBPM(channelData: Float32Array, sampleRate: number): number {
  // Análisis de energía por ventanas
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

  // Buscar BPM
  let bestBPM = 120;
  let maxScore = 0;

  for (let bpm = 60; bpm < 200; bpm += 2) {
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

  return Math.max(60, Math.min(200, bestBPM));
}

function detectOnsets(channelData: Float32Array, sampleRate: number): number[] {
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms
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

  // Detectar picos
  const threshold = computeThreshold(energyEnvelope);

  for (let i = 1; i < energyEnvelope.length - 1; i++) {
    const derivative = energyEnvelope[i] - energyEnvelope[i - 1];

    if (derivative > threshold && energyEnvelope[i] > 0.01) {
      const timeSinceLastOnset =
        (i - (onsets.length > 0 ? Math.floor(onsets[onsets.length - 1] / hopSize) : 0)) * hopSize;

      if (timeSinceLastOnset > sampleRate * 0.03) {
        // Mínimo 30ms entre onsets
        onsets.push(i * hopSize);
      }
    }
  }

  return onsets;
}

async function classifyOnsetsWithTensorFlow(
  tfClassifier: DrumClassifier,
  channelData: Float32Array,
  sampleRate: number,
  onsetSamples: number[]
): Promise<
  Array<{
    time: number;
    type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
    intensity: number;
  }>
> {
  const events = [];
  const windowSize = 2048;

  for (const onsetSample of onsetSamples) {
    const windowStart = Math.max(0, onsetSample - windowSize / 2);
    const windowEnd = Math.min(channelData.length, onsetSample + windowSize / 2);
    const window = channelData.slice(windowStart, windowEnd);

    // Extraer features
    const features = extractAudioFeatures(window, sampleRate);

    // Clasificar con TensorFlow
    const type = await tfClassifier.classify(features);

    // Calcular intensidad
    let energy = 0;
    for (let i = 0; i < window.length; i++) {
      energy += window[i] * window[i];
    }
    energy = Math.sqrt(energy / window.length);

    events.push({
      time: (onsetSample / sampleRate) * 1000,
      type,
      intensity: Math.min(1, energy * 2),
    });
  }

  return events;
}

function classifyOnsetsHeuristic(
  channelData: Float32Array,
  sampleRate: number,
  onsetSamples: number[]
): Array<{
  time: number;
  type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
  intensity: number;
}> {
  const events = [];
  const windowSize = 2048;

  onsetSamples.forEach((onsetSample) => {
    const windowStart = Math.max(0, onsetSample - windowSize / 2);
    const windowEnd = Math.min(channelData.length, onsetSample + windowSize / 2);
    const window = channelData.slice(windowStart, windowEnd);

    const type = classifyBySpectralHeuristic(window, sampleRate);
    const intensity = computeIntensity(window);

    events.push({
      time: (onsetSample / sampleRate) * 1000,
      type,
      intensity: Math.min(1, intensity * 1.5),
    });
  });

  return events;
}

function classifyBySpectralHeuristic(
  window: Float32Array,
  sampleRate: number
): 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride' {
  // Calcular características espectrales
  const zcr = computeZeroCrossingRate(window);
  const spectralCentroid = estimateSpectralCentroid(window, sampleRate);
  const energy = computeIntensity(window);

  // Normalizar
  const sc = Math.max(0, Math.min(15000, spectralCentroid));
  const normalizedZcr = Math.max(0, Math.min(1, zcr));
  const e = Math.max(0, Math.min(1, energy));

  // Heurística mejorada
  if (sc < 300) {
    return 'kick'; // Muy baja frecuencia
  }

  if (sc > 10000 && normalizedZcr > 0.5) {
    return 'crash'; // Muy alta frecuencia + mucho contenido agudo
  }

  if (sc > 8000 && normalizedZcr > 0.4) {
    return 'hat'; // Alta frecuencia + contenido agudo
  }

  if (sc > 5500 && normalizedZcr < 0.3) {
    return 'ride'; // Media-alta frecuencia + poco contenido agudo
  }

  if (sc > 3500 && normalizedZcr > 0.3 && e > 0.3) {
    return 'snare'; // Media frecuencia + energía
  }

  if (sc > 2000 && e > 0.4) {
    // Toms - clasificar por centroide
    if (sc > 3500) return 'tom1';
    if (sc > 2500) return 'tom2';
    return 'tom3';
  }

  if (normalizedZcr > 0.5) return 'hat';
  if (e > 0.5) return 'tom2';

  return 'hat';
}

function computeZeroCrossingRate(signal: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i] > 0 && signal[i - 1] < 0) || (signal[i] < 0 && signal[i - 1] > 0)) {
      crossings++;
    }
  }
  return crossings / signal.length;
}

function estimateSpectralCentroid(signal: Float32Array, sampleRate: number): number {
  // Estimar centroide usando autocorrelación simple
  let maxLag = 0;
  let maxCorr = 0;

  const windowSize = Math.min(512, signal.length / 2);

  for (let lag = 1; lag < windowSize; lag++) {
    let corr = 0;
    for (let i = 0; i < signal.length - lag; i++) {
      corr += signal[i] * signal[i + lag];
    }

    if (corr > maxCorr) {
      maxCorr = corr;
      maxLag = lag;
    }
  }

  // Convertir lag a frecuencia (aproximado)
  if (maxLag > 0) {
    return (sampleRate / maxLag) * 0.5;
  }

  // Fallback: usar zero-crossing rate para estimar
  const zcr = computeZeroCrossingRate(signal);
  return zcr * (sampleRate / 2);
}

function computeIntensity(window: Float32Array): number {
  let rms = 0;
  for (let i = 0; i < window.length; i++) {
    rms += window[i] * window[i];
  }
  return Math.sqrt(rms / window.length);
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
