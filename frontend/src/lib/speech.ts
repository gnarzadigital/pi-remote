// Minimal typing over the non-standard webkitSpeechRecognition API (STT).
// Allowed per Nik's STT rule (browser webkitSpeechRecognition). No cloud SDK/endpoint
// in our code — this is a browser API only.

interface SpeechAlternative {
  readonly transcript: string;
}
interface SpeechResult {
  readonly 0: SpeechAlternative;
  readonly isFinal: boolean;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}
interface SpeechEvent {
  readonly results: SpeechResultList;
}
export interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    webkitSpeechRecognition?: RecognitionCtor;
    SpeechRecognition?: RecognitionCtor;
  };
  return w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Join a results list into interim + final transcript text. */
export function transcriptFromEvent(e: SpeechEvent): { text: string; isFinal: boolean } {
  let text = "";
  let isFinal = false;
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i];
    text += r[0].transcript;
    if (r.isFinal) isFinal = true;
  }
  return { text, isFinal };
}

/** Create a configured recognition instance, or null if unsupported. */
export function createRecognition(lang = "en-US"): Recognition | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = lang;
  return rec;
}
