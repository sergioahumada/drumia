import React, { useState } from "react";
import {
  SongStructure,
  DrumSection,
  validateJSONString,
  generateSampleJSON,
  beatsToMilliseconds,
  getCurrentSection,
} from "../../services/songStructureParser";

interface SongStructureProps {
  bpm: number;
  currentTime: number;
  onSectionSelect?: (section: DrumSection) => void;
  onFocusSectionChange?: (startTime: number, endTime: number) => void;
}

export function SongStructureComponent({
  bpm,
  currentTime,
  onSectionSelect,
  onFocusSectionChange,
}: SongStructureProps) {
  const [structure, setStructure] = useState<SongStructure | null>(null);
  const [error, setError] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = validateJSONString(content);

        if (!parsed) {
          setError("JSON inválido o formato incorrecto");
          return;
        }

        setStructure(parsed);
        setError("");
      } catch (err) {
        setError("Error al leer el archivo: " + String(err));
      }
    };

    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sample = generateSampleJSON();
    const jsonString = JSON.stringify(sample, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "song-structure-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePracticeFocus = (section: DrumSection) => {
    setSelectedSectionId(section.id);
    const startMs = beatsToMilliseconds(section.startTime, bpm);
    const endMs = beatsToMilliseconds(section.endTime, bpm);
    onFocusSectionChange?.(startMs, endMs);
    onSectionSelect?.(section);
  };

  if (!structure) {
    return (
      <div className="w-full flex justify-center mt-8">
        <div className="w-full max-w-2xl bg-[#1f1f2e] p-8 rounded-2xl border border-indigo-500/20 shadow-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            📋 Estructura de la Canción
          </h3>
          <p className="text-gray-400 mb-8 text-center">
            Carga un archivo JSON para ver las secciones y practicar partes específicas
          </p>

          <div className="flex flex-col gap-6 items-center">
            <div className="w-full border-2 border-dashed border-gray-700 rounded-xl p-8 transition-all hover:bg-white/5 group relative text-center">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="song-json-upload"
              />
              <label
                htmlFor="song-json-upload"
                className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-indigo-400"
              >
                <span className="text-3xl">📁</span>
                <span className="text-sm font-medium">Selecciona archivo JSON</span>
              </label>
            </div>

            {error && (
              <p className="w-full p-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm">
                {error}
              </p>
            )}

            <button
              onClick={handleDownloadSample}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-gray-700 rounded-lg transition-all text-sm font-medium"
            >
              📥 Descargar ejemplo JSON
            </button>

            <div className="w-full mt-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                Formato esperado:
              </h4>
              <pre className="p-4 bg-black/40 rounded-lg text-[10px] text-gray-400 font-mono overflow-x-auto border border-white/5">
                {`{
  "metadata": {
    "title": "Song Name",
    "bpm": 120,
    "timeSignature": "4/4",
    "duration": 240
  },
  "sections": [
    {
      "id": "intro",
      "name": "Intro",
      "startTime": 0,
      "endTime": 8,
      "instruments": ["kick", "hat"],
      "difficulty": "easy",
      "pattern": "basic"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = getCurrentSection(structure, currentTime);

  return (
    <div className="flex flex-col gap-8 mt-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1f1f2e] p-6 rounded-2xl border border-indigo-500/10 shadow-lg">
        <div className="flex flex-col">
          <h3 className="text-xl font-bold text-white">{structure.metadata.title}</h3>
          {structure.metadata.artist && (
            <p className="text-sm text-gray-500 font-medium">{structure.metadata.artist}</p>
          )}
        </div>

        <div className="relative">
          <label
            htmlFor="song-json-upload-replace"
            className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 cursor-pointer transition-all text-xs font-bold"
          >
            🔄 Cambiar JSON
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            id="song-json-upload-replace"
          />
        </div>
      </div>

      {currentSection && (
        <div className="flex items-center gap-3 bg-indigo-500/10 px-4 py-3 rounded-xl border border-indigo-500/30 self-start animate-pulse">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
            Sección Actual:
          </span>
          <span className="text-sm font-bold text-white">{currentSection.name}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black tracking-tighter ${
              currentSection.difficulty === "hard"
                ? "bg-red-500 text-white"
                : currentSection.difficulty === "medium"
                  ? "bg-orange-500 text-white"
                  : "bg-green-500 text-white"
            }`}
          >
            {currentSection.difficulty}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
          Secciones ({structure.sections.length})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structure.sections.map((section) => {
            const startMs = beatsToMilliseconds(section.startTime, bpm);
            const endMs = beatsToMilliseconds(section.endTime, bpm);
            const isActive = currentTime >= startMs && currentTime < endMs;
            const isSelected = selectedSectionId === section.id;

            return (
              <div
                key={section.id}
                className={`flex flex-col justify-between p-5 rounded-2xl border-2 transition-all group ${
                  isActive
                    ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    : isSelected
                      ? "bg-[#2a2a3e] border-indigo-500/40"
                      : "bg-[#1f1f2e] border-transparent hover:border-indigo-500/20 hover:bg-[#252538]"
                }`}
              >
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {section.name}
                    </h5>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black ${
                        section.difficulty === "hard"
                          ? "bg-red-500/20 text-red-400"
                          : section.difficulty === "medium"
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {section.difficulty}
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-500 font-mono">
                    {section.startTime}-{section.endTime} beats
                  </p>

                  <p className="text-xs text-gray-300 italic opacity-60">
                    Pattern: {section.pattern}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {section.instruments.map((inst) => (
                      <span
                        key={inst}
                        className="text-[9px] px-1.5 py-0.5 bg-black/40 text-gray-400 rounded-md border border-white/5 uppercase font-bold"
                      >
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handlePracticeFocus(section)}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    🎯 Practicar
                  </button>
                  {section.notes && (
                    <p className="text-[10px] text-gray-500 italic line-clamp-2">{section.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="p-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
