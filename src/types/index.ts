export type DrumEventType = 'kick' | 'snare' | 'hat' | 'tom';

export interface DrumEvent {
  time: number;
  type: DrumEventType;
  intensity: number;
  duration?: number;
}

export interface AnalysisResult {
  bpm: number;
  timeSignature: string;
  duration: number;
  events: DrumEvent[];
}

export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  speed: number;
}

export interface Session {
  id: string;
  fileName: string;
  uploadedAt: number;
  analysis: AnalysisResult;
  playbackState: PlaybackState;
}
