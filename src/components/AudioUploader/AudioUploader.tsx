import React, { useRef, useState } from 'react';
import { validateAudioFile, decodeAudioFile } from '../../services/audioProcessor';
import './AudioUploader.css';

interface AudioUploaderProps {
  onAudioLoaded: (file: File, buffer: AudioBuffer) => void;
  isLoading?: boolean;
}

export function AudioUploader({ onAudioLoaded, isLoading = false }: AudioUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Error desconocido');
      return;
    }

    try {
      setError(null);
      const buffer = await decodeAudioFile(file);
      onAudioLoaded(file, buffer);
    } catch (err) {
      setError('Error al procesar el archivo de audio');
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="audio-uploader">
      <div
        className={`upload-area ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          disabled={isLoading}
          className="file-input"
        />

        <div className="upload-content">
          <h1>DRUMIA</h1>
          <p>Aprende a tocar batería</p>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="upload-btn"
          >
            {isLoading ? 'Procesando...' : 'Selecciona un archivo'}
          </button>

          <p className="upload-hint">o arrastra tu archivo aquí</p>
          <p className="format-info">Formatos: MP3, WAV, OGG, M4A • Máximo: 10 minutos</p>

          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    </div>
  );
}
