/**
 * ElevenLabs TTS helper for Unidad.
 * Returns a Buffer of MP3 audio ready to be served or piped to ffmpeg.
 *
 * Default voice: "Laura" (eleven_multilingual_v2) — fluent in Spanish & English.
 * Override ELEVENLABS_VOICE_ID in .env to swap voices.
 */

import { ElevenLabsClient } from "elevenlabs";

// "Laura" — multilingual, natural-sounding, works well for es-MX & en-US
const DEFAULT_VOICE_ID = "FGY2WhTYpPnrIDTdsKH5";

let _client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!_client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("[Unidad] ELEVENLABS_API_KEY is not set");
    _client = new ElevenLabsClient({ apiKey });
  }
  return _client;
}

export async function generateSpeech(
  text: string,
  voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
): Promise<Buffer> {
  const client = getClient();

  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: "eleven_multilingual_v2",
    output_format: "mp3_44100_128",
  });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
