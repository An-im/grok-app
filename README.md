# grok-app (Chat con proxy local)

Full-stack: **Express** (proxy) + **React (Vite)** con **streaming**.  
Soporta **Groq** (free tier) y **xAI Grok** (requiere créditos).

## Requisitos
- Node **22** (recomendado)
- npm


- Para **gratis**: `PROVIDER=groq` y `GROQ_API_KEY=gsk-...`
- Para **xAI**: `PROVIDER=xai` y `XAI_API_KEY=xa-...`

## Ejecutar
En una terminal (backend):

En otra (frontend):

- Backend: http://localhost:8787  
- Frontend: http://localhost:5173

## Estructura
- `server/index.js` → proxy SSE
- `web/` → React + Tailwind

### Demo
👉 [Live demo](https://an-im.github.io/grok-app/) · [Código](https://github.com/An-im/grok-app)


## Notas
- Vite 7 requiere Node 20.19+ (usamos Node 22).
