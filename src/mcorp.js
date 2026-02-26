const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { Client, GatewayIntentBits, Events } = require("discord.js");

// Import the corporate dialogue from our new file
const { toddSlop, garySlop, kyleSlop, derekSlop } = require("./mcorp_dialogue");

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

// Initialize all 4 bots
const todd = new Client({ intents });
const gary = new Client({ intents });
const kyle = new Client({ intents });
const derek = new Client({ intents });

// --- COOLDOWN TRACKER ---
// This keeps track of the last time each bot spoke
const botCooldowns = new Map();
const COOLDOWN_MS = 30000; // 30 seconds (adjust if you want them quieter)

// --- THE PUPPET MASTER FUNCTION ---
const setupBot = (client, nameTrigger, slopArray, logName) => {
  client.once(Events.ClientReady, (c) => {
    console.log(`👔 ${logName} ONLINE: ${c.user.tag}`);
    // Initialize their cooldown timer at 0
    botCooldowns.set(logName, 0);
  });

  client.on(Events.MessageCreate, async (message) => {
    // We only want the bots responding to humans
    if (message.author.bot) return;

    // \b means "word boundary". 'i' means case-insensitive.
    const triggerRegex = new RegExp(`\\b${nameTrigger}\\b`, "i");

    if (triggerRegex.test(message.content)) {
      const now = Date.now();
      const lastSpoke = botCooldowns.get(logName);

      // Check if the bot is still on cooldown
      if (now - lastSpoke < COOLDOWN_MS) {
        console.log(
          `[COOLDOWN]: ${logName} was triggered but is too busy "restructuring" to reply.`,
        );
        return;
      }

      console.log(
        `[TRIGGER]: ${logName} heard their name and is deploying corporate slop...`,
      );

      const randomMsg = slopArray[Math.floor(Math.random() * slopArray.length)];
      await message.channel.send(randomMsg);

      // Reset the timer for this specific bot
      botCooldowns.set(logName, now);
    }
  });
};

// Wire up the triggers using just their names
setupBot(todd, "todd", toddSlop, "M-CORP TODD");
setupBot(gary, "gary", garySlop, "M-CORP GARY");
setupBot(kyle, "kyle", kyleSlop, "M-CORP KYLE");
setupBot(derek, "derek", derekSlop, "INTERN DEREK");

// Boot them all up using the .env file
todd.login(process.env.MCORP_TODD_TOKEN);
gary.login(process.env.MCORP_GARY_TOKEN);
kyle.login(process.env.MCORP_KYLE_TOKEN);
derek.login(process.env.MCORP_DEREK_TOKEN);
