# Tavus Demo

Applicazione React per una **demo live di Tavus CVI** (Conversational Video
Interface) con il modello di perception **Raven**, pensata per un webinar sugli
avatar AI emotivamente intelligenti.

## Stack

- [React 19](https://react.dev)
- [Vite](https://vite.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [`@daily-co/daily-js`](https://docs.daily.co/) — client WebRTC usato da
  Tavus per lo streaming dell'avatar

## Requisiti

- Node.js >= 20.19 (o >= 22.13)
- npm
- Un account [Tavus](https://platform.tavus.io/) e una API key

## Configurazione

1. Copia `.env.example` in `.env` e inserisci la tua API key Tavus:

   ```bash
   cp .env.example .env
   ```

2. Opzionalmente personalizza `VITE_TAVUS_REPLICA_ID` e
   `VITE_TAVUS_PERSONA_ID`. Per far popolare i pannelli di emozioni/perception
   assicurati che la persona scelta abbia `raven-0` o `raven-1` configurato nel
   layer `perception` (vedi
   [docs Raven](https://docs.tavus.io/sections/conversational-video-interface/raven)).

> ⚠️ Le variabili `VITE_*` finiscono nel bundle del browser: la chiave è
> visibile a chi ispeziona la pagina. Per un webinar a platea controllata è
> accettabile; in produzione proxiamola da un backend.

## Comandi

```bash
npm install           # installa le dipendenze
npm run dev           # avvia il dev server (http://localhost:5173)
npm run build         # type-check + build di produzione
npm run lint          # ESLint
npm run preview       # preview della build
```

## Uso della demo

- Apri `http://localhost:5173` → welcome page.
- Click su **Apri la demo CVI live** (oppure naviga direttamente a `#demo`).
- Inserisci/verifica API key, `replica_id`, `persona_id`, greeting e contesto.
- Click su **Start live demo**: l'app crea una conversazione via
  `POST /v2/conversations` e si collega al Daily room restituito.
- Durante la call i pannelli laterali mostrano:
  - **Transcript** — utterance user + replica, con eventuali analisi
    audio/visual Raven.
  - **Sentiment** — 6 dimensioni (fiducia, interesse, sorpresa, frustrazione,
    rabbia, neutro) calcolate dalla descrizione testuale di Raven. Se
    `VITE_OPENAI_API_KEY` è valorizzata, lo scoring viene fatto da
    `gpt-4o-mini` in un Web Worker (off main thread, off conversational
    critical path); altrimenti si usa uno scorer keyword-based istantaneo.
  - **Turn-around latency** — Δ tra stop utente e start replica.
  - **CVI pipeline** — layer Perception / STT / Turn-taking / LLM / TTS+Phoenix
    con glow sullo stadio attivo.
- **End demo** termina la conversazione via `POST /v2/conversations/:id/end` e
  lascia il room.

## Struttura

```
src/
├── App.tsx                       # routing minimale welcome ↔ demo
├── main.tsx                      # entry React
├── index.css                     # @import "tailwindcss"
├── api/tavus.ts                  # REST client Tavus
├── daily/useCvi.ts               # hook Daily + parsing app-message CVI
├── daily/events.ts               # normalizzazione eventi CVI
├── types/cvi.ts                  # tipi condivisi
├── utils/format.ts               # format helpers (durate, latenze, %)
└── components/
    ├── LiveDemo.tsx              # orchestratore della demo
    ├── ConnectPanel.tsx          # form di connessione
    ├── AvatarStage.tsx           # video dell'avatar
    ├── ui/{Card,Badge}.tsx
    └── panels/
        ├── TranscriptPanel.tsx
        ├── SentimentPanel.tsx
        ├── LatencyPanel.tsx
        └── PipelinePanel.tsx
src/utils/sentiment.ts            # parser Raven + keyword scorer (fallback)
src/daily/useSentimentLLM.ts      # hook che dispatcha utterance al worker
src/workers/sentimentWorker.ts    # Web Worker: chiamata OpenAI structured output
```

## Proxy di sviluppo

Il `vite.config.ts` espone un proxy `/tavus` → `https://tavusapi.com` usato in
`dev` per evitare eventuali blocchi CORS quando il browser chiama le API Tavus.
In build di produzione la chiamata va direttamente a `https://tavusapi.com`.

## Sentiment scoring

Raven-1 emette descrizioni in linguaggio naturale (non label/numeri). Per
ottenere score numerici robusti senza impattare la latenza CVI, l'app:

1. Per ogni nuova utterance con `visualAnalysis`, dispatcha un job a un
   **Web Worker dedicato**.
2. Il worker chiama OpenAI Chat Completions con un **JSON Schema** che
   vincola l'output a 6 interi 0–99 + un `rationale` di una frase.
3. Quando arriva una utterance più recente, il job precedente viene
   `abort`-ato (no race condition / no flicker di score stale).
4. Finché lo score LLM non è pronto, il pannello mostra in trasparenza
   lo score keyword-based istantaneo, così le barre non sono mai vuote.

Per disabilitare l'LLM e usare solo il keyword scorer basta non valorizzare
`VITE_OPENAI_API_KEY`.

## Riferimenti

- [Tavus CVI overview](https://docs.tavus.io/sections/conversational-video-interface/cvi-overview)
- [Creating a conversation](https://docs.tavus.io/sections/conversational-video-interface/creating-a-conversation)
- [Raven perception](https://docs.tavus.io/sections/conversational-video-interface/raven)
- [Utterance event](https://docs.tavus.io/sections/event-schemas/conversation-utterance)
- [Perception tool call event](https://docs.tavus.io/sections/event-schemas/conversation-perception-tool-call)
