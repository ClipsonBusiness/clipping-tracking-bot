// Script to manually register Discord commands
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify a social media account')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to verify')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'TikTok', value: 'tiktok' },
          { name: 'Instagram', value: 'instagram' },
        ))
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your handle (e.g., @channelname)')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('verify-confirm')
    .setDescription('Confirm your account verification')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to confirm')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'TikTok', value: 'tiktok' },
          { name: 'Instagram', value: 'instagram' },
        )),

  new SlashCommandBuilder()
    .setName('submit-clip')
    .setDescription('Submit content for tracking (auto-detects platform)')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('URL of the content to submit')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top clippers leaderboard')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number')
        .setMinValue(1)),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your app account')
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Your account email')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Your account password (optional if not set)')),

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up Discord channels (Admin only)'),
].map(command => command.toJSON());

async function registerCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Registering commands...\n');

    if (guildId && guildId !== 'your_guild_id_here') {
      // Register guild commands (instant)
      console.log(`📡 Registering ${commands.length} commands to guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log(`✅ Successfully registered ${commands.length} guild commands!`);
      console.log('   Commands should appear immediately in your server.\n');
    } else {
      // Register global commands (can take up to 1 hour)
      console.log(`📡 Registering ${commands.length} commands globally...`);
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log(`✅ Successfully registered ${commands.length} global commands!`);
      console.log('   ⚠️  Global commands can take up to 1 hour to appear.');
      console.log('   💡 Tip: Set DISCORD_GUILD_ID in .env for instant commands.\n');
    }

    console.log('📋 Registered commands:');
    commands.forEach(cmd => {
      console.log(`   - /${cmd.name}`);
    });

  } catch (error) {
    console.error('❌ Error registering commands:', error);
    if (error.code === 50001) {
      console.error('   Bot is not in the server! Invite it first.');
    }
  }
}

registerCommands();

