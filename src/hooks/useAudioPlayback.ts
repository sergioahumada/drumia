import { useState, useRef, useCallback, useEffect } from 'react';
import { Howl } from 'howler';

export function useAudioPlayback(audioBuffer: AudioBuffer | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(0);
  const howlRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration * 1000);
    }
  }, [audioBuffer]);

  const updateTime = useCallback(() => {
    if (howlRef.current && isPlaying) {
      setCurrentTime(howlRef.current.seek() * 1000);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying]);

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
    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.stop();
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (howlRef.current) {
      howlRef.current.seek(time / 1000);
      setCurrentTime(time);
    }
  }, []);

  const changeSpeed = useCallback((newSpeed: number) => {
    if (howlRef.current) {
      howlRef.current.rate(newSpeed);
      setSpeed(newSpeed);
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
    howlRef,
  };
}
