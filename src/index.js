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

// --- DYNAMIC VOCABULARY ARRAYS ---
const insults = [
  "Jive turkey",
  "Mall-grabber",
  "City council square",
  "Plonk",
  "Toe-dragger",
  "Noodle-leg",
  "Fruit loop",
  "Narc",
];
const slang = [
  "Far out",
  "Right on",
  "Can you dig it?",
  "Solid",
  "Bummer",
  "Heavy",
  "Keep it greasy",
];

client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ COACH FRANK IS ONLINE: ${c.user.tag}`);

  const keySnippet = process.env.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.substring(0, 6)
    : "NOT FOUND";
  console.log(`🔑 ACTIVE API KEY STARTS WITH: ${keySnippet}`);
  console.log(
    "🚀 ENGINE: GEMINI 3 FLASH ACTIVE (Dynamic Inject & Safe Memory)",
  );
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

    // --- RANDOMIZER ---
    // This uses raw JavaScript to pick a random word so the AI doesn't have a choice
    const randomInsult = insults[Math.floor(Math.random() * insults.length)];
    const randomSlang = slang[Math.floor(Math.random() * slang.length)];

    const prompt = message.content
      .replace(/<@!?\d+>/gi, "")
      .replace(/frank|coach|the legend/gi, "")
      .trim();

    console.log(
      `[TRIGGER]: ${isMentioned ? "Direct Mention" : "Keyword Found"}`,
    );

    try {
      // --- SAFE MEMORY (Only grabs last 3 messages to avoid script confusion) ---
      const fetchedMessages = await message.channel.messages.fetch({
        limit: 4,
      });
      const conversationHistory = fetchedMessages
        .reverse()
        .map((m) => {
          const speaker =
            m.author.id === client.user.id ? "Coach Frank" : m.author.username;
          const text = m.content.replace(/<@!?\d+>/gi, "").trim();
          return `${speaker} said: "${text}"`;
        })
        .join("\n");

      // --- THE IRONCLAD PROMPT ---
      const finalPrompt = `CHAT HISTORY:\n${conversationHistory}\n\nCOACH FRANK INSTRUCTIONS:\nReply directly to ${message.author.username}. \nCRITICAL RULES:\n1. You MUST use the insult "${randomInsult}" in your response.\n2. You MUST use the slang "${randomSlang}" in your response.\n3. DO NOT output code blocks or your name. Just speak naturally.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [{ text: finalPrompt }],
          },
        ],
        config: {
          systemInstruction: coachFrankPersona,
          temperature: 0.95,
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

      // Scrubber to keep formatting clean
      let replyText = response.text
        .replace(/^Coach Frank:\s*/i, "")
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
        .trim();

      console.log(`[OUTPUT]: ${replyText}`);
      await message.reply(replyText);
    } catch (e) {
      console.error("!!! AI ERROR:", e.message);

      if (e.message.includes("429") || e.message.includes("503")) {
        console.log("🛑 QUOTA/SERVER HIT: GOING SILENT.");
        await message.reply(
          "GAS TANK'S EMPTY OR THE FEDS ARE JAMMING MY SIGNAL. LATER.",
        );

        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
        }, 300000);
        return;
      }

      await message.reply("BUSY BOILING HOT DOG WATER. LATER.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
