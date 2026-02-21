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

client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ COACH FRANK IS BACK: ${c.user.tag}`);
  console.log("--------------------------------------------------\n");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user.id);
  const keywordFound = message.content.toLowerCase().includes("coach frank");

  if (isMentioned || keywordFound) {
    const prompt = message.content.replace(/<@!\d+>|coach frank/gi, "").trim();
    console.log(`[INPUT]: ${prompt || "Empty prompt"}`);

    try {
      // This is the direct call that was working before we tried models.get()
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: prompt || "SAY SOMETHING!" }] },
        ],
        config: {
          systemInstruction: coachFrankPersona,
          temperature: 0.9, // Balanced variety
        },
      });

      console.log(`[OUTPUT]: ${response.text}`);
      await message.reply(response.text);
    } catch (e) {
      console.error("!!! AI ERROR:", e.message);
      await message.reply("I'M BUSY SKATING! THE MAN IS WATCHING! TRY LATER!");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
