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
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration * 1000);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
  }, [audioBuffer]);

  // Actualizar refs para evitar stale closures
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const updateTime = useCallback(() => {
    if (!isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * 1000 * speedRef.current;
    const newTime = pausedTimeRef.current + elapsed;

    if (newTime >= duration) {
      setCurrentTime(duration);
      setIsPlaying(false);
      return;
    }

    setCurrentTime(newTime);
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [duration]);

  const play = useCallback(() => {
    if (!audioBuffer || !audioContextRef.current) return;

    // Parar fuente anterior si existe
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speedRef.current;
    source.connect(audioContextRef.current.destination);

    sourceRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    const offsetTime = pausedTimeRef.current / 1000;
    source.start(0, offsetTime);

    setIsPlaying(true);
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [audioBuffer, updateTime]);

  const pause = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
    }
    pausedTimeRef.current = currentTime;
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const seek = useCallback(
    (time: number) => {
      const newTime = Math.min(time, duration);
      pausedTimeRef.current = newTime;
      setCurrentTime(newTime);

      if (isPlayingRef.current) {
        if (sourceRef.current) {
          try {
            sourceRef.current.stop();
          } catch {}
        }
        play();
      }
    },
    [duration, play]
  );

  const changeSpeed = useCallback((newSpeed: number) => {
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
    if (sourceRef.current) {
      sourceRef.current.playbackRate.value = newSpeed;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
