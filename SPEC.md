# Drumia: Especificación de App de Aprendizaje de Batería

## Context

**Drumia** es una aplicación web para aprender a tocar batería analizando audios de canciones o patrones de batería. 

**Público objetivo**: Todos los niveles (principiantes a avanzados)  
**Plataforma**: Web (React + TypeScript)  
**Almacenamiento**: Local (sesión del navegador)  
**Análisis**: Intermedio (tempo + patrones rítmicos)

---

## 1. Visión General de Características

### 1.1 Flujo Principal
1. **Carga de Audio**: Usuario sube archivo de audio (MP3/WAV) o canción
2. **Análisis Automático**: Sistema detecta:
   - Tempo (BPM)
   - Beat/compás
   - Patrones básicos (bombo, caja, hi-hat)
3. **Generación de Partitura**: Crea una visualización estándar de batería (4-line staff)
4. **Modo Práctica**: Interfaz interactiva con:
   - Partitura sincronizada con audio
   - Metrónomo visual (colores/luces por beat)
   - Controles de reproducción (play, pausa, velocidad)

### 1.2 Casos de Uso Principales
- **UC1**: Cargar canción → Ver partitura → Practicar con metrónomo
- **UC2**: Analizar patrón de batería puro → Crear partitura → Practicar
- **UC3**: Ajustar tempo → Guardar sesión en navegador → Continuar luego

---

## 2. Análisis de Requisitos

### 2.1 Requisitos Funcionales

#### Módulo: Carga de Audio
- RF-1.1: Aceptar archivos MP3, WAV, OGG, M4A
- RF-1.2: Validar duración máxima (ej: 10 minutos)
- RF-1.3: Mostrar progreso de carga y procesamiento

#### Módulo: Análisis de Audio
- RF-2.1: Detectar BPM (tempo) con ±2% de precisión
- RF-2.2: Identificar time signature (4/4, 3/4, etc.)
- RF-2.3: Detectar **patrones rítmicos básicos**:
  - Kicks (bombo): regiones bajas (0-150 Hz)
  - Snare (caja): mid-range (500-2000 Hz)
  - Hi-hat (platillo): highs (5000+ Hz)
- RF-2.4: Mapear eventos a timeline (timestamps en MS)

#### Módulo: Generación de Partitura
- RF-3.1: Crear representación visual en formato drum notation estándar
- RF-3.2: Mostrar 4 líneas (kick, snare, hi-hat, tom) o tabla simple
- RF-3.3: Sincronizar eventos con timeline de audio

#### Módulo: Interfaz de Práctica
- RF-4.1: Reproducir audio con barra de progreso
- RF-4.2: Partitura se desplaza/destaca sincronizado con reproducción
- RF-4.3: Metrónomo visual:
  - Luz/color que cambia en cada beat
  - Intensidad diferente por tipo de nota
- RF-4.4: Controles: play, pausa, rewind, ajustar velocidad (0.5x - 1.5x)
- RF-4.5: Guardar sesión en localStorage (partitura + tempo + estado)

### 2.2 Requisitos No-Funcionales

#### Rendimiento
- RNF-1.1: Análisis de audio < 10 segundos para archivo de 5 min
- RNF-1.2: Interfaz responde en < 100ms a interacciones del usuario
- RNF-1.3: Visualización renderiza 60 FPS durante reproducción

#### Compatibilidad
- RNF-2.1: Navegadores modernos (Chrome, Firefox, Safari, Edge últimas 2 versiones)
- RNF-2.2: Responsive design (desktop + tablet, opcional mobile)

#### Usabilidad
- RNF-3.1: Interfaz intuitiva, sin necesidad de manual
- RNF-3.2: Mensajes de error claros
- RNF-3.3: Accesibilidad básica (WCAG 2.1 Level AA)

---

## 3. Arquitectura Técnica

### 3.1 Stack de Tecnologías

| Componente | Tecnología | Justificación |
|-----------|-----------|---|
| **Frontend Framework** | React 18 + TypeScript | Componentes reutilizables, type-safe |
| **Audio Analysis** | Tone.js / Web Audio API | Extracción de features de audio |
| **Drum Beat Detection** | Essentia.js o Librosa WASM | Detección de tempo/patrones |
| **Visualización** | Pixi.js o Canvas nativo | Renderizado performante de partitura |
| **Reproductor Audio** | Howler.js o Web Audio API | Control de playback con precisión |
| **Almacenamiento Local** | localStorage / IndexedDB | Guardar sesiones |
| **Build Tool** | Vite | Bundling rápido |
| **UI Components** | Radix UI / shadcn | Accesible y flexible |

### 3.2 Estructura de Carpetas

```
drumia/
├── src/
│   ├── components/
│   │   ├── AudioUploader/
│   │   ├── DrumScore/          # Renderizado de partitura
│   │   ├── Player/             # Controles de reproducción
│   │   ├── MetronomeVisual/    # Metrónomo visual
│   │   └── SessionManager/
│   ├── hooks/
│   │   ├── useAudioAnalysis.ts
│   │   ├── useAudioPlayback.ts
│   │   └── useLocalStorage.ts
│   ├── services/
│   │   ├── audioAnalyzer.ts    # Detección de BPM, patrones
│   │   ├── scoreGenerator.ts   # Genera partitura desde análisis
│   │   └── audioProcessor.ts   # Procesa archivo de audio
│   ├── types/
│   │   └── index.ts            # Interfaces compartidas
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── vite.config.ts
```

### 3.3 Flujo de Datos

```
[Audio File Upload]
          ↓
    [Validation]
          ↓
[Web Audio API Decode]
          ↓
[Essentia.js / Librosa Analysis]
  ├→ Detect BPM
  ├→ Detect Time Signature
  └→ Extract Drum Patterns
          ↓
[Analysis Result Object]
  {
    bpm: number,
    timeSignature: "4/4",
    events: [
      { time: ms, type: "kick" | "snare" | "hat", intensity: 0-1 },
      ...
    ]
  }
          ↓
[Score Generator → Visual Representation]
          ↓
[React Component Render]
          ↓
[User Practice Interface]
  ├→ Player with sync
  ├→ Score visualization
  └→ Visual metronome
```

### 3.4 Componentes Clave

#### **AudioAnalyzer Service**
- Input: ArrayBuffer (decoded audio)
- Output: `AnalysisResult`
- Responsable de: Detección de BPM, patrones, timestamps

#### **ScoreGenerator Service**
- Input: `AnalysisResult`
- Output: `DrumScore` (lista de notas con timeline)
- Responsable de: Convertir análisis a notación de batería

#### **AudioPlayer Component**
- Maneja: reproducción, sincronización, velocidad variable
- Usa: Web Audio API o Howler.js
- Emite: eventos de tiempo para sincronizar UI

#### **DrumScore Component**
- Renderiza: partitura visual en canvas/SVG
- Sincroniza: con posición de reproducción
- Muestra: beats activos en tiempo real

#### **MetronomeVisual Component**
- Renderiza: indicador visual de beat
- Anima: cambio de color/tamaño en cada beat
- Sincroniza: con tiempo de reproducción

---

## 4. Especificación de Datos

### 4.1 Objeto AnalysisResult
```typescript
interface AnalysisResult {
  bpm: number;              // 60-200
  timeSignature: string;    // "4/4", "3/4", etc.
  duration: number;         // milliseconds
  events: DrumEvent[];
}

interface DrumEvent {
  time: number;            // milliseconds from start
  type: 'kick' | 'snare' | 'hat' | 'tom';
  intensity: number;       // 0-1 (loudness/confidence)
  duration?: number;       // ms (para notas sostenidas)
}
```

### 4.2 Objeto Session (localStorage)
```typescript
interface Session {
  id: string;
  fileName: string;
  uploadedAt: number;
  analysis: AnalysisResult;
  playbackState: {
    currentTime: number;
    isPlaying: boolean;
    speed: number;  // 0.5-1.5
  };
}
```

### 4.3 Formato de Partitura Visual
- **4-line staff** (estándar en batería):
  - Línea superior: Hi-hat/Platillos
  - Línea 2-3: Tom agudo/medio
  - Línea 4: Tom bajo
  - Por debajo: Bombo/Kick
  - A lado: Caja/Snare

---

## 5. Especificación de la Interfaz

### 5.1 Pantalla de Carga (Upload)
```
┌─────────────────────────────────────┐
│  DRUMIA - Aprende Batería           │
├─────────────────────────────────────┤
│                                     │
│  [Click aquí o arrastra archivo]    │
│  Formatos: MP3, WAV, OGG, M4A       │
│  Max: 10 minutos                    │
│                                     │
└─────────────────────────────────────┘
```

### 5.2 Pantalla de Análisis (Processing)
```
Analizando audio...
████████░░ 80%
Detectando BPM...
```

### 5.3 Pantalla de Práctica (Main)
```
┌──────────────────────────────────────────┐
│ Canción: Song Name | BPM: 120 | 4/4     │
├──────────────────────────────────────────┤
│                                          │
│  [Timeline Visualization]                │
│  ═══════◯═══════════════════════════════ │
│  0:00              1:30 / 3:45           │
│                                          │
│  [Drum Score Notation]                   │
│  ♩ ♩ ♩ ♩  (Hi-hat)                     │
│      •         (Snare)                   │
│  •   •    (Kick)                         │
│                                          │
│  [Visual Metronome]                      │
│    ◯ (pulsa cada beat)                  │
│                                          │
│  [Controls]                              │
│  ⏮ ⏯ ⏸ ⏭ | ⚙️ Speed: 1.0x             │
│                                          │
└──────────────────────────────────────────┘
```

### 5.4 Interacciones
- Click en timeline → salta a esa posición
- Slider de velocidad → cambia playback speed
- Botón "Guardar Sesión" → guarda en localStorage
- Botón "Nueva Canción" → vuelve a pantalla de carga

---

## 6. Criterios de Éxito (Aceptación)

### **Fase 1 - MVP (Mínimo Viable)**
- ✅ Carga de audio (MP3, WAV)
- ✅ Detección de BPM con ±5 BPM
- ✅ Detección básica de 3 patrones (kick, snare, hat)
- ✅ Partitura visual sincronizada
- ✅ Metrónomo visual funcional
- ✅ Controles de reproducción (play, pausa, velocidad)
- ✅ Guardar sesión en localStorage
- ✅ Sin registro de usuario (local only)

### **Métricas de Éxito**
- Tiempo de análisis: < 10 segundos para audio de 5 min
- Sincronización: desfase < 100ms entre audio y UI
- FPS: 60 FPS durante reproducción
- Precisión de BPM: ±5 BPM vs. BPM real

---

## 7. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| **Análisis de audio impreciso** | Usar librería probada (Essentia.js); validar con múltiples archivos |
| **Sincronización audio-UI** | Web Audio API timing para precisión; usar requestAnimationFrame |
| **Rendimiento en archivos grandes** | Web Workers para análisis; limitar duración máxima |
| **Compatibilidad de navegadores** | Testing en Chrome, Firefox, Safari; fallbacks para APIs antiguas |

---

## 8. Próximos Pasos (Post-MVP)

- **Fase 2**: Grabación y feedback del usuario
- **Fase 3**: Análisis avanzado (Tom detection, accents)
- **Fase 4**: Backend + cuentas de usuario
- **Fase 5**: Mobile app (React Native)
- **Fase 6**: Lecciones interactivas y progresión

---

## Resumen Técnico Ejecutivo

**Drumia** es una app web que:
1. Recibe audio de canciones/patrones de batería
2. Analiza con Essentia.js para extraer tempo y patrones rítmicos
3. Genera partitura visual en React + Canvas
4. Permite practicar con metrónomo visual sincronizado
5. Guarda sesiones localmente sin necesidad de backend

**Stack**: React + TypeScript + Essentia.js + Howler.js + Canvas
**Alcance**: Web, todos los niveles, análisis intermedio, local storage
