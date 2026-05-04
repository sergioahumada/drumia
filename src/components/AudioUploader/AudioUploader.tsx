import React, { useRef, useState } from 'react';
import { validateAudioFile, decodeAudioFile } from '../../services/audioProcessor';
import './AudioUploader.css';

interface AudioFiles {
  drum: File | null;
  drumBuffer: AudioBuffer | null;
  song?: File | null;
  songBuffer?: AudioBuffer | null;
}

interface AudioUploaderProps {
  onAudioLoaded: (files: AudioFiles) => void;
  isLoading?: boolean;
}

export function AudioUploader({ onAudioLoaded, isLoading = false }: AudioUploaderProps) {
  const drumInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<AudioFiles>({
    drum: null,
    drumBuffer: null,
    song: null,
    songBuffer: null,
  });

  const handleFile = async (file: File, type: 'drum' | 'song') => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Error desconocido');
      return;
    }

    try {
      setError(null);
      const buffer = await decodeAudioFile(file);

      setFiles((prev) => {
        const updated = { ...prev };
        if (type === 'drum') {
          updated.drum = file;
          updated.drumBuffer = buffer;
        } else {
          updated.song = file;
          updated.songBuffer = buffer;
        }
        return updated;
      });
    } catch (err) {
      setError('Error al procesar el archivo de audio');
      console.error(err);
    }
  };

  const handleDrumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0], 'drum');
    }
  };

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0], 'song');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0], 'drum');
    }
  };

  const handleStart = () => {
    if (files.drumBuffer) {
      onAudioLoaded(files);
    }
  };

  return (
    <div className="audio-uploader">
      <div className="uploader-container">
        <div className="header">
          <h1>DRUMIA</h1>
          <p>Aprende a tocar batería</p>
        </div>

        <div className="upload-sections">
          {/* Sección de Batería (obligatorio) */}
          <div
            className={`upload-section drum ${dragActive ? 'active' : ''}`}
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
              disabled={isLoading}
              className="file-input"
            />

            <div className="section-label">🥁 Batería (obligatorio)</div>

            {files.drum ? (
              <div className="file-selected">
                <span className="checkmark">✓</span>
                <span className="filename">{files.drum.name}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => drumInputRef.current?.click()}
                  disabled={isLoading}
                  className="upload-btn"
                >
                  {isLoading ? 'Procesando...' : 'Selecciona batería'}
                </button>
                <p className="upload-hint">o arrastra aquí</p>
              </>
            )}
          </div>

          {/* Sección de Canción (opcional) */}
          <div className="upload-section song">
            <input
              ref={songInputRef}
              type="file"
              accept="audio/*"
              onChange={handleSongChange}
              disabled={isLoading}
              className="file-input"
            />

            <div className="section-label">🎵 Canción (opcional)</div>

            {files.song ? (
              <div className="file-selected">
                <span className="checkmark">✓</span>
                <span className="filename">{files.song.name}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => songInputRef.current?.click()}
                  disabled={isLoading}
                  className="upload-btn secondary"
                >
                  {isLoading ? 'Procesando...' : 'Selecciona canción'}
                </button>
                <p className="upload-hint">(para mejor práctica)</p>
              </>
            )}
          </div>
        </div>

        <p className="format-info">Formatos: MP3, WAV, OGG, M4A • Máximo: 10 minutos</p>

        {error && <p className="error-message">{error}</p>}

        <button
          onClick={handleStart}
          disabled={!files.drumBuffer || isLoading}
          className="start-btn"
        >
          Empezar a practicar →
        </button>
      </div>
    </div>
  );
}
