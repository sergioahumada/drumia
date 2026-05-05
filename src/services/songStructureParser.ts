export interface SongMetadata {
  title: string;
  artist?: string;
  bpm: number;
  timeSignature: string;
  duration: number; // segundos
}

export interface DrumSection {
  id: string;
  name: string;
  startTime: number; // beats
  endTime: number; // beats
  instruments: Array<'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride'>;
  difficulty: 'easy' | 'medium' | 'hard';
  pattern: string;
  notes?: string;
}

export interface PracticeSettings {
  focusSection?: string;
  tempo?: number; // 0.5-1.5
  loops?: number;
}

export interface SongStructure {
  metadata: SongMetadata;
  sections: DrumSection[];
  practice?: PracticeSettings;
}

/**
 * Validar y parsear archivo JSON de estructura de canción
 */
export function parseSongStructure(jsonData: any): SongStructure | null {
  try {
    // Validar metadata
    if (!jsonData.metadata || !jsonData.sections) {
      throw new Error('JSON debe contener metadata y sections');
    }

    const { metadata, sections, practice } = jsonData;

    // Validar metadata
    if (!metadata.title || !metadata.bpm || !metadata.timeSignature || metadata.duration === undefined) {
      throw new Error('metadata debe contener: title, bpm, timeSignature, duration');
    }

    // Validar secciones
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('sections debe ser un array con al menos 1 elemento');
    }

    sections.forEach((section, index) => {
      if (!section.id || !section.name || section.startTime === undefined || section.endTime === undefined) {
        throw new Error(
          `Section ${index}: debe contener id, name, startTime, endTime`
        );
      }

      if (!Array.isArray(section.instruments) || section.instruments.length === 0) {
        throw new Error(`Section ${index}: instruments debe ser un array no vacío`);
      }

      if (!['easy', 'medium', 'hard'].includes(section.difficulty)) {
        throw new Error(`Section ${index}: difficulty debe ser easy, medium o hard`);
      }
    });

    return {
      metadata: {
        title: metadata.title,
        artist: metadata.artist || '',
        bpm: metadata.bpm,
        timeSignature: metadata.timeSignature,
        duration: metadata.duration,
      },
      sections: sections.map((s: any) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        instruments: s.instruments,
        difficulty: s.difficulty,
        pattern: s.pattern || 'standard',
        notes: s.notes || '',
      })),
      practice: practice || undefined,
    };
  } catch (error) {
    console.error('Error parsing song structure:', error);
    return null;
  }
}

/**
 * Validar JSON string
 */
export function validateJSONString(jsonString: string): SongStructure | null {
  try {
    const parsed = JSON.parse(jsonString);
    return parseSongStructure(parsed);
  } catch (error) {
    console.error('Invalid JSON:', error);
    return null;
  }
}

/**
 * Convertir beats a milisegundos basándose en BPM
 */
export function beatsToMilliseconds(beats: number, bpm: number): number {
  const beatDuration = (60 / bpm) * 1000; // duración de un beat en ms
  return beats * beatDuration;
}

/**
 * Convertir milisegundos a beats
 */
export function millisecondsToBeats(ms: number, bpm: number): number {
  const beatDuration = (60 / bpm) * 1000;
  return ms / beatDuration;
}

/**
 * Obtener sección actual basándose en tiempo
 */
export function getCurrentSection(
  structure: SongStructure,
  currentTimeMs: number
): DrumSection | null {
  const currentBeats = millisecondsToBeats(currentTimeMs, structure.metadata.bpm);

  return (
    structure.sections.find((section) => currentBeats >= section.startTime && currentBeats < section.endTime) ||
    null
  );
}

/**
 * Generar ejemplo de JSON para descargar
 */
export function generateSampleJSON(): SongStructure {
  return {
    metadata: {
      title: "Sample Song",
      artist: "Your Artist",
      bpm: 120,
      timeSignature: "4/4",
      duration: 240,
    },
    sections: [
      {
        id: "intro",
        name: "Intro",
        startTime: 0,
        endTime: 8,
        instruments: ["kick", "hat"],
        difficulty: "easy",
        pattern: "basic",
        notes: "Simple intro pattern",
      },
      {
        id: "verse1",
        name: "Verso 1",
        startTime: 8,
        endTime: 40,
        instruments: ["kick", "snare", "hat"],
        difficulty: "medium",
        pattern: "rock",
        notes: "Main verse groove",
      },
      {
        id: "chorus",
        name: "Coro",
        startTime: 40,
        endTime: 72,
        instruments: ["kick", "snare", "hat", "crash"],
        difficulty: "medium",
        pattern: "rock",
        notes: "Chorus with crash on beat 1",
      },
      {
        id: "fill",
        name: "Fill",
        startTime: 72,
        endTime: 80,
        instruments: ["tom1", "tom2", "tom3"],
        difficulty: "hard",
        pattern: "fill",
        notes: "Tom fill before final chorus",
      },
    ],
    practice: {
      focusSection: "verse1",
      tempo: 0.9,
      loops: 3,
    },
  };
}
