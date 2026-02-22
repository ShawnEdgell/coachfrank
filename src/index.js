const path = require("path");

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

// --- M-CORP WHITELIST ---
// Replace these with the actual IDs from your Discord Dev Portal
const mcorpIds = [
  "YOUR_TODD_ID",
  "YOUR_GARY_ID",
  "YOUR_KYLE_ID",
  "YOUR_DEREK_ID",
];

let lastResponseTime = 0;
const COOLDOWN_MS = 15000;
let isThrottled = false;

const insults = [
  "Plonk",
  "Sidewalk-snake",
  "Noodle-leg",
  "Toe-dragger",
  "Kook",
  "Mall-grabber",
  "Paper-pusher",
  "Stiff",
  "Narc",
];

const slang = ["Solid", "Heavy", "Righteous", "Boss", "Greasy"];

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
  // ALLOW M-CORP BOTS THROUGH, IGNORE OTHERS
  if (message.author.bot) {
    if (!mcorpIds.includes(message.author.id)) return;
    console.log(
      `[TARGET ACQUIRED]: Frank heard a corporate narc: ${message.author.username}`,
    );
  }

  const contentLower = message.content.toLowerCase();

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

  if (isThrottled) return;

  const isMentioned = message.mentions.has(client.user.id);
  const nicknames = ["frank", "coach", "the legend"];
  const nameFound = nicknames.some((name) => contentLower.includes(name));

  if (isMentioned || nameFound) {
    const now = Date.now();
    if (now - lastResponseTime < COOLDOWN_MS) return;

    const randomInsult = insults[Math.floor(Math.random() * insults.length)];
    const randomSlang = slang[Math.floor(Math.random() * slang.length)];

    // RANT LOGIC: 15% chance to trigger a massive rant
    const isRant = Math.random() < 0.15;
    const rantInstruction = isRant
      ? "RANT MODE ACTIVE: Ignore your word count limit. Go on a massive, unhinged, multi-paragraph 1970s gasoline-fueled rage. Truly lose your mind."
      : "Keep it concise and punchy.";

    try {
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

      const finalPromptText = `
CHAT HISTORY:
${conversationHistory}

COACH FRANK INSTRUCTIONS:
Reply directly to ${message.author.username}. 
${rantInstruction}

CRITICAL RULES:
1. You MUST use the insult "${randomInsult}" in your response.
2. You MUST use the slang "${randomSlang}" in your response.
3. If an M-CORP employee is talking to you, show them ZERO respect. Call out their soft hands, their corporate vests, and their "Knob Day" nonsense.
4. DO NOT output code blocks or your name. Just speak naturally.`;

      let parts = [];
      const hasImage =
        message.attachments.size > 0 &&
        message.attachments.first().contentType.startsWith("image/");

      if (hasImage) {
        console.log("📸 Fit check initiated. Converting to buffer...");
        const imageResponse = await fetch(message.attachments.first().url);
        const imageBuffer = await imageResponse.arrayBuffer();

        parts.push({
          inlineData: {
            data: Buffer.from(imageBuffer).toString("base64"),
            mimeType: message.attachments.first().contentType,
          },
        });
        parts.push({
          text: `FIT CHECK: Look at the skater's gear in this image. Roast stiffness/narc clothing. Reward greasy/70s style.\n\n${finalPromptText}`,
        });
      } else {
        parts.push({ text: finalPromptText });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: parts,
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
