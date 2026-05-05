import { AnalysisResult, DrumEvent, DrumEventType } from '../types';
import { DrumClassifier, extractAudioFeatures } from './drumClassifier';
import { computeFFTMagnitude, computeSpectralCentroid, computeBandEnergy } from './spectralUtils';

let classifier: DrumClassifier | null = null;

async function initClassifier() {
  if (classifier) return classifier;
  try {
    classifier = new DrumClassifier();
    await classifier.initialize();
    return classifier;
  } catch {
    console.warn('TF classifier unavailable');
    return null;
  }
}

export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  console.log('--- Iniciando Análisis ---');
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration * 1000;
  const channelData = audioBuffer.getChannelData(0);

  const tfClassifier = await initClassifier();

  let bpm = 120;
  const timeSignature = '4/4';
  let events: DrumEvent[] = [];

  try {
    console.log('Detectando BPM...');
    bpm = detectBPM(channelData, sampleRate);
    
    console.log('Detectando onsets...');
    const onsets = detectOnsets(channelData, sampleRate);
    console.log(`Onsets encontrados: ${onsets.length}`);

    if (tfClassifier) {
      console.log('Clasificando con TF...');
      events = await classifyWithTF(tfClassifier, channelData, sampleRate, onsets);
    } else {
      console.log('Usando clasificación heurística...');
      events = classifyHeuristic(channelData, sampleRate, onsets);
    }
  } catch (err) {
    console.error('Analysis error:', err);
    events = fallbackAnalysis(channelData, sampleRate);
  }

  console.log('Análisis finalizado.');
  return { bpm, timeSignature, duration, events };
}

// ─── BPM detection ─────────────────────────────────────────────────────────────

function detectBPM(channelData: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(sampleRate * 0.5);
  const energies: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    const slice = channelData.slice(i, Math.min(i + windowSize, channelData.length));
    let e = 0;
    for (let j = 0; j < slice.length; j++) e += slice[j] * slice[j];
    energies.push(Math.sqrt(e / slice.length));
  }

  let bestBPM = 120, maxScore = 0;
  for (let bpm = 60; bpm < 200; bpm += 2) {
    const beatsPerWindow = (windowSize / sampleRate) * (bpm / 60);
    let score = 0;
    for (let i = 1; i < energies.length - 1; i++) {
      const expected = Math.round(i / beatsPerWindow) * beatsPerWindow;
      if (Math.abs(i - expected) < beatsPerWindow * 0.2) score += energies[i];
    }
    if (score > maxScore) { maxScore = score; bestBPM = bpm; }
  }

  return Math.max(60, Math.min(200, bestBPM));
}

// ─── Onset detection ───────────────────────────────────────────────────────────

function detectOnsets(channelData: Float32Array, sampleRate: number): number[] {
  const hopSize = Math.floor(sampleRate * 0.01);
  const envelope: number[] = [];

  for (let i = 0; i < channelData.length; i += hopSize) {
    const slice = channelData.slice(i, Math.min(i + hopSize, channelData.length));
    let e = 0;
    for (let j = 0; j < slice.length; j++) e += slice[j] * slice[j];
    envelope.push(Math.sqrt(e / slice.length));
  }

  const threshold = computeThreshold(envelope);
  const onsets: number[] = [];
  const minGapSamples = sampleRate * 0.03; // 30 ms

  for (let i = 1; i < envelope.length - 1; i++) {
    const deriv = envelope[i] - envelope[i - 1];
    if (deriv > threshold && envelope[i] > 0.01) {
      const lastOnset = onsets.length > 0 ? onsets[onsets.length - 1] : 0;
      if (i * hopSize - lastOnset > minGapSamples) {
        onsets.push(i * hopSize);
      }
    }
  }

  return onsets;
}

// ─── TF classification ─────────────────────────────────────────────────────────

async function classifyWithTF(
  clf: DrumClassifier,
  channelData: Float32Array,
  sampleRate: number,
  onsets: number[]
): Promise<DrumEvent[]> {
  const W = 2048;
  const limitedOnsets = onsets.slice(0, 2000); 

  const promises = limitedOnsets.map(async (onset) => {
    const start = Math.max(0, onset - W / 2);
    const frame = channelData.slice(start, Math.min(channelData.length, onset + W / 2));
    const features = extractAudioFeatures(frame, sampleRate);
    const type = await clf.classify(features);
    const intensity = computeRMS(frame);
    return {
      time: (onset / sampleRate) * 1000,
      type,
      intensity: Math.min(1, intensity * 2),
    };
  });

  return Promise.all(promises);
}

// ─── Heuristic classification (fallback) ──────────────────────────────────────

function classifyHeuristic(channelData: Float32Array, sampleRate: number, onsets: number[]): DrumEvent[] {
  const W = 2048;
  return onsets.map(onset => {
    const start = Math.max(0, onset - W / 2);
    const frame = channelData.slice(start, Math.min(channelData.length, onset + W / 2));
    return {
      time: (onset / sampleRate) * 1000,
      type: classifyBySpectrum(frame, sampleRate),
      intensity: Math.min(1, computeRMS(frame) * 2),
    };
  });
}

function classifyBySpectrum(frame: Float32Array, sampleRate: number): DrumEventType {
  const mag = computeFFTMagnitude(frame);
  const sc = computeSpectralCentroid(mag, sampleRate);

  const be = (lo: number, hi: number) => computeBandEnergy(mag, sampleRate, lo, hi);

  let totalEnergy = 0;
  for (let i = 0; i < mag.length; i++) totalEnergy += mag[i] * mag[i];
  const total = totalEnergy || 1;

  const subBassR = be(0, 100) / total;
  const bassR = be(100, 300) / total;
  const midR = be(300, 3000) / total;
  const highMidR = be(3000, 8000) / total;
  const veryHighR = be(8000, sampleRate / 2) / total;
  const highR = highMidR + veryHighR;

  if (subBassR + bassR > 0.45) return 'kick';
  if (veryHighR > 0.45) return 'crash';
  if (highR > 0.55 || sc > 7000) return 'hat';
  if (sc > 4500 && highR > 0.3) return 'ride';
  if (sc > 2000 && highR > 0.18 && midR > 0.1) return 'snare';
  if (sc > 1200) return 'tom1';
  if (sc > 700) return 'tom2';
  if (midR > 0.3) return 'tom3';

  return 'kick';
}

// ─── Fallback (if analysis fails entirely) ────────────────────────────────────

function fallbackAnalysis(channelData: Float32Array, sampleRate: number): DrumEvent[] {
  const hopSize = Math.floor(sampleRate * 0.01);
  const envelope: number[] = [];
  for (let i = 0; i < channelData.length; i += hopSize) {
    const slice = channelData.slice(i, Math.min(i + hopSize, channelData.length));
    let e = 0;
    for (let j = 0; j < slice.length; j++) e += slice[j] * slice[j];
    envelope.push(Math.sqrt(e / slice.length));
  }

  const threshold = computeThreshold(envelope);
  const events = [];

  for (let i = 1; i < envelope.length - 1; i++) {
    if (envelope[i] - envelope[i - 1] > threshold && envelope[i] > 0.02) {
      const last = events.length > 0 ? events[events.length - 1].time : 0;
      const t = (i * hopSize / sampleRate) * 1000;
      if (t - last > 50) {
        events.push({ time: t, type: 'hat' as const, intensity: Math.min(1, envelope[i]) });
      }
    }
  }

  return events;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRMS(signal: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
  return Math.sqrt(sum / signal.length);
}

function computeThreshold(envelope: number[]): number {
  const sorted = [...envelope].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.75)] * 0.5;
}
