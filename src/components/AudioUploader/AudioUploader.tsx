import React, { useRef, useState } from "react";
import { validateAudioFile, decodeAudioFile } from "../../services/audioProcessor";

interface AudioFiles {
  drum: File | null;
  drumBuffer: AudioBuffer | null;
  song?: File | null;
  songBuffer?: AudioBuffer | null;
}

interface AudioUploaderProps {
  onAudioLoaded: (files: AudioFiles) => void;
  isLoading?: boolean;
  externalError?: string | null;
}

export function AudioUploader({ 
  onAudioLoaded, 
  isLoading = false, 
  externalError = null 
}: AudioUploaderProps) {
  const drumInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);

  const loadingMessages = [
    "Analizando transientes...",
    "Calculando el pulso (BPM)...",
    "Identificando patrones de bombo y redoblante...",
    "Generando partitura digital...",
    "Preparando tu sala de ensayo...",
  ];

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);
  const [files, setFiles] = useState<AudioFiles>({
    drum: null,
    drumBuffer: null,
    song: null,
    songBuffer: null,
  });

  const handleFile = async (file: File, type: "drum" | "song") => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setError(validation.error || "Error desconocido");
      return;
    }

    try {
      setError(null);
      setIsDecoding(true);
      const buffer = await decodeAudioFile(file);

      setFiles((prev) => {
        const updated = { ...prev };
        if (type === "drum") {
          updated.drum = file;
          updated.drumBuffer = buffer;
        } else {
          updated.song = file;
          updated.songBuffer = buffer;
        }
        return updated;
      });
    } catch (err) {
      setError("Error al procesar el archivo de audio");
      console.error(err);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleDrumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0], "drum");
    }
  };

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0], "song");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0], "drum");
    }
  };

  const handleStart = () => {
    if (files.drumBuffer) {
      onAudioLoaded(files);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-bg-darker p-5">
      <div className="w-full max-w-[700px] p-6 sm:p-10 rounded-2xl bg-bg-dark/80 backdrop-blur-md border border-primary/20 flex flex-col gap-8">
        <div className="text-center flex flex-col items-center gap-4">
          <img
            src="/logo.png"
            alt="Drumia Logo"
            className="w-[100px] rounded-lg h-[100px] sm:w-[120px] sm:h-[120px] object-contain drop-shadow-[0_0_25px_rgba(139,92,246,0.5)] animate-logo-pulse"
          />
          <p className="text-gray-400 text-base sm:text-lg">Aprende a tocar batería</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div
            className={`p-6 border-2 border-dashed rounded-xl text-center transition-all bg-white/5 cursor-pointer flex flex-col gap-4 items-center justify-center min-h-[160px] sm:min-h-[200px] ${
              dragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-gray-700"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={drumInputRef}
              type="file"
              accept="audio/*"
              onChange={handleDrumChange}
              disabled={isLoading || isDecoding}
              className="hidden"
            />

            <div className="font-semibold text-gray-300 text-sm">🥁 Batería (obligatorio)</div>

            {files.drum ? (
              <div className="flex items-center gap-2 text-[#4ecdc4] text-sm">
                <span className="text-xl font-bold">✓</span>
                <span className="max-w-[150px] sm:max-w-[200px] truncate">{files.drum.name}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => drumInputRef.current?.click()}
                  disabled={isLoading || isDecoding}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDecoding ? "Decodificando..." : "Selecciona batería"}
                </button>
                <p className="text-[#666] text-xs m-0">o arrastra aquí</p>
              </>
            )}
          </div>

          <div className="p-6 border-2 border-dashed border-gray-600 rounded-xl text-center transition-all bg-white/5 hover:border-pink-500 hover:bg-pink-500/5 cursor-pointer flex flex-col gap-4 items-center justify-center min-h-[160px] sm:min-h-[200px]">
            <input
              ref={songInputRef}
              type="file"
              accept="audio/*"
              onChange={handleSongChange}
              disabled={isLoading || isDecoding}
              className="hidden"
            />

            <div className="font-semibold text-gray-300 text-sm">🎵 Canción (opcional)</div>

            {files.song ? (
              <div className="flex items-center gap-2 text-[#4ecdc4] text-sm">
                <span className="text-xl font-bold">✓</span>
                <span className="max-w-[150px] sm:max-w-[200px] truncate">{files.song.name}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => songInputRef.current?.click()}
                  disabled={isLoading || isDecoding}
                  className="px-5 py-2.5 text-sm font-semibold text-primary bg-primary/20 rounded-lg transition-all hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDecoding ? "Decodificando..." : "Selecciona canción"}
                </button>
                <p className="text-[#666] text-xs m-0">(para mejor práctica)</p>
              </>
            )}
          </div>
        </div>

        <p className="text-[#555] text-xs text-center m-0">
          Formatos: MP3, WAV, OGG, M4A • Máximo: 10 minutos
        </p>

        {(error || externalError) && (
          <p className="text-[#ff6b6b] p-3 bg-red-500/10 rounded-lg m-0 border border-red-500/30 text-sm">
            {error || externalError}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={!files.drumBuffer || isLoading}
          className="px-7 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-primary to-secondary rounded-lg self-center transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(139,92,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Empezar a practicar →
        </button>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-[#0f0f19]/90 backdrop-blur-[20px] flex items-center justify-center z-[1000] animate-[fadeIn_0.5s_ease-out]">
          <div className="flex flex-col items-center gap-10 max-w-[400px] text-center">
            <div className="relative w-[120px] h-[120px]">
              <div className="absolute bottom-0 w-full h-[60px] bg-gradient-to-b from-primary to-indigo-900 rounded-[50%] shadow-[0_10px_0_#4c1d95,0_20px_30px_rgba(139,92,246,0.4)] animate-drum-bounce"></div>
              <div className="absolute w-1.5 h-20 bg-white rounded-[3px] origin-bottom left-[30px] top-0 -rotate-[30deg] animate-left-stick"></div>
              <div className="absolute w-1.5 h-20 bg-white rounded-[3px] origin-bottom right-[30px] top-0 rotate-[30deg] animate-right-stick"></div>
            </div>
            <div className="loading-text">
              <h2 className="text-[28px] m-0 mb-3 bg-gradient-to-br from-white to-primary bg-clip-text text-transparent font-bold">
                Analizando tu música
              </h2>
              <p className="text-gray-400 text-base mb-6">{loadingMessages[loadingStep]}</p>
              <div className="w-full h-1.5 bg-white/5 rounded-[3px] overflow-hidden relative border border-white/5">
                <div className="w-[40%] h-full bg-gradient-to-r from-transparent via-primary to-secondary absolute -left-[40%] animate-progress-move"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
