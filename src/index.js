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
  console.log("🚀 ENGINE: GEMINI 3 FLASH ACTIVE");
  console.log("--------------------------------------------------\n");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();

  // --- 1. HEALTH CHECK & MANUAL RESET (BYPASS ZONE) ---
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

    const prompt = message.content
      .replace(/<@!?\d+>/gi, "")
      .replace(/frank|coach|the legend/gi, "")
      .trim();

    console.log(
      `[TRIGGER]: ${isMentioned ? "Direct Mention" : "Keyword Found"}`,
    );

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  prompt ||
                  "Someone just brought you up. Say something cranky and 70s.",
              },
            ],
          },
        ],
        config: {
          systemInstruction: coachFrankPersona,
          temperature: 0.9,
          thinkingConfig: {
            thinkingLevel: "low",
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_ONLY_HIGH",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
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
