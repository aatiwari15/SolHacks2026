/**
 * Unidad Voice WebSocket Server  (Phase 2 — not used in the demo)
 *
 * This is the real-time streaming path. Twilio Media Streams connects here
 * and the server pipes audio through:
 *
 *   Twilio μ-law 8 kHz → PCM16 → Gemini STT
 *   → IBM Orchestrate → ElevenLabs TTS → μ-law 8 kHz → Twilio
 *
 * For Phase 1 (demo), calls are handled by plain TwiML in:
 *   pages/api/alerts/interactive-call.ts
 *
 * ─── How to run (Phase 2 only) ───────────────────────────────────────────
 *
 *  1. Install extra packages:
 *       npm install ws mulaw fluent-ffmpeg
 *       npm install --save-dev @types/ws @types/fluent-ffmpeg
 *       brew install ffmpeg    # (macOS) or: apt install ffmpeg
 *
 *  2. Add a script to package.json:
 *       "voice-server": "tsx server/unidad-voice-ws.ts"
 *
 *  3. Run alongside Next.js:
 *       npm run voice-server
 *
 *  4. Point Twilio's <Stream> URL to:
 *       wss://<your-ngrok>/voice-stream
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

// NOTE: Uncomment the imports below once the Phase 2 packages are installed.
// import { WebSocketServer, WebSocket } from "ws";
// import { createServer } from "http";
// import mulaw from "mulaw";
// import ffmpeg from "fluent-ffmpeg";
// import { PassThrough } from "stream";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { generateSpeech } from "@/lib/elevenlabs";
// import { askOrchestrate } from "@/lib/ibm-orchestrate";

const PORT = Number(process.env.VOICE_WS_PORT ?? 8080);
const SILENCE_THRESHOLD = 200;   // RMS amplitude considered silence
const SILENCE_DURATION_MS = 500; // ms of silence before we process the utterance
const BUFFER_FLUSH_MS = 3000;    // safety flush — process even if no silence detected

// ---------------------------------------------------------------------------
// Types for Twilio Media Streams protocol
// ---------------------------------------------------------------------------
interface TwilioConnectedEvent { event: "connected"; protocol: string; version: string }
interface TwilioStartEvent {
  event: "start";
  streamSid: string;
  start: { streamSid: string; accountSid: string; callSid: string; tracks: string[] };
}
interface TwilioMediaEvent {
  event: "media";
  streamSid: string;
  media: { track: "inbound" | "outbound"; chunk: string; timestamp: string; payload: string };
}
interface TwilioStopEvent { event: "stop"; streamSid: string }
type TwilioEvent =
  | TwilioConnectedEvent
  | TwilioStartEvent
  | TwilioMediaEvent
  | TwilioStopEvent;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a base64-encoded μ-law audio payload back to Twilio. */
// function sendAudio(ws: WebSocket, streamSid: string, payloadBase64: string) {  // Phase 2
//   ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: payloadBase64 } }));
// }

/** Compute RMS of a PCM16 buffer (little-endian, mono). */
// function rms(pcm: Buffer): number {  // Phase 2
//   let sum = 0;
//   for (let i = 0; i < pcm.length - 1; i += 2) {
//     const sample = pcm.readInt16LE(i);
//     sum += sample * sample;
//   }
//   return Math.sqrt(sum / (pcm.length / 2));
// }

/** Convert ElevenLabs MP3 buffer → μ-law 8 kHz mono Buffer via ffmpeg. */
// async function mp3ToMulaw(mp3: Buffer): Promise<Buffer> {  // Phase 2
//   return new Promise((resolve, reject) => {
//     const input = new PassThrough();
//     const chunks: Buffer[] = [];
//     ffmpeg(input)
//       .audioFrequency(8000)
//       .audioChannels(1)
//       .audioCodec("pcm_mulaw")
//       .format("mulaw")
//       .on("error", reject)
//       .pipe(new PassThrough())
//       .on("data", (d: Buffer) => chunks.push(d))
//       .on("end", () => resolve(Buffer.concat(chunks)));
//     input.end(mp3);
//   });
// }

// ---------------------------------------------------------------------------
// Per-connection state
// ---------------------------------------------------------------------------
// interface ConnectionState {  // Phase 2
//   streamSid: string | null;
//   audioBuffer: Buffer[];       // accumulated μ-law chunks
//   silenceTimer: NodeJS.Timeout | null;
//   flushTimer: NodeJS.Timeout | null;
//   sessionId: string;
//   language: string;
// }

// ---------------------------------------------------------------------------
// Connection handler  (TODO: wire up in Phase 2)
// ---------------------------------------------------------------------------
// function handleConnection(ws: WebSocket) {  // Phase 2
//   const state: ConnectionState = {
//     streamSid: null,
//     audioBuffer: [],
//     silenceTimer: null,
//     flushTimer: null,
//     sessionId: crypto.randomUUID(),
//     language: "es",
//   };

//   async function processUtterance() {
//     if (!state.streamSid || state.audioBuffer.length === 0) return;
//     const mulawPcm = Buffer.concat(state.audioBuffer);
//     state.audioBuffer = [];

//     // μ-law → PCM16
//     const pcm16 = mulaw.decode(mulawPcm);
//     const wavHeader = buildWavHeader(pcm16.length, 8000, 1, 16);
//     const wav = Buffer.concat([wavHeader, pcm16]);

//     // Gemini STT
//     const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
//     const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
//     const result = await model.generateContent([
//       "Transcribe this audio accurately. Return only the transcription, nothing else.",
//       { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
//     ]);
//     const transcript = result.response.text().trim();
//     if (!transcript) return;
//     console.log(`[Unidad WS] Heard: "${transcript}"`);

//     // IBM Orchestrate (or stub)
//     const reply = await askOrchestrate({
//       sessionId: state.sessionId,
//       userMessage: transcript,
//       language: state.language,
//     });
//     console.log(`[Unidad WS] Reply: "${reply}"`);

//     // ElevenLabs TTS → μ-law → back to Twilio
//     const mp3 = await generateSpeech(reply);
//     const mulawOut = await mp3ToMulaw(mp3);
//     sendAudio(ws, state.streamSid, mulawOut.toString("base64"));
//   }

//   ws.on("message", (raw: Buffer) => {
//     let msg: TwilioEvent;
//     try { msg = JSON.parse(raw.toString()) as TwilioEvent; } catch { return; }

//     switch (msg.event) {
//       case "start":
//         state.streamSid = msg.streamSid;
//         console.log(`[Unidad WS] Stream started: ${state.streamSid}`);
//         break;

//       case "media": {
//         if (!state.streamSid || msg.media.track !== "inbound") return;
//         const chunk = Buffer.from(msg.media.payload, "base64");
//         const pcm = mulaw.decode(chunk);
//         state.audioBuffer.push(chunk);

//         // Voice-activity detection: reset silence timer on loud audio
//         if (rms(pcm) > SILENCE_THRESHOLD) {
//           if (state.silenceTimer) clearTimeout(state.silenceTimer);
//           state.silenceTimer = setTimeout(() => void processUtterance(), SILENCE_DURATION_MS);
//         }

//         // Safety flush
//         if (!state.flushTimer) {
//           state.flushTimer = setTimeout(() => {
//             state.flushTimer = null;
//             void processUtterance();
//           }, BUFFER_FLUSH_MS);
//         }
//         break;
//       }

//       case "stop":
//         console.log(`[Unidad WS] Stream stopped: ${state.streamSid}`);
//         void processUtterance();
//         ws.close();
//         break;
//     }
//   });

//   ws.on("close", () => {
//     if (state.silenceTimer) clearTimeout(state.silenceTimer);
//     if (state.flushTimer) clearTimeout(state.flushTimer);
//     console.log("[Unidad WS] Connection closed");
//   });
// }

// ---------------------------------------------------------------------------
// Server bootstrap  (TODO: uncomment in Phase 2)
// ---------------------------------------------------------------------------
// const httpServer = createServer();
// const wss = new WebSocketServer({ server: httpServer, path: "/voice-stream" });
// wss.on("connection", handleConnection);
// httpServer.listen(PORT, () => {
//   console.log(`[Unidad] Voice WebSocket server → ws://localhost:${PORT}/voice-stream`);
// });

// Placeholder so the file compiles without the Phase 2 packages installed
console.log(
  `[Unidad] unidad-voice-ws.ts is scaffolded for Phase 2 (real-time streaming).`,
  `\nCurrent demo uses TwiML in pages/api/alerts/interactive-call.ts.`,
  `\nTarget WS port when enabled: ${PORT}`,
);

// Suppress "unused" lint warnings on the phase-2 constants
void SILENCE_THRESHOLD;
void SILENCE_DURATION_MS;
void BUFFER_FLUSH_MS;
void PORT;
