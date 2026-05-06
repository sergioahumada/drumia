export const NUM_MELS = 64;
export const NUM_FRAMES = 64;
const FRAME_SIZE = 1024;
const HOP_SIZE = 512;

// Cooley-Tukey FFT — O(n log n)
export function computeFFTMagnitude(signal: Float32Array): Float32Array {
  let n = 1;
  while (n < signal.length) n <<= 1;

  const real = new Float64Array(n);
  const imag = new Float64Array(n);

  for (let i = 0; i < signal.length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (signal.length - 1));
    real[i] = signal[i] * w;
  }

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = real[i]; real[i] = real[j]; real[j] = t;
      t = imag[i]; imag[i] = imag[j]; imag[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let re = 1, im = 0;
      for (let j = 0; j < (len >> 1); j++) {
        const uRe = real[i + j], uIm = imag[i + j];
        const vRe = real[i + j + (len >> 1)] * re - imag[i + j + (len >> 1)] * im;
        const vIm = real[i + j + (len >> 1)] * im + imag[i + j + (len >> 1)] * re;
        real[i + j] = uRe + vRe;
        imag[i + j] = uIm + vIm;
        real[i + j + (len >> 1)] = uRe - vRe;
        imag[i + j + (len >> 1)] = uIm - vIm;
        const newRe = re * wRe - im * wIm;
        im = re * wIm + im * wRe;
        re = newRe;
      }
    }
  }

  const mag = new Float32Array(n >> 1);
  for (let i = 0; i < n >> 1; i++) {
    mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
  }
  return mag;
}

export function computeSpectralCentroid(mag: Float32Array, sampleRate: number): number {
  const nyquist = sampleRate / 2;
  let totalPower = 0;
  let weightedSum = 0;
  for (let i = 0; i < mag.length; i++) {
    const freq = (i / mag.length) * nyquist;
    const power = mag[i] * mag[i];
    totalPower += power;
    weightedSum += freq * power;
  }
  return totalPower > 0 ? weightedSum / totalPower : 0;
}

export function computeBandEnergy(
  mag: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number
): number {
  const nyquist = sampleRate / 2;
  const n = mag.length;
  const lo = Math.floor((lowHz / nyquist) * n);
  const hi = Math.min(Math.ceil((highHz / nyquist) * n), n);
  let energy = 0;
  for (let i = lo; i < hi; i++) energy += mag[i] * mag[i];
  return energy;
}

// ─── Mel-spectrogram ──────────────────────────────────────────────────────────

function hzToMel(hz: number): number { return 2595 * Math.log10(1 + hz / 700); }
function melToHz(mel: number): number { return 700 * (Math.pow(10, mel / 2595) - 1); }

let _melCache: { sr: number; data: Float32Array } | null = null;

function buildMelFilterbank(sampleRate: number): Float32Array {
  if (_melCache?.sr === sampleRate) return _melCache.data;
  const fftBins = FRAME_SIZE / 2;
  const filters = new Float32Array(NUM_MELS * fftBins);
  const melMin = hzToMel(20);
  const melMax = hzToMel(sampleRate / 2);
  const pts = Array.from({ length: NUM_MELS + 2 }, (_, i) =>
    Math.floor((melToHz(melMin + (i / (NUM_MELS + 1)) * (melMax - melMin)) / (sampleRate / 2)) * (fftBins - 1))
  );
  for (let m = 0; m < NUM_MELS; m++) {
    const l = pts[m], c = pts[m + 1], r = pts[m + 2];
    for (let k = l; k <= r; k++) {
      filters[m * fftBins + k] = k <= c
        ? (c > l ? (k - l) / (c - l) : 0)
        : (r > c ? (r - k) / (r - c) : 0);
    }
  }
  _melCache = { sr: sampleRate, data: filters };
  return filters;
}

/**
 * Extract a log-mel spectrogram from audio that starts at the onset.
 * Audio should begin ~50ms before the hit (caller's responsibility).
 * Returns a flat Float32Array of length NUM_MELS * NUM_FRAMES,
 * ordered [mel0_f0, mel1_f0, ..., mel63_f0, mel0_f1, ...] → shape [NUM_FRAMES, NUM_MELS].
 */
export function extractMelSpectrogram(audioData: Float32Array, sampleRate: number): Float32Array {
  const filters = buildMelFilterbank(sampleRate);
  const fftBins = FRAME_SIZE / 2;
  const out = new Float32Array(NUM_FRAMES * NUM_MELS);

  for (let f = 0; f < NUM_FRAMES; f++) {
    const frameStart = f * HOP_SIZE;
    const frame = new Float32Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
      const idx = frameStart + i;
      frame[i] = idx < audioData.length ? audioData[idx] : 0;
    }
    const mag = computeFFTMagnitude(frame);
    for (let m = 0; m < NUM_MELS; m++) {
      let e = 0;
      for (let k = 0; k < fftBins; k++) e += mag[k] * filters[m * fftBins + k];
      out[f * NUM_MELS + m] = Math.log(e + 1e-8);
    }
  }

  // Per-instance min-max normalization → [0, 1]
  let min = out[0], max = out[0];
  for (let i = 1; i < out.length; i++) { if (out[i] < min) min = out[i]; if (out[i] > max) max = out[i]; }
  const range = max - min + 1e-8;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / range;

  return out;
}

// 128 log-spaced energy bins, normalized to sum=1
export function extractLogFreqBins(mag: Float32Array, sampleRate: number, numBins = 128): Float32Array {
  const nyquist = sampleRate / 2;
  const minFreq = 20;
  const bins = new Float32Array(numBins);

  for (let b = 0; b < numBins; b++) {
    const lo = minFreq * Math.pow(nyquist / minFreq, b / numBins);
    const hi = minFreq * Math.pow(nyquist / minFreq, (b + 1) / numBins);
    const loIdx = Math.floor((lo / nyquist) * mag.length);
    const hiIdx = Math.min(Math.ceil((hi / nyquist) * mag.length), mag.length);
    let energy = 0, count = 0;
    for (let i = loIdx; i < hiIdx; i++) { energy += mag[i] * mag[i]; count++; }
    bins[b] = count > 0 ? Math.sqrt(energy / count) : 0;
  }

  let sum = 0;
  for (let i = 0; i < numBins; i++) sum += bins[i];
  if (sum > 0) for (let i = 0; i < numBins; i++) bins[i] /= sum;

  return bins;
}
