import { FRENCH_WORDS } from "@/data/french-words";

export function generateUniqueCode(): string {
  const word1 = FRENCH_WORDS[Math.floor(Math.random() * FRENCH_WORDS.length)];
  const word2 = FRENCH_WORDS[Math.floor(Math.random() * FRENCH_WORDS.length)];
  const number = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${word1}-${word2}-${number}`;
}
