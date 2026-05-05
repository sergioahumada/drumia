import * as tf from '@tensorflow/tfjs';

// Modelo de clasificación de instrumentos de batería
export class DrumClassifier {
  private model: tf.LayersModel | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      // Crear modelo simple de clasificación
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [256], // MFCC features
            units: 128,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 8, // 8 instrumentos
            activation: 'softmax',
          }),
        ],
      });

      this.initialized = true;
      console.log('DrumClassifier initialized');
    } catch (error) {
      console.error('Error initializing DrumClassifier', error);
    }
  }

  async classify(
    features: Float32Array
  ): Promise<'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride'> {
    if (!this.model) {
      return 'hat';
    }

    try {
      const input = tf.tensor2d([Array.from(features)]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const probabilities = await prediction.data();

      // Índices: [kick, snare, hat, tom1, tom2, tom3, crash, ride]
      const drumTypes: Array<
        'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride'
      > = ['kick', 'snare', 'hat', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];

      let maxIdx = 0;
      let maxProb = probabilities[0];

      for (let i = 1; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          maxIdx = i;
        }
      }

      input.dispose();
      prediction.dispose();

      // Solo retornar si confianza > 0.3
      if (maxProb > 0.3) {
        return drumTypes[maxIdx];
      }

      return 'hat'; // Default
    } catch (error) {
      console.error('Classification error', error);
      return 'hat';
    }
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.initialized = false;
    }
  }
}

// Extractor de características mejorado
export function extractAudioFeatures(
  audioBuffer: Float32Array,
  sampleRate: number
): Float32Array {
  // Extraer MFCC-like features usando espectrograma
  const features = new Float32Array(256);

  // Dividir en frames
  const frameSize = 2048;
  const hopSize = frameSize / 2;
  const numFrames = Math.floor((audioBuffer.length - frameSize) / hopSize);

  // Calcular espectrograma
  const spectrogram: number[][] = [];

  for (let i = 0; i < Math.min(numFrames, 10); i++) {
    const start = i * hopSize;
    const frame = audioBuffer.slice(start, start + frameSize);

    // Aplicar ventana Hann
    const windowed = applyHannWindow(frame);

    // FFT
    const spectrum = computeFFT(windowed);

    // Mel scale (simplificado)
    const melBands = toMelScale(spectrum, sampleRate);
    spectrogram.push(melBands);
  }

  // Promediar características a lo largo del tiempo
  const avgFeatures = averageSpectrogram(spectrogram, 256);

  // Normalizar
  const mean = avgFeatures.reduce((a, b) => a + b) / avgFeatures.length;
  const std = Math.sqrt(
    avgFeatures.reduce((a, b) => a + Math.pow(b - mean, 2)) / avgFeatures.length
  );

  for (let i = 0; i < avgFeatures.length; i++) {
    features[i] = (avgFeatures[i] - mean) / (std + 1e-6);
  }

  return features;
}

function applyHannWindow(signal: Float32Array): Float32Array {
  const windowed = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    windowed[i] = signal[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (signal.length - 1)));
  }
  return windowed;
}

function computeFFT(signal: Float32Array): number[] {
  // Simplified FFT using DFT (lento pero funciona)
  const N = signal.length;
  const spectrum: number[] = new Array(N / 2);

  for (let k = 0; k < N / 2; k++) {
    let real = 0;
    let imag = 0;

    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      real += signal[n] * Math.cos(angle);
      imag += signal[n] * Math.sin(angle);
    }

    spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
  }

  return spectrum;
}

function toMelScale(spectrum: number[], sampleRate: number): number[] {
  const nyquist = sampleRate / 2;
  const numMelbands = 40;
  const melbands: number[] = new Array(numMelbands).fill(0);

  for (let i = 0; i < spectrum.length; i++) {
    const freq = (i / spectrum.length) * nyquist;
    const melFreq = 2595 * Math.log10(1 + freq / 700);
    const melIdx = Math.floor((melFreq / (2595 * Math.log10(1 + nyquist / 700))) * numMelbands);

    if (melIdx < numMelbands) {
      melbands[melIdx] += spectrum[i];
    }
  }

  return melbands;
}

function averageSpectrogram(spectrogram: number[][], targetSize: number): number[] {
  const result: number[] = new Array(targetSize).fill(0);

  if (spectrogram.length === 0) return result;

  const melSize = spectrogram[0].length;

  for (let i = 0; i < Math.min(targetSize, melSize); i++) {
    let sum = 0;
    for (let t = 0; t < spectrogram.length; t++) {
      sum += spectrogram[t][i] || 0;
    }
    result[i] = sum / spectrogram.length;
  }

  return result;
}
