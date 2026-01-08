// Quick test script to check Discord bot status
require('dotenv').config();
const { REST, Routes } = require('discord.js');

async function testBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
    return;
  }

  console.log('🔍 Checking Discord bot status...\n');
  console.log(`Client ID: ${clientId}`);
  console.log(`Guild ID: ${guildId || 'Not set (using global commands)'}\n`);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    // Test if we can fetch commands
    let commands;
    if (guildId && guildId !== 'your_guild_id_here') {
      console.log('📡 Fetching guild commands...');
      commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      console.log(`✅ Found ${commands.length} guild commands registered\n`);
    } else {
      console.log('📡 Fetching global commands...');
      commands = await rest.get(Routes.applicationCommands(clientId));
      console.log(`✅ Found ${commands.length} global commands registered\n`);
    }

    if (commands.length > 0) {
      console.log('📋 Registered commands:');
      commands.forEach(cmd => {
        console.log(`  - /${cmd.name}: ${cmd.description}`);
      });
    } else {
      console.log('⚠️  No commands found. They may still be registering...');
      console.log('   Global commands can take up to 1 hour to appear.');
      console.log('   Tip: Set DISCORD_GUILD_ID for instant guild commands.\n');
    }

    // Test bot connection
    console.log('🤖 Testing bot connection...');
    const application = await rest.get(Routes.oauth2CurrentApplication());
    console.log(`✅ Bot is connected: ${application.name}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 50001) {
      console.error('   Bot is not in the server! Invite it first.');
    } else if (error.code === 50035) {
      console.error('   Invalid command format. Check command registration code.');
    }
  }
}

testBot();

