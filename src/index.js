const path = require("path");
// Improved env loading: priority to System Env (Docker) then .env file
if (!process.env.GEMINI_API_KEY) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { GoogleGenAI } = require("@google/genai");
const { coachFrankPersona } = require("./instructions");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- PROTECTION SYSTEM ---
let lastResponseTime = 0;
const COOLDOWN_MS = 15000;
let isThrottled = false;

client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ COACH FRANK IS ONLINE: ${c.user.tag}`);

  const keySnippet = process.env.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.substring(0, 6)
    : "NOT FOUND";
  console.log(`🔑 ACTIVE API KEY STARTS WITH: ${keySnippet}`);
  console.log("🚀 ENGINE: GEMINI 2.5 FLASH (Memory Enabled, Stable Mode)");
  console.log("--------------------------------------------------\n");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();

  // --- 1. HEALTH CHECK & MANUAL RESET ---
  if (contentLower === "!frank status") {
    const status = isThrottled ? "🛑 THROTTLED (Out of gas)" : "✅ ACTIVE";
    return message.reply(`STATUS: ${status}`);
  }

  if (contentLower === "!frank reset") {
    isThrottled = false;
    lastResponseTime = 0;
    console.log("🔄 MANUAL RESET: Engine restarted.");
    return message.reply("FINE. I'm back. Don't blow the fuse again.");
  }

  // --- 2. THE CIRCUIT BREAKER ---
  if (isThrottled) return;

  const isMentioned = message.mentions.has(client.user.id);
  const nicknames = ["frank", "coach", "the legend"];
  const nameFound = nicknames.some((name) => contentLower.includes(name));

  const shouldRespond = isMentioned || nameFound;

  if (shouldRespond) {
    const now = Date.now();
    if (now - lastResponseTime < COOLDOWN_MS) return;

    console.log(
      `[TRIGGER]: ${isMentioned ? "Direct Mention" : "Keyword Found"} - Fetching Memory...`,
    );

    try {
      // --- THE MEMORY MAKER ---
      // 1. Fetch the last 6 messages (including the current one)
      const fetchedMessages = await message.channel.messages.fetch({
        limit: 6,
      });

      // 2. Reverse them so they are in chronological order (oldest to newest)
      const conversationHistory = fetchedMessages
        .reverse()
        .map((m) => {
          // Identify who is talking
          const speaker =
            m.author.id === client.user.id ? "Coach Frank" : m.author.username;
          // Clean up the text
          const text = m.content.replace(/<@!?\d+>/gi, "").trim();
          return `${speaker}: ${text || "[Attachment/Image]"}`;
        })
        .join("\n");

      // 3. Create the final prompt with memory injected
      const finalPrompt = `Here is the recent chat history:\n\n${conversationHistory}\n\nCoach Frank, reply to the last message from ${message.author.username}. Remember what you just said and DO NOT repeat your catchphrases. Keep it short and punchy unless they triggered a rant.`;

      const response = await ai.models.generateContent({
        // SWAPPED TO THE STABLE 2.5 MODEL
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: finalPrompt }],
          },
        ],
        config: {
          systemInstruction: coachFrankPersona,
          temperature: 0.95,
          // 2.5 DOES NOT use thinkingConfig, so it is removed
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_ONLY_HIGH",
            },
          ],
        },
      });

      lastResponseTime = Date.now();
      const replyText = response.text;
      console.log(`[OUTPUT]: ${replyText}`);
      await message.reply(replyText);
    } catch (e) {
      console.error("!!! AI ERROR:", e.message);

      if (e.message.includes("429")) {
        console.log("🛑 QUOTA HIT: GOING SILENT FOR 5 MINUTES.");
        await message.reply("GAS TANK'S EMPTY. I'M TAKING 5.");

        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
          console.log("🔄 CIRCUIT BREAKER RESET.");
        }, 300000);

        return;
      }

      if (!e.message.includes("429")) {
        await message.reply("BUSY CLEANING BEARINGS. LATER.");
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
