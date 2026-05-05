interface PlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  onPlayClick: () => void;
  onPauseClick: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function Player({
  isPlaying,
  currentTime,
  duration,
  speed,
  onPlayClick,
  onPauseClick,
  onSeek,
  onSpeedChange,
}: PlayerProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  //const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-bg-dark p-5 rounded-lg flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="px-4 py-2 text-xl bg-indigo-500 text-white rounded-lg transition-all hover:bg-indigo-600 hover:scale-105"
          onClick={isPlaying ? onPauseClick : onPlayClick}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-300">
          <label>Velocidad:</label>
          <select
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="px-2.5 py-1.5 bg-[#2a2a3e] text-white border border-gray-700 rounded cursor-pointer outline-none focus:border-indigo-500"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
