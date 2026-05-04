# Drumia - Aprende Batería

Una aplicación web interactiva para aprender a tocar batería analizando canciones y patrones rítmicos.

## Características

- 🎵 Carga archivos de audio (MP3, WAV, OGG, M4A)
- 🎯 Análisis automático de tempo y patrones rítmicos
- 📊 Partitura visual sincronizada en tiempo real
- 🎹 Metrónomo visual interactivo
- ⚡ Controles de velocidad variable (0.5x - 1.5x)
- 💾 Guardado de sesiones en el navegador

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Audio**: Web Audio API + Howler.js
- **Análisis**: Essentia.js (placeholder)
- **UI**: Radix UI + CSS personalizado

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## Build

```bash
npm run build
```

## Especificación

Lee [SPEC.md](./SPEC.md) para la especificación completa del proyecto.

## Roadmap

- [ ] Fase 1 MVP: Análisis básico + visualización
- [ ] Fase 2: Grabación y feedback del usuario
- [ ] Fase 3: Análisis avanzado (Tom detection, accents)
- [ ] Fase 4: Backend + cuentas de usuario
- [ ] Fase 5: Mobile app
