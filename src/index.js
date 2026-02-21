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
  console.log(`\n✅ COACH FRANK IS ONLINE: ${c.user.tag}`);
  console.log("--------------------------------------------------\n");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();
  const isMentioned = message.mentions.has(client.user.id);

  // Define names he responds to without a tag
  const nicknames = ["frank", "coach", "the legend"];
  const nameFound = nicknames.some((name) => contentLower.includes(name));

  // Logic: Always reply to direct @mentions.
  // Reply to "Frank/Coach" keywords 60% of the time to keep it natural.
  const shouldRespond = isMentioned || (nameFound && Math.random() > 0.4);

  if (shouldRespond) {
    // Clean the prompt: Remove the <@ID> tag and the keywords
    const prompt = message.content
      .replace(/<@!?\d+>/gi, "") // Remove Discord mentions
      .replace(/frank|coach|the legend/gi, "") // Remove keywords
      .trim();

    console.log(
      `[TRIGGER]: ${isMentioned ? "Direct Mention" : "Keyword Found"}`,
    );
    console.log(`[INPUT]: ${prompt || "Just hanging out"}`);

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
        },
      });

      const replyText = response.text;
      console.log(`[OUTPUT]: ${replyText}`);

      // Use message.reply to keep the conversation threaded
      await message.reply(replyText);
    } catch (e) {
      console.error("!!! AI ERROR:", e.message);
      await message.reply("I'M BUSY CLEANING MY BEARINGS! TRY LATER!");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
