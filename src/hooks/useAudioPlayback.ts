import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayback(audioBuffer: AudioBuffer | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSource | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration * 1000);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
  }, [audioBuffer]);

  const updateTime = useCallback(() => {
    if (isPlaying && audioContextRef.current) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * 1000;
      const newTime = pausedTimeRef.current + elapsed;
      setCurrentTime(Math.min(newTime, duration));

      if (newTime < duration) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateTime]);

  const play = useCallback(() => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speed;
    source.connect(audioContextRef.current.destination);

    sourceRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    source.start(0, pausedTimeRef.current / 1000);
    setIsPlaying(true);
  }, [audioBuffer, speed]);

  const pause = useCallback(() => {
    if (sourceRef.current && audioContextRef.current) {
      sourceRef.current.stop();
      pausedTimeRef.current = currentTime;
      setIsPlaying(false);
    }
  }, [currentTime]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
    }
    pausedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    pausedTimeRef.current = Math.min(time, duration);
    setCurrentTime(pausedTimeRef.current);

    if (isPlaying) {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {}
      }
      play();
    }
  }, [isPlaying, duration, play]);

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (sourceRef.current) {
      sourceRef.current.playbackRate.value = newSpeed;
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    speed,
    duration,
    play,
    pause,
    stop,
    seek,
    changeSpeed,
  };
}
