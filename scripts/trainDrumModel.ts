/**
 * Offline CNN training using IDMT-SMT-DRUMS-V2 dataset.
 * Run: npm run train
 *
 * Produces public/drum-model/model.json + weights.bin
 * Input shape: [NUM_FRAMES, NUM_MELS, 1] = [64, 64, 1] — log-mel spectrogram
 *
 * Real classes (from dataset):  KD → kick (0), SD → snare (1), HH → hat (2)
 * Synthetic classes (generated): tom1 (3), tom2 (4), tom3 (5), crash (6), ride (7)
 */

// Parcha el objeto CJS de 'util' antes de que tfjs-node lo consuma
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const _util = _require("util");
if (!_util.isNullOrUndefined)
  _util.isNullOrUndefined = (v: unknown) => v === null || v === undefined;
if (!_util.isNull) _util.isNull = (v: unknown) => v === null;
if (!_util.isUndefined) _util.isUndefined = (v: unknown) => v === undefined;
if (!_util.isObject) _util.isObject = (v: unknown) => typeof v === "object" && v !== null;
if (!_util.isFunction) _util.isFunction = (v: unknown) => typeof v === "function";

import * as tf from "@tensorflow/tfjs-node";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DATASET_AUDIO = path.join(ROOT, "IDMT-SMT-DRUMS-V2", "audio");
const DATASET_XML = path.join(ROOT, "IDMT-SMT-DRUMS-V2", "annotation_xml");
const MODEL_OUTPUT = path.join(ROOT, "public", "drum-model");

const CLASS_NAMES = ["kick", "snare", "hat", "tom1", "tom2", "tom3", "crash", "ride"];
const REAL_LABEL: Record<string, number> = { KD: 0, SD: 1, HH: 2 };
const SYNTH_CLASSES = [3, 4, 5, 6, 7];
const SYNTH_PER_CLASS = 600;
const AUG_FACTOR = 0;
const MAX_PER_CLASS = Infinity;

const NUM_FEATURES = 128;
const WINDOW = 2048;
const PRE_ROLL = Math.floor(44100 * 0.025); // 25ms pre-roll to capture attack

// ─── WAV parser ───────────────────────────────────────────────────────────────

function parseWAV(buf: Buffer): { sampleRate: number; samples: Float32Array } {
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("Not RIFF");
  if (buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not WAVE");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const view = new DataView(ab);
  let numChannels = 1,
    sampleRate = 44100,
    bitsPerSample = 16;
  let dataStart = 0,
    dataSize = 0;
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString("ascii", off, off + 4);
    const size = view.getUint32(off + 4, true);
    if (id === "fmt ") {
      numChannels = view.getUint16(off + 10, true);
      sampleRate = view.getUint32(off + 12, true);
      bitsPerSample = view.getUint16(off + 22, true);
    } else if (id === "data") {
      dataStart = off + 8;
      dataSize = size;
    }
    off += 8 + size + (size % 2);
  }
  const bps = bitsPerSample / 8;
  const numSamples = Math.floor(dataSize / (bps * numChannels));
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const pos = dataStart + i * bps * numChannels;
    if (bitsPerSample === 16) samples[i] = view.getInt16(pos, true) / 32768;
    else if (bitsPerSample === 24) {
      let v = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16);
      if (v & 0x800000) v |= ~0xffffff;
      samples[i] = v / 8388608;
    } else if (bitsPerSample === 32) samples[i] = view.getFloat32(pos, true);
  }
  return { sampleRate, samples };
}

// ─── XML annotation parser ────────────────────────────────────────────────────

type Onset = { instrument: string; onsetSec: number };

function parseXML(xml: string): Onset[] {
  const out: Onset[] = [];
  const re = /<event>([\s\S]*?)<\/event>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const instr = b.match(/<instrument>(\w+)<\/instrument>/)?.[1];
    const onset = b.match(/<onsetSec>([\d.]+)<\/onsetSec>/)?.[1];
    if (instr && onset) out.push({ instrument: instr, onsetSec: parseFloat(onset) });
  }
  return out;
}

// ─── FFT (Cooley-Tukey) ───────────────────────────────────────────────────────

function fftMag(signal: Float32Array): Float32Array {
  let n = 1;
  while (n < signal.length) n <<= 1;
  const real = new Float64Array(n),
    imag = new Float64Array(n);
  for (let i = 0; i < signal.length; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (signal.length - 1));
    real[i] = signal[i] * w;
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang),
      wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let re = 1,
        im = 0;
      for (let j = 0; j < len >> 1; j++) {
        const h = len >> 1;
        const uRe = real[i + j],
          uIm = imag[i + j];
        const vRe = real[i + j + h] * re - imag[i + j + h] * im;
        const vIm = real[i + j + h] * im + imag[i + j + h] * re;
        real[i + j] = uRe + vRe;
        imag[i + j] = uIm + vIm;
        real[i + j + h] = uRe - vRe;
        imag[i + j + h] = uIm - vIm;
        const nr = re * wRe - im * wIm;
        im = re * wIm + im * wRe;
        re = nr;
      }
    }
  }
  const mag = new Float32Array(n >> 1);
  for (let i = 0; i < n >> 1; i++) mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
  return mag;
}

// ─── Log-freq bins (mirrors spectralUtils.ts) ─────────────────────────────────

function logFreqBins(mag: Float32Array, sampleRate: number, noiseAmp = 0, gainFactor = 1): Float32Array {
  const nyquist = sampleRate / 2;
  const bins = new Float32Array(NUM_FEATURES);
  const minF = 20;
  for (let b = 0; b < NUM_FEATURES; b++) {
    const lo = minF * Math.pow(nyquist / minF, b / NUM_FEATURES);
    const hi = minF * Math.pow(nyquist / minF, (b + 1) / NUM_FEATURES);
    const li = Math.floor((lo / nyquist) * mag.length);
    const hi2 = Math.min(Math.ceil((hi / nyquist) * mag.length), mag.length);
    let e = 0, c = 0;
    for (let i = li; i < hi2; i++) { e += mag[i] * mag[i]; c++; }
    bins[b] = c > 0 ? Math.sqrt(e / c) * gainFactor + (Math.random() - 0.5) * noiseAmp : 0;
  }
  let sum = 0;
  for (let i = 0; i < NUM_FEATURES; i++) sum += bins[i];
  if (sum > 0) for (let i = 0; i < NUM_FEATURES; i++) bins[i] /= sum;
  return bins;
}

function extractFeatures(samples: Float32Array, onsetSec: number, sampleRate: number, noiseAmp = 0, gainFactor = 1): Float32Array {
  const center = Math.floor(onsetSec * sampleRate);
  const start  = Math.max(0, center - PRE_ROLL);
  const frame  = new Float32Array(WINDOW);
  frame.set(samples.slice(start, start + WINDOW));
  return logFreqBins(fftMag(frame), sampleRate, noiseAmp, gainFactor);
}

// ─── Synthetic log-freq profiles for classes not in dataset ──────────────────

function synthFeatures(cls: number): number[] {
  const f = new Array<number>(NUM_FEATURES).fill(0);
  const n = () => Math.random() * 0.08;
  if (cls === 3) { // tom1
    for (let i = 0; i < 10; i++) f[i] = 0.35 + n();
    for (let i = 10; i < 30; i++) f[i] = 0.75 - (i - 10) * 0.015 + n();
    for (let i = 30; i < 60; i++) f[i] = 0.45 + n();
    for (let i = 60; i < NUM_FEATURES; i++) f[i] = Math.max(0, 0.15 - (i - 60) * 0.002) + n() * 0.3;
  } else if (cls === 4) { // tom2
    for (let i = 0; i < 15; i++) f[i] = 0.55 - i * 0.01 + n();
    for (let i = 15; i < 40; i++) f[i] = 0.78 - (i - 15) * 0.018 + n();
    for (let i = 40; i < 70; i++) f[i] = 0.3 + n();
    for (let i = 70; i < NUM_FEATURES; i++) f[i] = n() * 0.3;
  } else if (cls === 5) { // tom3
    for (let i = 0; i < 20; i++) f[i] = 0.8 - i * 0.02 + n();
    for (let i = 20; i < 45; i++) f[i] = 0.45 - (i - 20) * 0.01 + n();
    for (let i = 45; i < NUM_FEATURES; i++) f[i] = n() * 0.25;
  } else if (cls === 6) { // crash
    for (let i = 0; i < NUM_FEATURES; i++) {
      f[i] = 0.3 + Math.random() * 0.4;
      if (i > 70) f[i] *= 1.6;
      if (i < 15) f[i] *= 0.5;
      f[i] = Math.min(1, f[i]);
    }
  } else if (cls === 7) { // ride
    for (let i = 0; i < 40; i++) f[i] = n() * 0.3;
    for (let i = 40; i < 80; i++) f[i] = 0.45 + n();
    for (let i = 80; i < 115; i++) f[i] = 0.65 + n();
    for (let i = 115; i < NUM_FEATURES; i++) f[i] = 0.3 + n();
  }
  const sum = f.reduce((a, b) => a + b, 0) + 1e-8;
  return f.map(v => Math.max(0, v) / sum);
}

// ─── Dense model ──────────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂  Loading IDMT-SMT-DRUMS-V2...\n");

  const xmlFiles = fs.readdirSync(DATASET_XML).filter((f) => f.endsWith(".xml"));
  const featureArrays: Float32Array[] = [];
  const allLabels: number[] = [];
  const classCount: Record<number, number> = {};
  let totalReal = 0,
    skipped = 0;

  const total_files = xmlFiles.length;
  for (let fi = 0; fi < total_files; fi++) {
    const xmlFile = xmlFiles[fi];
    if (fi % 5 === 0)
      process.stdout.write(
        `  📁  ${fi}/${total_files} archivos... (${featureArrays.length} muestras)\r`,
      );
    const base = xmlFile.replace("#MIX.xml", "");
    const onsets = parseXML(fs.readFileSync(path.join(DATASET_XML, xmlFile), "utf-8"));
    const groups: Record<string, number[]> = { KD: [], SD: [], HH: [] };
    for (const { instrument, onsetSec } of onsets) {
      if (instrument in groups) groups[instrument].push(onsetSec);
    }

    for (const [inst, times] of Object.entries(groups)) {
      const cls = REAL_LABEL[inst];
      const wavPath = path.join(DATASET_AUDIO, `${base}#${inst}#train.wav`);
      if (!fs.existsSync(wavPath)) {
        skipped++;
        continue;
      }
      let wav: ReturnType<typeof parseWAV>;
      try {
        wav = parseWAV(fs.readFileSync(wavPath));
      } catch (e) {
        console.warn(`  ⚠  Skip ${wavPath}: ${e}`);
        skipped++;
        continue;
      }

      for (const t of times) {
        if ((classCount[cls] ?? 0) >= MAX_PER_CLASS) continue;

        featureArrays.push(extractFeatures(wav.samples, t, wav.sampleRate));
        allLabels.push(cls);
        classCount[cls] = (classCount[cls] ?? 0) + 1;
        totalReal++;
      }
    }
  }

  console.log(); // nueva línea tras el \r
  const totalRealAug = totalReal * (1 + AUG_FACTOR);
  console.log(
    `✅  Real samples: ${totalReal} × ${1 + AUG_FACTOR} aug = ${totalRealAug} (${skipped} files skipped)`,
  );

  // Synthetic data for tom1/tom2/tom3/crash/ride
  for (const cls of SYNTH_CLASSES) {
    for (let i = 0; i < SYNTH_PER_CLASS; i++) {
      featureArrays.push(Float32Array.from(synthFeatures(cls)));
      allLabels.push(cls);
    }
  }

  const total = allLabels.length;
  console.log(`✅  Synthetic: ${SYNTH_CLASSES.length * SYNTH_PER_CLASS}`);
  console.log(`📊  Total: ${total} samples\n`);

  const dist: Record<number, number> = {};
  allLabels.forEach((l) => {
    dist[l] = (dist[l] || 0) + 1;
  });
  CLASS_NAMES.forEach((name, i) => console.log(`  ${name.padEnd(8)}: ${dist[i] || 0}`));
  console.log();

  // Shuffle indices
  const idx = Array.from({ length: total }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }

  // Build flat Float32Array from shuffled feature arrays
  const shuffledFeats = new Float32Array(total * NUM_FEATURES);
  const shuffledLabels = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    const src = idx[i];
    shuffledFeats.set(featureArrays[src], i * NUM_FEATURES);
    shuffledLabels[i] = allLabels[src];
  }

  const split = Math.floor(total * 0.85);
  const xs = tf.tensor2d(shuffledFeats, [total, NUM_FEATURES]);
  const ys = tf.oneHot(tf.tensor1d(shuffledLabels, "int32"), 8);
  const xTrain = xs.slice([0, 0], [split, NUM_FEATURES]);
  const yTrain = ys.slice([0, 0], [split, 8]);
  const xVal   = xs.slice([split, 0], [total - split, NUM_FEATURES]);
  const yVal   = ys.slice([split, 0], [total - split, 8]);

  console.log("🧠  Building Dense model...");
  const model = buildDense();
  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
  model.summary();

  console.log(`\n🔧  Backend: ${tf.getBackend()}`);
  console.log("\n🏋️   Training (max 40 epochs, early stopping patience=5)...\n");

  let bestValAcc = 0,
    patience = 0;
  const PATIENCE = 12;

  await model.fit(xTrain, yTrain, {
    epochs: 100,
    batchSize: 64,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const acc = logs?.acc ?? logs?.accuracy ?? 0;
        const valAcc = logs?.val_acc ?? logs?.val_accuracy ?? 0;
        console.log(
          `  Epoch ${String(epoch + 1).padStart(2)}` +
            `  loss: ${logs?.loss?.toFixed(4)}` +
            `  acc: ${(acc * 100).toFixed(1)}%` +
            `  val_acc: ${(valAcc * 100).toFixed(1)}%`,
        );

        if (valAcc > bestValAcc + 0.001) {
          bestValAcc = valAcc;
          patience = 0;
        } else {
          patience++;
          if (patience >= PATIENCE) {
            console.log(
              `\n⏹  Early stopping at epoch ${epoch + 1} (val_acc no mejoró en ${PATIENCE} epochs)`,
            );
            (model as any).stopTraining = true;
          }
        }
      },
    },
  });

  console.log("\n💾  Saving model...");
  fs.mkdirSync(MODEL_OUTPUT, { recursive: true });

  const saveHandler = tf.io.withSaveHandler(async (artifacts) => {
    const manifest = [{ paths: ["weights.bin"], weights: artifacts.weightSpecs }];
    const modelJson = {
      modelTopology: artifacts.modelTopology,
      weightsManifest: manifest,
      format: artifacts.format,
      generatedBy: artifacts.generatedBy,
      convertedBy: artifacts.convertedBy,
    };
    fs.writeFileSync(path.join(MODEL_OUTPUT, "model.json"), JSON.stringify(modelJson));
    fs.writeFileSync(
      path.join(MODEL_OUTPUT, "weights.bin"),
      Buffer.from(artifacts.weightData as ArrayBuffer),
    );
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" as const } };
  });

  await model.save(saveHandler);
  console.log(`\n✅  Saved → ${MODEL_OUTPUT}`);

  xs.dispose();
  ys.dispose();
  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
