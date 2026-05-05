import { GoogleGenerativeAI } from '@google/generative-ai';

let geminiClient: GoogleGenerativeAI | null = null;

export function initGemini(apiKey: string) {
  if (!apiKey) {
    console.warn('Gemini API key not provided');
    return null;
  }

  try {
    geminiClient = new GoogleGenerativeAI(apiKey);
    return geminiClient;
  } catch (error) {
    console.error('Error initializing Gemini:', error);
    return null;
  }
}

export interface DetectionEvent {
  time: number;
  type: 'kick' | 'snare' | 'hat' | 'tom1' | 'tom2' | 'tom3' | 'crash' | 'ride';
  intensity: number;
}

export interface RefinedAnalysis {
  events: DetectionEvent[];
  feedback: string;
  patternAnalysis: string;
}

/**
 * Usar Gemini para refinar detecciones y dar retroalimentación
 */
export async function analyzeWithGemini(
  events: DetectionEvent[],
  bpm: number,
  duration: number,
  songName?: string
): Promise<RefinedAnalysis> {
  if (!geminiClient) {
    return {
      events,
      feedback: 'Gemini no inicializado',
      patternAnalysis: '',
    };
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Crear prompt para análisis
    const prompt = generateAnalysisPrompt(events, bpm, duration, songName);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parsear respuesta de Gemini
    const analysis = parseGeminiResponse(text, events);

    return analysis;
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    return {
      events,
      feedback: 'Error en análisis con Gemini',
      patternAnalysis: '',
    };
  }
}

/**
 * Generar sugerencias de práctica basadas en el análisis
 */
export async function generatePracticeFeedback(
  events: DetectionEvent[],
  bpm: number,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<string> {
  if (!geminiClient) {
    return 'Gemini no disponible para feedback';
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const eventSummary = summarizeEvents(events);
    const prompt = `
Eres un instructor de batería experto. Analiza este patrón de batería y proporciona retroalimentación constructiva para mejorar la práctica.

Patrón detectado:
${eventSummary}

BPM: ${bpm}
Dificultad: ${difficulty}

Proporciona:
1. Análisis del patrón (estructura, dificultad)
2. 3 consejos específicos para practicar
3. Ejercicios de calentamiento recomendados
4. Áreas de enfoque para mejorar

Responde en español, de forma concisa y práctica.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating feedback:', error);
    return 'Error generando feedback';
  }
}

/**
 * Generar nuevos patrones de batería para practicar
 */
export async function generateDrumPattern(
  bpm: number,
  complexity: 'easy' | 'medium' | 'hard',
  style: string = 'rock'
): Promise<string> {
  if (!geminiClient) {
    return 'Gemini no disponible';
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
Eres un compositor de batería. Genera un patrón de batería nuevo para practicar.

Especificaciones:
- BPM: ${bpm}
- Complejidad: ${complexity}
- Estilo: ${style}
- Duración: 8 compases (4/4)

Formato de respuesta (notación simple):
- K = Kick
- S = Snare
- H = Hi-hat cerrado
- O = Hi-hat abierto
- T1/T2/T3 = Toms
- C = Crash
- R = Ride

Ejemplo para 1 compás a 4/4:
H H H H
K   K
  S   S

Genera el patrón completo de 8 compases con instrucciones de cómo ejecutarlo.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating pattern:', error);
    return 'Error generando patrón';
  }
}

// ==================== Funciones auxiliares ====================

function generateAnalysisPrompt(
  events: DetectionEvent[],
  bpm: number,
  duration: number,
  songName?: string
): string {
  const eventSummary = summarizeEvents(events);
  const songInfo = songName ? `Canción: ${songName}\n` : '';

  return `
Analiza este patrón de batería detectado automáticamente y proporciona retroalimentación.

${songInfo}BPM: ${bpm}
Duración: ${(duration / 1000).toFixed(1)}s
Eventos detectados:
${eventSummary}

Por favor:
1. Evalúa la precisión probable de la detección
2. Describe el patrón rítmico identificado
3. Sugiere correcciones si identifica inconsistencias
4. Proporciona 2-3 consejos para tocar este patrón

Responde en español de forma clara y útil para un músico.
`;
}

function summarizeEvents(events: DetectionEvent[]): string {
  if (events.length === 0) return 'No se detectaron eventos';

  // Agrupar eventos por tipo
  const byType: Record<string, number> = {};
  events.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
  });

  // Crear resumen
  let summary = 'Resumen de eventos:\n';
  Object.entries(byType).forEach(([type, count]) => {
    summary += `- ${type}: ${count} eventos\n`;
  });

  // Agregar primeros 10 eventos con timeline
  summary += '\nPrimeros eventos (timeline):\n';
  events.slice(0, 10).forEach((e) => {
    summary += `- ${(e.time / 1000).toFixed(2)}s: ${e.type} (intensidad: ${(e.intensity * 100).toFixed(0)}%)\n`;
  });

  if (events.length > 10) {
    summary += `... y ${events.length - 10} eventos más`;
  }

  return summary;
}

function parseGeminiResponse(text: string, originalEvents: DetectionEvent[]): RefinedAnalysis {
  // Parsear respuesta de Gemini
  const sections = text.split('\n\n');

  let feedback = '';
  let patternAnalysis = '';

  sections.forEach((section) => {
    if (
      section.toLowerCase().includes('evaluá') ||
      section.toLowerCase().includes('consej') ||
      section.toLowerCase().includes('precis')
    ) {
      feedback += section + '\n';
    } else if (
      section.toLowerCase().includes('patrón') ||
      section.toLowerCase().includes('estructura') ||
      section.toLowerCase().includes('rítmico')
    ) {
      patternAnalysis += section + '\n';
    }
  });

  return {
    events: originalEvents,
    feedback: feedback || text.substring(0, 500),
    patternAnalysis: patternAnalysis || text.substring(500, 1000),
  };
}
