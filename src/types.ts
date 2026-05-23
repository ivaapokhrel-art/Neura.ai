/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Character {
  id: string;
  name: string;
  tagline: string;
  description: string;
  personalityPrompt: string; // The deep core rules, speech quirks, secrets
  greetingMessage: string; // First message
  avatarUrl: string;
  avatarStyle: 'adventurer' | 'bottts' | 'lorelei' | 'avataaars' | 'custom';
  avatarPrompt?: string; // AI Image generation prompt
  voiceName: 'Kore' | 'Fenrir' | 'Zephyr' | 'Puck' | 'Charon'; // prebuilt voices for TTS
  category: string;
  likes: number;
  creator: string;
  exampleDialogues: string; // "{{user}}: Help! \n {{char}}: Focus, friend!"
  isUserCreated?: boolean;
  isNsfw?: boolean; // Toggle for mature / 18+ content configuration
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isGenerating?: boolean;
  voiceAudioUrl?: string; // Cache base64 URL or audio data for text-to-speech
}

export interface ChatSession {
  id: string;
  characterId: string;
  messages: Message[];
  memorySummary: string; // Summarized context for token efficiency
  memoryLedger: string[]; // Highly visible, editable itemized memories (e.g., "User's pet name is Max", "User is a wizard apprentice")
}

export const PRESET_CATEGORIES = [
  'All',
  'Anime & Games',
  'Helpers & AI',
  'Historical & Philosophy',
  'Fiction & Sci-Fi',
  'Creative Writing',
];
