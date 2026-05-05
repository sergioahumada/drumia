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
