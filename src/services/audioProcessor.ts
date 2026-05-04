export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Formato no soportado. Usa MP3, WAV, OGG o M4A' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Archivo muy grande (máximo 100MB)' };
  }

  return { valid: true };
}
