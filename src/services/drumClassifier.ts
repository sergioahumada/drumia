import * as tf from '@tensorflow/tfjs';
import { computeFFTMagnitude, extractLogFreqBins } from './spectralUtils';

type DrumType = 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
const DRUM_TYPES: DrumType[] = ['kick', 'snare', 'hat', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];
const NUM_FEATURES = 128;

export class DrumClassifier {
  private model: tf.LayersModel | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    try {
      const loaded = await this.tryLoadPretrainedModel();
      if (loaded) {
        this.initialized = true;
        console.log('DrumClassifier: loaded pre-trained model from /drum-model/model.json');
        return;
      }
      console.log('DrumClassifier: no pre-trained model found, using synthetic training...');
      this.model = buildDense();
      this.model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
      await this.trainWithSyntheticData();
      this.initialized = true;
      console.log('DrumClassifier: synthetic training done');
    } catch (err) {
      console.error('DrumClassifier init error', err);
    }
  }

  private async tryLoadPretrainedModel(): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel('/drum-model/model.json') as tf.LayersModel;
      return true;
    } catch {
      return false;
    }
  }

  private async trainWithSyntheticData() {
    const samplesPerClass = 300;
    const featureList: number[][] = [];
    const labelList: number[] = [];

    for (let c = 0; c < DRUM_TYPES.length; c++) {
      for (let i = 0; i < samplesPerClass; i++) {
        featureList.push(syntheticFeatures(DRUM_TYPES[c]));
        labelList.push(c);
      }
    }

    for (let i = featureList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [featureList[i], featureList[j]] = [featureList[j], featureList[i]];
      [labelList[i], labelList[j]] = [labelList[j], labelList[i]];
    }

    const xs = tf.tensor2d(featureList);
    const ys = tf.oneHot(tf.tensor1d(labelList, 'int32'), 8);
    await this.model!.fit(xs, ys, { epochs: 60, batchSize: 64, shuffle: true, verbose: 0 });
    xs.dispose();
    ys.dispose();
  }

  async classify(features: Float32Array): Promise<DrumType> {
    if (!this.model) return 'hat';
    try {
      const input = tf.tensor2d([Array.from(features)]);
      const pred = this.model.predict(input) as tf.Tensor;
      const probs = await pred.data();
      input.dispose();
      pred.dispose();

      let maxIdx = 0, maxProb = probs[0];
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > maxProb) { maxProb = probs[i]; maxIdx = i; }
      }
      return maxProb > 0.25 ? DRUM_TYPES[maxIdx] : 'hat';
    } catch {
      return 'hat';
    }
  }

  dispose() {
    this.model?.dispose();
    this.model = null;
    this.initialized = false;
  }
}

function buildDense(): tf.Sequential {
  return tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [NUM_FEATURES], units: 128, activation: 'relu' }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 8, activation: 'softmax' }),
    ],
  });
}

export function extractAudioFeatures(audioData: Float32Array, sampleRate: number): Float32Array {
  const N = 2048;
  const start = Math.max(0, Math.floor((audioData.length - N) / 2));
  const frame = new Float32Array(N);
  frame.set(audioData.slice(start, start + N));
  const mag = computeFFTMagnitude(frame);
  return extractLogFreqBins(mag, sampleRate, NUM_FEATURES);
}

// ─── Synthetic spectral profiles ──────────────────────────────────────────────
function syntheticFeatures(type: DrumType): number[] {
  const f = new Array<number>(NUM_FEATURES).fill(0);
  const n = () => Math.random() * 0.08;

  switch (type) {
    case 'kick':
      for (let i = 0; i < 13; i++) f[i] = 0.85 - i * 0.03 + n();
      for (let i = 13; i < 35; i++) f[i] = 0.45 - (i - 13) * 0.01 + n();
      for (let i = 35; i < NUM_FEATURES; i++) f[i] = Math.max(0, 0.1 - (i - 35) * 0.001) + n() * 0.3;
      break;
    case 'snare':
      for (let i = 0; i < 13; i++) f[i] = 0.12 + n();
      for (let i = 13; i < 55; i++) f[i] = 0.65 + n();
      for (let i = 55; i < 100; i++) f[i] = 0.72 + n();
      for (let i = 100; i < NUM_FEATURES; i++) f[i] = 0.35 + n();
      break;
    case 'hat':
      for (let i = 0; i < 50; i++) f[i] = n() * 0.3;
      for (let i = 50; i < 76; i++) f[i] = 0.25 + (i - 50) * 0.01 + n();
      for (let i = 76; i < NUM_FEATURES; i++) f[i] = 0.75 + Math.random() * 0.25;
      break;
    case 'tom1':
      for (let i = 0; i < 10; i++) f[i] = 0.35 + n();
      for (let i = 10; i < 30; i++) f[i] = 0.75 - (i - 10) * 0.015 + n();
      for (let i = 30; i < 60; i++) f[i] = 0.45 + n();
      for (let i = 60; i < NUM_FEATURES; i++) f[i] = Math.max(0, 0.15 - (i - 60) * 0.002) + n() * 0.3;
      break;
    case 'tom2':
      for (let i = 0; i < 15; i++) f[i] = 0.55 - i * 0.01 + n();
      for (let i = 15; i < 40; i++) f[i] = 0.78 - (i - 15) * 0.018 + n();
      for (let i = 40; i < 70; i++) f[i] = 0.3 + n();
      for (let i = 70; i < NUM_FEATURES; i++) f[i] = n() * 0.3;
      break;
    case 'tom3':
      for (let i = 0; i < 20; i++) f[i] = 0.8 - i * 0.02 + n();
      for (let i = 20; i < 45; i++) f[i] = 0.45 - (i - 20) * 0.01 + n();
      for (let i = 45; i < NUM_FEATURES; i++) f[i] = n() * 0.25;
      break;
    case 'crash':
      for (let i = 0; i < NUM_FEATURES; i++) {
        f[i] = 0.3 + Math.random() * 0.4;
        if (i > 70) f[i] *= 1.6;
        if (i < 15) f[i] *= 0.5;
        f[i] = Math.min(1, f[i]);
      }
      break;
    case 'ride':
      for (let i = 0; i < 40; i++) f[i] = n() * 0.3;
      for (let i = 40; i < 80; i++) f[i] = 0.45 + n();
      for (let i = 80; i < 115; i++) f[i] = 0.65 + n();
      for (let i = 115; i < NUM_FEATURES; i++) f[i] = 0.3 + n();
      break;
  }

  const sum = f.reduce((a, b) => a + b, 0) + 1e-8;
  return f.map(v => Math.max(0, v) / sum);
}
