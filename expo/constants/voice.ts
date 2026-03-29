export type VoicePreference = 'female' | 'male';

// Paste your final ElevenLabs voice IDs here:
export const DEFAULT_FEMALE_VOICE_ID = 'Bn9xWp6PwkrqKRbq8cX2'; // <-- Replace with your female ElevenLabs voice ID
export const DEFAULT_MALE_VOICE_ID = 'Cz0K1kOv9tD8l0b5Qu53'; // <-- Replace with your male ElevenLabs voice ID

export const VOICE_OPTIONS: { label: string; value: VoicePreference }[] = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
];

export function resolveVoiceId(preference?: VoicePreference | null): string {
  if (preference === 'male') return DEFAULT_MALE_VOICE_ID;
  return DEFAULT_FEMALE_VOICE_ID;
}
