const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

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

// Anti-spam / Quota protection
let lastResponseTime = 0;
const COOLDOWN_MS = 15000; // 15 seconds between any response

client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ COACH FRANK IS ONLINE: ${c.user.tag}`);
  console.log("--------------------------------------------------\n");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();
  const isMentioned = message.mentions.has(client.user.id);

  const nicknames = ["frank", "coach", "the legend"];
  const nameFound = nicknames.some((name) => contentLower.includes(name));

  // Always reply to @tags. Reply to names 60% of the time.
  const shouldRespond = isMentioned || (nameFound && Math.random() > 0.4);

  if (shouldRespond) {
    const now = Date.now();
    if (now - lastResponseTime < COOLDOWN_MS) return; // Silent skip if too fast

    const prompt = message.content
      .replace(/<@!?\d+>/gi, "")
      .replace(/frank|coach|the legend/gi, "")
      .trim();

    console.log(
      `[TRIGGER]: ${isMentioned ? "Direct Mention" : "Keyword Found"}`,
    );

    try {
      const response = await ai.models.generateContent({
        // SWITCHED TO STABLE GEMINI 2.0 FLASH
        model: "gemini-2.0-flash",
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
        },
      });

      lastResponseTime = Date.now();
      const replyText = response.text;
      console.log(`[OUTPUT]: ${replyText}`);
      await message.reply(replyText);
    } catch (e) {
      console.error("!!! AI ERROR:", e.message);
      // Only reply with error if it's NOT a rate limit (429)
      if (!e.message.includes("429")) {
        await message.reply("I'M BUSY CLEANING MY BEARINGS! TRY LATER!");
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
