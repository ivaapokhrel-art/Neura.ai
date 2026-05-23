/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("GoogleGenAI initialized successfully from GEMINI_API_KEY.");
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
}

app.use(express.json({ limit: "15mb" }));

// HELPER: Safeguard API Key access
function checkAIClient(res: express.Response): boolean {
  if (!ai) {
    res.status(500).json({ 
      error: "Gemini API Client is not configured. Please supply a valid GEMINI_API_KEY in the Secrets panel." 
    });
    return false;
  }
  return true;
}

// ==========================================
// API ENDPOINTS
// ==========================================

/**
 * Chat generation proxy.
 * Takes the character's profile, example dialogues, current history,
 * and current memory ledger, and generates the response using gemini-3.5-flash.
 * Incorporates a system process to automatically learn new facts about the user!
 */
app.post("/api/chat", async (req, res) => {
  if (!checkAIClient(res)) return;

  try {
    const { character, messages, memoryLedger } = req.body;

    if (!character || !messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Required fields 'character' and 'messages' missing or invalid." });
      return;
    }

    // Structure the ledger context
    const ledgerContext = memoryLedger && memoryLedger.length > 0 
      ? `\nActive Memory Ledger (Things you have remembered about {{user}} from past interactions):\n` + 
        memoryLedger.map((fact: string) => `- ${fact}`).join("\n")
      : "";

    // Build the high-quality character persona system instruction
    const systemInstruction = `You are roleplaying as the fictitious character "${character.name}". You must stay fully in-character at all times.

--- CHARACTER PERSONA ---
NAME: ${character.name}
TAGLINE: ${character.tagline}
DESCRIPTION: ${character.description}

CORE BEHAVIOR/PERSONALITY RULES:
${character.personalityPrompt}

EXAMPLE DIALOGUES FOR TONE & VOICE REFERENCE:
${character.exampleDialogues || "No dialogue examples provided."}

--- ACTIVE USER PROFILE & MEMORIES ---
${ledgerContext}

--- INTERACTION DIRECTIVES ---
1. Strictly adopt ${character.name}'s tone, word choices, emojis, and mannerisms.
2. Maintain natural flow. Focus on what is being asked, but weave in your personality.
3. CONCISENESS CONTRAINT: Keep your responses relatively concise. They should be around 6 to 7 lines long, ensuring quick-fire and interactive roleplay.
4. KEY INSTRUCTION - ACTIVE MEMORY TRACKING:
   - Carefully monitor the conversation to see if the user shares stable, long-term personal facts about themselves (e.g., their name, their job/study, their favorite things, pets, family, or specific personal experiences they mention).
   - If (and only if) you discover any new and stable fact about the user, you must output a special marker at the absolute END of your response.
   - Use the format: [MEMORY_ADD: <short, objective fact about user>]
   - For example: if they say "I love chocolate chip cookies", append "[MEMORY_ADD: User loves chocolate chip cookies]".
   - Keep the fact concise, objective, and in the third person starting with "User...".
   - You can append multiple markers if multiple facts are learned: e.g., "[MEMORY_ADD: User likes cookies] [MEMORY_ADD: User has a cat named Max]".
   - Do NOT reveal this memory tracking to the user inside your actual dialogue response. Keep it appended quietly at the end of the response text out of the standard flow.

Keep responses engaging, natural, and highly polished in formatting. Remain focused on character immersion!`;

    // Map conversation logs to API format
    // Filter out some typing noise or generate states
    const apiMessages = messages.map((m: any) => {
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }]
      };
    });

    const response = await ai!.models.generateContent({
      model: "gemini-3.5-flash",
      contents: apiMessages,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.85,
        topP: 0.95,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          }
        ]
      }
    });

    const fullText = response.text || "";

    // Parse out any memory markers
    const memoryRegex = /\[MEMORY_ADD:\s*([^\]]+)\]/g;
    const learnedMemories: string[] = [];
    let match;
    while ((match = memoryRegex.exec(fullText)) !== null) {
      learnedMemories.push(match[1].trim());
    }

    // Clean the memory markers from the final text displayed to the user
    const cleanedText = fullText.replace(memoryRegex, "").trim();

    res.json({
      text: cleanedText,
      learnedMemories: learnedMemories
    });

  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error?.message || "Failed to generate character reply." });
  }
});

/**
 * Text-to-speech voice controller. Generates base64 audio.
 */
app.post("/api/voice/speak", async (req, res) => {
  if (!checkAIClient(res)) return;

  try {
    const { text, voiceName, characterName } = req.body;

    if (!text) {
      res.status(400).json({ error: "Missing required text for TTS." });
      return;
    }

    const speakerVoice = voiceName || "Zephyr";

    // Call gemini-3.1-flash-tts-preview
    const response = await ai!.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say in character as ${characterName || "an assistant"}: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: speakerVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      res.status(500).json({ error: "The voice synthesis model failed to yield audio bytes." });
      return;
    }

    res.json({
      audioData: `data:audio/wav;base64,${base64Audio}`
    });

  } catch (error: any) {
    console.error("Error in /api/voice/speak:", error);
    res.status(500).json({ error: error?.message || "Failed to synthesize speech." });
  }
});

/**
 * AI Bot importer from c.ai or Chai links.
 */
app.post("/api/import-bot", async (req, res) => {
  if (!checkAIClient(res)) return;

  try {
    const { link } = req.body;
    if (!link) {
      res.status(400).json({ error: "Missing required 'link' parameter." });
      return;
    }

    const trimmedInput = link.trim();

    // 1. Smart regex pre-extraction to feed into the Gemini prompt as highly strict hints
    let extractedName = "";
    let extractedTraits = "";
    
    // Check Chai description pattern: "Start a chat with <Name> on Chai!"
    const chaiMatch = trimmedInput.match(/Start\s+a\s+chat\s+with\s+(.*?)\s+on\s+Chai/i);
    if (chaiMatch && chaiMatch[1]) {
      extractedName = chaiMatch[1].trim();
    }

    // Try to extract traits inside parenthesis, e.g. "(Gay, Mafia, husband)"
    const parenMatch = trimmedInput.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      extractedTraits = parenMatch[1].trim();
    }

    // Clean up name if it includes the traits inside parenthesis
    if (extractedName && extractedName.includes("(")) {
      extractedName = extractedName.split("(")[0].trim();
    }

    // Fallback: Parse URL path or search query if the name is not matched yet
    if (!extractedName) {
      try {
        const urlMatch = trimmedInput.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const urlObj = new URL(urlMatch[1]);
          // Check query parameters
          const queryChar = urlObj.searchParams.get("char") || urlObj.searchParams.get("bot") || urlObj.searchParams.get("character");
          if (queryChar) {
            extractedName = queryChar;
          } else {
            // Check path segments
            const segments = urlObj.pathname.split("/").filter(s => s && !["chat", "character", "bot", "join", "start", "_bot"].includes(s.toLowerCase()));
            if (segments.length > 0) {
              const lastSeg = segments[segments.length - 1];
              // Avoid using UUIDs/hashes directly as character names
              if (!lastSeg.startsWith("_bot_") && !/^[a-f0-9-]{32,}$/i.test(lastSeg)) {
                extractedName = lastSeg.replace(/[-_]/g, " ");
              }
            }
          }
        }
      } catch (e) {
        // Safe to ignore URL errors
      }
    }

    // Call Gemini 3.5 Flash with JSON schema instructions
    const prompt = `You are a professional character persona engineering parser.
The user wants to import an AI roleplay bot from Chai, Character.ai, or any general link:
"${trimmedInput}"

We pre-processed the input and found these high-priority clue indicators:
- Primary Extracted Name Clue: "${extractedName || 'None'}"
- Primary Extracted Traits Clue: "${extractedTraits || 'None'}"

INSTRUCTIONS:
1. Search the web to find indexed data about this bot URL or ID (such as name, tagline, description, speaking scripts).
2. Look at the pasted text surrounding the URL. If the user provided additional context (like "Start a chat with Mafia BL (Gay, Mafia, husband) on Chai!"), you MUST prioritize those names, traits, and categories over any defaults. For example:
   - If the text mentions "Mafia BL (Gay, Mafia, husband)", the character name must be "Mafia BL", and they are user's protective mafia husband, homosexual/gay.
   - If the link contains keywords or names, design the character around them.
3. Do NOT default to random sci-fi, cyberpunk, or generic helpers unless there is absolutely zero indication of the character's name, gender, or role in either the user link, the paste text, or the web search results.
4. Output a top-tier immersive character JSON with appropriate voice, tagline, description, rules, and initial immersive dialogue greeting.

Please output a valid JSON object matching this schema exactly. Do not add conversation prefixes or introductory remarks, return ONLY the raw JSON block:
{
  "name": "Full Character Name (highly readable, capitalize properly)",
  "tagline": "Elegant, concise tagline under 12 words highlighting their core role/trait",
  "description": "Engaging biography profile of the character (1-2 sentences)",
  "personalityPrompt": "Deep roleplay directives, character rules, speaking quirks, vocabulary notes, and mannerisms",
  "greetingMessage": "A creative greeting message from the character that sets the scene and starts the conversation",
  "avatarPrompt": "A single-sentence descriptive prompt suitable for generating circular avatar art (e.g., 'A handsome dark-eyed mafia mobster boss, 3D render, ambient cinema lighting, clean dark background')",
  "voiceName": "Choose exactly one: 'Kore' (female, clear), 'Fenrir' (deep, male), 'Zephyr' (neutral, crisp), 'Puck' (joyful, energetic), 'Charon' (slow, mysterious)",
  "category": "Choose exactly one from: 'Anime & Games', 'Helpers & AI', 'Historical & Philosophy', 'Fiction & Sci-Fi', 'Creative Writing'",
  "isNsfw": false
}`;

    let resultText = "{}";
    let importedChar: any = {};

    // Strategy 1: Call Gemini 3.5 Flash using plain text output with search grounding. 
    // This circumvents the validation conflict in of combining system tools with JSON response format.
    try {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ parts: [{ text: `${prompt}\nYour response MUST be wrapped in a secure \`\`\`json block.` }] }],
        config: {
          temperature: 0.70,
          tools: [{ googleSearch: {} }] // Enabled search grounding
        }
      });

      let rawText = response.text?.trim() || "";
      
      // Extract the JSON object from potential markdown blocks
      if (rawText.includes("```json")) {
        rawText = rawText.split("```json")[1].split("```")[0].trim();
      } else if (rawText.includes("```")) {
        rawText = rawText.split("```")[1].split("```")[0].trim();
      }

      importedChar = JSON.parse(rawText || "{}");
    } catch (searchError: any) {
      console.warn("Search-grounded import fell back due to error:", searchError?.message || searchError);

      // Strategy 2: Call Gemini 3.5 Flash using pure JSON schema output with NO googleSearch tool enabled.
      // This is 100% reliable as fallback.
      const fallbackResponse = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.65
        }
      });

      const fallbackText = fallbackResponse.text?.trim() || "{}";
      importedChar = JSON.parse(fallbackText);
    }

    // Force-validate pre-extracted character names if model returned something empty or highly generic
    if ((!importedChar.name || importedChar.name.toLowerCase().includes("imported") || importedChar.name.toLowerCase().includes("character") || importedChar.name.toLowerCase().includes("bot") || uploadedName(importedChar.name)) && extractedName) {
      importedChar.name = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    }

    if (extractedName && (!importedChar.name || importedChar.name.length < 2)) {
      importedChar.name = extractedName;
    }

    res.json(importedChar);

  } catch (error: any) {
    console.error("Error in /api/import-bot:", error);
    res.status(500).json({ error: error?.message || "Failed to parser-import bot from this link." });
  }
});

// Helper checking function to reject generic boilerplate names
function uploadedName(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase();
  return ["companion", "ai roleplay", "bot roleplay", "chai bot", "custom spark", "character ai", "spark"].some(term => lower.includes(term));
}

/**
 * AI Avatar Generator.
 */
app.post("/api/avatars/generate", async (req, res) => {
  if (!checkAIClient(res)) return;

  try {
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Missing required prompt for avatar generation." });
      return;
    }

    // Instruct Gemini 2.5 Flash Image to produce the avatar image
    const response = await ai!.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `High resolution circular modern avatar of ${prompt}. Intricate details, creative studio concept, vibrant illustration, centered close-up, high quality, 3D render/anime style, solid neutral background.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let base64Image = "";

    // Find the inlineData part containing the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      res.status(500).json({ error: "The image generation API succeeded but returned no image bytes." });
      return;
    }

    res.json({
      avatarUrl: `data:image/png;base64,${base64Image}`
    });

  } catch (error: any) {
    console.error("Error in /api/avatars/generate:", error);
    res.status(500).json({ error: error?.message || "Failed to generate AI avatar." });
  }
});

// ==========================================
// VITE OR STATIC FILES SERVING MIDDLEWARE
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operative! Access locally at http://localhost:${PORT}`);
  });
}

startServer();
