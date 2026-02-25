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

// --- THE PUPPET MASTER FUNCTION ---
const setupBot = (client, command, slopArray, name) => {
  client.once(Events.ClientReady, (c) => {
    console.log(`👔 ${name} ONLINE: ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    // We only want the bots responding to YOUR manual commands for now
    if (message.author.bot) return;

    if (message.content === command) {
      console.log(`[TRIGGER]: ${name} is deploying corporate slop...`);
      const randomMsg = slopArray[Math.floor(Math.random() * slopArray.length)];
      await message.channel.send(randomMsg);
    }
  });
};

// Wire up the trigger commands
setupBot(todd, "todd", toddSlop, "M-CORP TODD");
setupBot(gary, "gary", garySlop, "M-CORP GARY");
setupBot(kyle, "kyle", kyleSlop, "M-CORP KYLE");
setupBot(derek, "derek", derekSlop, "INTERN DEREK");

// Boot them all up using the .env file
todd.login(process.env.MCORP_TODD_TOKEN);
gary.login(process.env.MCORP_GARY_TOKEN);
kyle.login(process.env.MCORP_KYLE_TOKEN);
derek.login(process.env.MCORP_DEREK_TOKEN);
