/**
 * Saying a German word out loud.
 *
 * `expo-speech` is the platform's own synthesiser — iOS AVSpeechSynthesizer,
 * Android TextToSpeech, the Web Speech API in a browser. That means no audio
 * files to license, no megabytes in the bundle, and nothing to fetch on a
 * train; it also means the voice is whatever the device has, and on a device
 * with no German voice installed there is nothing to play.
 *
 * So availability is checked rather than assumed, and a device that cannot
 * speak German simply does not show the button. A button that does nothing is
 * worse than no button.
 */
import * as Speech from 'expo-speech';

/** German. The course is German; this is not a general-purpose speaker. */
const LANGUAGE = 'de-DE';

let availability: Promise<boolean> | null = null;

/**
 * Does this device have a German voice?
 *
 * Asked once and remembered: the answer cannot change while the app is open,
 * and the call is slow enough on Android to be worth not repeating per card.
 */
export function germanAvailable(): Promise<boolean> {
  availability ??= (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      // Some platforms report "de-DE", others "de_DE" or plain "de".
      return voices.some((voice) => voice.language.toLowerCase().replace('_', '-').startsWith('de'));
    } catch {
      return false;
    }
  })();
  return availability;
}

export interface SpeakOptions {
  /** Slower than speech, for a word being learned. 1 is the device default. */
  readonly rate?: number;
}

/**
 * Speak, stopping anything already being said.
 *
 * Two words overlapping is worse than a word cut off, and tapping a second card
 * plainly means "that one instead".
 */
export async function speakGerman(text: string, options: SpeakOptions = {}): Promise<void> {
  const value = text.trim();
  if (!value) return;
  try {
    if (await Speech.isSpeakingAsync()) Speech.stop();
    Speech.speak(value, { language: LANGUAGE, rate: options.rate ?? 0.85 });
  } catch {
    // A synthesiser that refuses is not a reason to interrupt a lesson.
  }
}

export function stopSpeaking(): void {
  try { Speech.stop(); } catch { /* nothing was playing */ }
}
