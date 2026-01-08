// @ts-ignore - discord.js types may not be available during build
import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getPrismaClient } from '../utils/prisma';
import { detectPlatformFromUrl } from '../utils/platformDetector';
import { YouTubeCollector } from '../collectors/youtubeCollector';
import { TikTokCollector } from '../collectors/tiktokCollector';
import { InstagramCollector } from '../collectors/instagramCollector';

// Initialize Discord client
// Note: MessageContent intent is only needed if bot reads message content
// For slash commands, we only need Guilds intent
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Required for slash commands and guild events
    // GatewayIntentBits.GuildMessages, // Only needed if reading message content
    // GatewayIntentBits.MessageContent, // Privileged intent - only enable if needed
  ],
});

// Lazy initialization for collectors
function getYouTubeCollector(): YouTubeCollector {
  return new YouTubeCollector();
}

function getTikTokCollector(): TikTokCollector {
  return new TikTokCollector(process.env.APIFY_API_KEY);
}

function getInstagramCollector(): InstagramCollector {
  return new InstagramCollector(
    process.env.APIFY_API_KEY,
    process.env.SOCIAVAULT_API_KEY
  );
}

// Helper function to get user ID from Discord ID
async function getUserIdFromDiscord(discordId: string): Promise<string | null> {
  try {
    const prisma = getPrismaClient();
    // @ts-ignore - discordId exists in schema but may not be in generated types yet
    const user = await (prisma.user as any).findUnique({
      where: { discordId },
      select: { id: true },
    });
    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from Discord:', error);
    return null;
  }
}

// Helper function to get or create guild config
async function getGuildConfig(guildId: string) {
  const prisma = getPrismaClient();
  // @ts-ignore - discordGuild exists in schema but may not be in generated types yet
  const discordGuild = (prisma as any).discordGuild;
  let guild = await discordGuild.findUnique({
    where: { guildId },
  });

  if (!guild) {
    guild = await discordGuild.create({
      data: { guildId },
    });
  }

  return guild;
}

// Helper function to assign Clipper role to a user
async function assignClipperRole(guildId: string, userId: string): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    // Find or create "Clipper" role
    let clipperRole = guild.roles.cache.find((role: any) => role.name.toLowerCase() === 'clipper');

    if (!clipperRole) {
      // Create the role if it doesn't exist
      clipperRole = await guild.roles.create({
        name: 'Clipper',
        color: 0x5865f2, // Discord blurple color
        mentionable: false,
        reason: 'Auto-created for verified clippers',
      });
      console.log(`[Role Assignment] Created "Clipper" role: ${clipperRole.id}`);
    }

    // Assign the role if user doesn't have it
    if (!member.roles.cache.has(clipperRole.id)) {
      await member.roles.add(clipperRole, 'Account verified - auto-assigned Clipper role');
      console.log(`[Role Assignment] Assigned Clipper role to ${member.user.tag} (${userId})`);
      return true;
    } else {
      console.log(`[Role Assignment] User ${member.user.tag} already has Clipper role`);
      return false;
    }
  } catch (error) {
    console.error('[Role Assignment] Error assigning Clipper role:', error);
    return false;
  }
}

// Command handlers
const commands = {
  // Clipper commands
  async start(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🚀 Welcome to ClipSon Tracking Bot!')
      .setDescription('Here\'s how to get started and use the bot:')
      .addFields(
        {
          name: '✅ Step 1: Complete Verification',
          value: 'After running `/verify`, you\'ll receive a verification code.\n' +
                 'Add this code to your social media bio/description, then click the "Check Verification" button in the approval channel.',
          inline: false,
        },
        {
          name: '📤 Step 2: Submit Content',
          value: 'Once verified, use `/submit-clip <url>` to submit your content.\n' +
                 '**Example:** `/submit-clip https://youtube.com/watch?v=...`\n' +
                 'The bot will automatically detect the platform!',
          inline: false,
        },
        {
          name: '📊 View Your Stats',
          value: 'Use `/clipper-stats` to see your total views, likes, comments, shares, and estimated payout.',
          inline: false,
        },
        {
          name: '🏆 Leaderboard',
          value: 'Use `/leaderboard [campaign]` to see top clippers ranked by views.',
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  async verify(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const platform = interaction.options.getString('platform', true).toUpperCase();
    const username = interaction.options.getString('username', true);
    let userId = await getUserIdFromDiscord(interaction.user.id);

    // If user not found by Discord ID, try to find or create by email/Discord username
    if (!userId) {
      try {
        const prisma = getPrismaClient();
        // Try to find user by email matching Discord username pattern
        const discordEmail = `${interaction.user.id}@discord.local`;
        let user = await prisma.user.findUnique({ where: { email: discordEmail } }) as any;
        
        if (!user) {
          // Create a new user with Discord ID and username
          user = await prisma.user.create({
            data: {
              email: discordEmail,
              username: interaction.user.username,
              role: 'CLIPPER',
              discordId: interaction.user.id,
              discordUsername: interaction.user.username || interaction.user.tag || null,
            },
          });
          console.log(`[Discord Bot] Created new user for Discord ID ${interaction.user.id} with username ${interaction.user.username}`);
        } else {
          // Update existing user with Discord ID and username if not set
          const updateData: any = {};
          if (!user.discordId) {
            updateData.discordId = interaction.user.id;
          }
          if (!user.discordUsername || user.discordUsername !== interaction.user.username) {
            updateData.discordUsername = interaction.user.username || interaction.user.tag || null;
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });
            console.log(`[Discord Bot] Updated user ${user.id} with Discord info: ${updateData.discordUsername || user.discordUsername} (${interaction.user.id})`);
          }
        }
        userId = user.id;
      } catch (error) {
        console.error('[Discord Bot] Error creating/linking user:', error);
        return interaction.editReply({
          content: '❌ Error setting up your account. Please contact an admin.',
        });
      }
    }

    if (!interaction.guildId) {
      return interaction.editReply({
        content: '❌ This command must be used in a server.',
      });
    }

    try {
      const prisma = getPrismaClient();
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

      // Create social account
      if (!userId) {
        return interaction.editReply({
          content: '❌ Error: User ID not found. Please try again.',
        });
      }

      const createResponse = await fetch(`${baseUrl}/api/social-accounts/${platform.toLowerCase()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-role': 'CLIPPER',
        },
        body: JSON.stringify({ handle: username }),
      });

      const createData = await createResponse.json() as any;

      // Handle existing account (409) - still allow verification if not verified
      if (createResponse.status === 409 && createData.socialAccountId) {
        // Account exists - check if it's verified
        const existingAccount = await prisma.socialAccount.findUnique({
          where: { id: createData.socialAccountId },
          select: { status: true, verificationCode: true },
        });

        if (existingAccount?.status === 'VERIFIED') {
          return interaction.editReply({
            content: `✅ **Already Verified!**\n\nYour ${platform} account \`${username}\` is already verified. You can use it to submit content.`,
          });
        }

        // Account exists but not verified - use existing account
        const verificationCode = createData.code || existingAccount?.verificationCode;
        const accountId = createData.socialAccountId;

        // Continue with verification flow using existing account
        const guildConfig = await getGuildConfig(interaction.guildId);
        const approvalChannelId = guildConfig.clipperApprovalChannelId;

        if (!approvalChannelId) {
          return interaction.editReply({
            content: '❌ **Error:** Clipper approval channel not set up. Admin must run `/setup` first.',
          });
        }

        // Post to clipper-approval channel (or update existing message)
        const approvalChannel = await client.channels.fetch(approvalChannelId);
        if (!approvalChannel || approvalChannel.type !== ChannelType.GuildText) {
          return interaction.editReply({
            content: '❌ **Error:** Approval channel not found or invalid.',
          });
        }

        // Check if there's an existing message for this account
        let message;
        // @ts-ignore - discordMessageId exists in schema but may not be in generated types yet
        const existingAccountWithMsg = await prisma.socialAccount.findUnique({ where: { id: accountId }, select: { discordMessageId: true } }) as any;
        if (existingAccount && existingAccountWithMsg?.discordMessageId) {
          try {
            const existingMsgId = existingAccountWithMsg?.discordMessageId;
            if (existingMsgId) {
              message = await approvalChannel.messages.fetch(existingMsgId);
              // Update existing message
              const embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle('🔐 Verification Request (Updated)')
                .setDescription(`User ${interaction.user} is attempting to verify ${platform} account`)
                .addFields(
                  { name: 'Platform', value: platform, inline: true },
                  { name: 'Handle', value: username, inline: true },
                  { name: 'Verification Code', value: `\`${verificationCode}\``, inline: false },
                  { name: 'Status', value: '⏳ PENDING', inline: true },
                )
                .setFooter({ text: `Account ID: ${accountId}` })
                .setTimestamp();

              const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`verify_override_${accountId}`)
                    .setLabel('Mark Verified')
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId(`verify_reject_${accountId}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger),
                );

              await message.edit({ embeds: [embed], components: [row] });
            }
          } catch (error) {
            // Message doesn't exist, create new one
            message = null;
          }
        }

        if (!message) {
          // Create new message
          const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🔐 Verification Request')
            .setDescription(`User ${interaction.user} is attempting to verify ${platform} account`)
            .addFields(
              { name: 'Platform', value: platform, inline: true },
              { name: 'Handle', value: username, inline: true },
              { name: 'Verification Code', value: `\`${verificationCode}\``, inline: false },
              { name: 'Status', value: '⏳ PENDING', inline: true },
            )
            .setFooter({ text: `Account ID: ${accountId}` })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`verify_override_${accountId}`)
                .setLabel('Mark Verified')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`verify_reject_${accountId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger),
            );

          message = await approvalChannel.send({
            embeds: [embed],
            components: [row],
          });

          // Store message ID
          // @ts-ignore - discordMessageId exists in schema but may not be in generated types yet
          await (prisma.socialAccount as any).update({
            where: { id: accountId },
            data: { discordMessageId: message.id },
          });
        }

        // Send reply to user with button
        const userEmbed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle('🔐 Verification Request')
          .setDescription(`Your ${platform} account already exists but isn't verified yet. Add this code to complete verification:`)
          .addFields(
            { name: 'Verification Code', value: `\`${verificationCode}\``, inline: false },
            { name: 'Next Step', value: `After adding the code, click the button below to check verification.`, inline: false },
          )
          .setTimestamp();

        const userRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`check_verify_${accountId}`)
              .setLabel('✅ Check Verification')
              .setStyle(ButtonStyle.Primary),
          );

        return interaction.editReply({ 
          embeds: [userEmbed], 
          components: [userRow] 
        });
      }

      if (!createResponse.ok) {
        return interaction.editReply({
          content: `❌ **Error:** ${createData.message || createData.error || 'Failed to create verification request'}`,
        });
      }

      const verificationCode = createData.verificationCode || createData.code;
      const accountId = createData.id || createData.socialAccountId;

      // Get guild config
      const guildConfig = await getGuildConfig(interaction.guildId);
      const approvalChannelId = guildConfig.clipperApprovalChannelId;

      if (!approvalChannelId) {
        return interaction.editReply({
          content: '❌ **Error:** Clipper approval channel not set up. Admin must run `/setup` first.',
        });
      }

      // Post to clipper-approval channel
      const approvalChannel = await client.channels.fetch(approvalChannelId);
      if (!approvalChannel || approvalChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
          content: '❌ **Error:** Approval channel not found or invalid.',
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🔐 Verification Request')
        .setDescription(`User ${interaction.user} is attempting to verify ${platform} account`)
        .addFields(
          { name: 'Platform', value: platform, inline: true },
          { name: 'Handle', value: username, inline: true },
          { name: 'Verification Code', value: `\`${verificationCode}\``, inline: false },
          { name: 'Status', value: '⏳ PENDING', inline: true },
        )
        .setFooter({ text: `Account ID: ${accountId}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_override_${accountId}`)
            .setLabel('Mark Verified')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`verify_reject_${accountId}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger),
        );

      const message = await approvalChannel.send({
        embeds: [embed],
        components: [row],
      });

      // Store message ID in database
      // @ts-ignore - discordMessageId exists in schema but may not be in generated types yet
      await (prisma.socialAccount as any).update({
        where: { id: accountId },
        data: { discordMessageId: message.id },
      });

      // Send reply to user with button
      const userEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🔐 Verification Request Created')
        .setDescription(`Add this verification code to your ${platform} account bio/description:`)
        .addFields(
          { name: 'Verification Code', value: `\`${verificationCode}\``, inline: false },
          { name: 'Next Step', value: `After adding the code, click the button below to check verification.`, inline: false },
        )
        .setTimestamp();

      const userRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`check_verify_${accountId}`)
            .setLabel('✅ Check Verification')
            .setStyle(ButtonStyle.Primary),
        );

      return interaction.editReply({ 
        embeds: [userEmbed], 
        components: [userRow] 
      });
    } catch (error) {
      console.error('Error in verify command:', error);
      return interaction.editReply({
        content: '❌ Failed to create verification request. Please try again later.',
      });
    }
  },

  async verifyConfirm(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const platform = interaction.options.getString('platform', true).toUpperCase();
    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.editReply({
        content: '❌ You need to link your Discord account first. Use `/link <email>` to link your account.',
      });
    }

    if (!interaction.guildId) {
      return interaction.editReply({
        content: '❌ This command must be used in a server.',
      });
    }

    try {
      const prisma = getPrismaClient();
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

      // Find pending account for this user and platform
      const account = await prisma.socialAccount.findFirst({
        where: {
          userId,
          platform,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!account) {
        return interaction.editReply({
          content: `❌ No pending verification found for ${platform}. Use \`/verify ${platform.toLowerCase()} <username>\` first.`,
        });
      }

      // Verify the account
      const verifyResponse = await fetch(`${baseUrl}/api/social-accounts/${account.id}/verify`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
          'x-user-role': 'CLIPPER',
        },
      });

      const verifyData = await verifyResponse.json() as any;

      // Get guild config and update message
      const guildConfig = await getGuildConfig(interaction.guildId);
      const approvalChannelId = guildConfig.clipperApprovalChannelId;

      const accountAny = account as any;
      if (approvalChannelId && accountAny.discordMessageId) {
        try {
          const approvalChannel = await client.channels.fetch(approvalChannelId);
          if (approvalChannel && approvalChannel.type === ChannelType.GuildText) {
            const message = await approvalChannel.messages.fetch(accountAny.discordMessageId);
            
            const newEmbed = new EmbedBuilder()
              .setColor(verifyData.status === 'VERIFIED' ? 0x00ff00 : 0xff0000)
              .setTitle(verifyData.status === 'VERIFIED' ? '✅ Verified' : '❌ Verification Failed')
              .setDescription(`User ${interaction.user} verification ${verifyData.status === 'VERIFIED' ? 'succeeded' : 'failed'}`)
              .addFields(
                { name: 'Platform', value: platform, inline: true },
                { name: 'Handle', value: account.handle, inline: true },
                { name: 'Status', value: verifyData.status === 'VERIFIED' ? '✅ VERIFIED' : '❌ FAILED', inline: true },
              )
              .setTimestamp();

            await message.edit({
              embeds: [newEmbed],
              components: [], // Remove buttons after verification
            });
          }
        } catch (error) {
          console.error('Error updating verification message:', error);
        }
      }

      if (verifyResponse.ok && verifyData.status === 'VERIFIED') {
        // Assign Clipper role if in a guild
        if (interaction.guildId) {
          try {
            await assignClipperRole(interaction.guildId, interaction.user.id);
          } catch (roleError) {
            console.error('[Verification] Error assigning role:', roleError);
            // Continue even if role assignment fails
          }
        }

        return interaction.editReply({
          content: `✅ **Account Verified!** Your ${platform} account has been successfully verified. You've been assigned the Clipper role!`,
        });
      } else {
        return interaction.editReply({
          content: `❌ **Verification Failed:** ${verifyData.message || 'Verification code not found. Make sure you added it to your account bio/description.'}`,
        });
      }
    } catch (error) {
      console.error('Error in verify-confirm command:', error);
      return interaction.editReply({
        content: '❌ Failed to verify account. Please try again later.',
      });
    }
  },

  async submitClip(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const url = interaction.options.getString('url', true);
    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.editReply({
        content: '❌ You need to link your Discord account first. Use `/link <email>` to link your account.',
      });
    }

    if (!interaction.guildId) {
      return interaction.editReply({
        content: '❌ This command must be used in a server.',
      });
    }

    try {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

      // Submit content
      const response = await fetch(`${baseUrl}/api/submissions/auto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-role': 'CLIPPER',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        let errorMessage = data.message || data.error || 'Unknown error';
        
        if (data.error === 'AUTHOR_MISMATCH') {
          errorMessage = `❌ **Author Mismatch**\n\nYou don't have a verified account matching this content's author.\n\nPlease verify your social account first using \`/verify\`.`;
        } else if (data.error === 'PLATFORM_NOT_ALLOWED') {
          errorMessage = `❌ **Platform Not Allowed**\n\n${data.message || 'This platform is not accepted for the current campaign.'}`;
        } else if (data.error === 'Submission already exists for this video') {
          errorMessage = `⚠️ This content has already been submitted.`;
        }

        return interaction.editReply({
          content: `❌ **Error:** ${errorMessage}`,
        });
      }

      // Get guild config
      const prisma = getPrismaClient();
      const guildConfig = await getGuildConfig(interaction.guildId);
      const reviewChannelId = guildConfig.contentReviewChannelId;

      if (reviewChannelId) {
        try {
          const reviewChannel = await client.channels.fetch(reviewChannelId);
          if (reviewChannel && reviewChannel.type === ChannelType.GuildText) {
            // Get submitter info
            const submitter = await prisma.user.findUnique({
              where: { id: userId },
              select: { username: true, email: true },
            });

            // Get creator handle from verified social account
            const creatorAccount = await prisma.socialAccount.findFirst({
              where: {
                userId: userId,
                platform: data.platform,
                platformUserId: data.authorPlatformUserId,
                status: 'VERIFIED',
              },
              select: { handle: true },
            });

            const creatorHandle = creatorAccount?.handle || data.authorPlatformUserId || 'Unknown';
            const platformName = data.platform === 'YOUTUBE' ? 'Youtube' : data.platform === 'TIKTOK' ? 'TikTok' : 'Instagram';
            const submitterName = submitter?.username || interaction.user.username;

            // Send URL first (Discord will auto-embed YouTube/TikTok/Instagram)
            const urlMessage = await reviewChannel.send(data.canonicalUrl || url);

            // Create Content Review embed
            const embed = new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('Content Review')
              .setDescription('Content submitted for review.')
              .addFields(
                { name: 'Platform', value: platformName, inline: false },
                { name: 'Submitted by', value: `@${submitterName}`, inline: false },
                { name: 'URL', value: data.canonicalUrl || url, inline: false },
                { name: 'Creator', value: `@${creatorHandle}`, inline: false },
              );

            // Add verified accounts field if creator is verified
            if (creatorAccount) {
              embed.addFields({
                name: 'Verified Accounts',
                value: `✅ @${creatorHandle}`,
                inline: false,
              });
            }

            // Add stats
            embed.addFields(
              { name: 'Views', value: String(data.latestViews || 0), inline: true },
              { name: 'Likes', value: String(data.latestLikes || 0), inline: true },
              { name: 'Comments', value: String(data.latestComments || 0), inline: true },
              { name: 'Shares', value: String(data.latestShares || 0), inline: true },
            );

            embed.setTimestamp();

            // Add action button (only Remove Content, since everything is approved by default)
            const row = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`reject_${data.id}`)
                  .setLabel('Remove Content')
                  .setStyle(ButtonStyle.Danger),
              );

            const message = await reviewChannel.send({
              embeds: [embed],
              components: [row],
            });

            // Store message ID
            // @ts-ignore - discordMessageId exists in schema but may not be in generated types yet
            await (prisma.submission as any).update({
              where: { id: data.id },
              data: { discordMessageId: message.id },
            });
          }
        } catch (error) {
          console.error('Error posting to review channel:', error);
        }
      }

      return interaction.editReply({
        content: `✅ **Submission Successful!** Your content has been submitted and posted to the review channel.`,
      });
    } catch (error) {
      console.error('Error submitting clip:', error);
      return interaction.editReply({
        content: '❌ Failed to submit content. Please try again later.',
      });
    }
  },

  async leaderboard(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const campaignName = interaction.options.getString('campaign');
    const pageSize = 10;

    try {
      const prisma = getPrismaClient();

      // Find campaign if specified
      let campaign = null;
      if (campaignName) {
        campaign = await prisma.campaign.findFirst({
          where: { name: campaignName },
          orderBy: { createdAt: 'desc' },
        });

        if (!campaign) {
          return interaction.editReply({
            content: `❌ Campaign "${campaignName}" not found.`,
          });
        }
      } else {
        // If no campaign specified, find the most recent active campaign
        const now = new Date();
        campaign = await prisma.campaign.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [
              { startDate: null },
              { startDate: { lte: now } },
            ],
            AND: [
              { OR: [
                { endDate: null },
                { endDate: { gte: now } },
              ]},
            ],
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // Build where clause for submissions
      const whereClause: any = {
        status: { in: ['PENDING', 'APPROVED'] },
      };

      if (campaign) {
        whereClause.campaignId = campaign.id;
      }

      // Get top clippers by total views (not submission count)
      const topClippers = await prisma.submission.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: { id: true },
        _sum: {
          latestViews: true,
        },
        orderBy: {
          _sum: {
            latestViews: 'desc',
          },
        },
        take: pageSize,
        skip: (page - 1) * pageSize,
      });

      // Get total count for pagination
      const totalUniqueUsers = await prisma.submission.groupBy({
        by: ['userId'],
        where: whereClause,
      });
      const totalPages = Math.ceil(totalUniqueUsers.length / pageSize);

      // Get user details
      const userIds = topClippers.map(c => c.userId);
      // @ts-ignore - discordId exists in schema but may not be in generated types yet
      const users = await (prisma.user as any).findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, username: true, discordId: true },
      });

      const userMap = new Map(users.map((u: any) => [u.id, u]));

      // Get social account handles for all users
      const socialAccounts = await prisma.socialAccount.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, handle: true },
        orderBy: { createdAt: 'asc' }, // Get first verified account
      });

      // Create a map of userId -> handle (prefer first handle found)
      const handleMap = new Map<string, string>();
      socialAccounts.forEach((account: any) => {
        if (account.handle && !handleMap.has(account.userId)) {
          handleMap.set(account.userId, account.handle.replace('@', ''));
        }
      });

      // Get campaign payment info for payout calculation
      const paymentPerMillion = campaign?.payoutPerLink 
        ? campaign.payoutPerLink * 1000000 
        : 0;
      const minViewsRequired = campaign?.minViewsPerClip || 0;

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏆 Clipper Leaderboard${campaign ? ` (Page ${page}/${totalPages})` : ` (Page ${page}/${totalPages})`}`)
        .setTimestamp();

      // Add campaign info if available
      if (campaign) {
        embed.setDescription(`**${campaign.name}**`);
        embed.addFields(
          {
            name: 'Minimum Views Required',
            value: minViewsRequired.toLocaleString(),
            inline: true,
          },
          {
            name: 'Payment per Million',
            value: paymentPerMillion > 0 
              ? `$${paymentPerMillion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'N/A',
            inline: true,
          },
        );
      }

      // Add leaderboard entries
      for (let index = 0; index < topClippers.length; index++) {
        const clipper = topClippers[index];
        const user = userMap.get(clipper.userId);
        const rank = (page - 1) * pageSize + index + 1;
        const totalViews = clipper._sum.latestViews || 0;
        const clips = clipper._count.id || 0;
        
        // Get username from social account handle or user data
        const handle = handleMap.get(clipper.userId);
        const userAny = user as any;
        const username = handle || userAny?.username || userAny?.email?.split('@')[0] || 'Unknown';

        // Calculate estimated payout
        let estimatedPayout = '$0.00';
        if (paymentPerMillion > 0 && totalViews > 0) {
          const payout = (totalViews / 1000000) * paymentPerMillion;
          estimatedPayout = `$${payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        embed.addFields({
          name: `${rank}. ${username}`,
          value: `Views: ${totalViews.toLocaleString()}\nClips: ${clips}\nEstimated Payout: ${estimatedPayout}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return interaction.editReply({
        content: '❌ Failed to fetch leaderboard. Please try again later.',
      });
    }
  },

  async clipperStats(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.editReply({
        content: '❌ You need to link your Discord account first. Use `/verify` to get started.',
      });
    }

    try {
      const prisma = getPrismaClient();

      // Get all submissions for this user with campaign info
      const submissions = await prisma.submission.findMany({
        where: { userId },
        select: {
          id: true,
          platform: true,
          status: true,
          latestViews: true,
          latestLikes: true,
          latestComments: true,
          latestShares: true,
          createdAt: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              payoutPerLink: true,
              minViewsPerClip: true,
              minViewsForPayout: true,
            },
          },
        },
      });

      // Calculate totals
      const totalSubmissions = submissions.length;
      const totalViews = submissions.reduce((sum: number, s: any) => sum + (s.latestViews || 0), 0);
      const totalLikes = submissions.reduce((sum: number, s: any) => sum + (s.latestLikes || 0), 0);
      const totalComments = submissions.reduce((sum: number, s: any) => sum + (s.latestComments || 0), 0);
      const totalShares = submissions.reduce((sum: number, s: any) => sum + (s.latestShares || 0), 0);

      // Calculate estimated payout per campaign
      // payoutPerLink is stored as "per view" (e.g., 0.001 for $1000 per million views)
      // Only calculate payout if user has reached the minimum views requirement
      const campaignPayouts = new Map<string, { views: number; payoutPerView: number; campaignName: string; minViews: number }>();
      
      submissions.forEach((submission: any) => {
        if (submission.campaignId && submission.campaign?.payoutPerLink && submission.campaign.payoutPerLink > 0) {
          const campaignId = submission.campaignId;
          const payoutPerView = submission.campaign.payoutPerLink;
          const views = submission.latestViews || 0;
          const campaignName = submission.campaign.name || 'Unknown';
          // Use minViewsForPayout if available, otherwise minViewsPerClip, otherwise 0
          const minViews = submission.campaign.minViewsForPayout || submission.campaign.minViewsPerClip || 0;
          
          const existing = campaignPayouts.get(campaignId) || { views: 0, payoutPerView, campaignName, minViews };
          campaignPayouts.set(campaignId, {
            views: existing.views + views,
            payoutPerView,
            campaignName,
            minViews: Math.max(existing.minViews, minViews), // Use the highest minimum requirement
          });
        }
      });

      // Calculate total estimated payout
      // Only count payouts for campaigns where user has reached minimum views
      let totalEstimatedPayout = 0;
      let minViewsRequired = 0;
      campaignPayouts.forEach(({ views, payoutPerView, campaignName, minViews }: any) => {
        if (payoutPerView > 0 && views > 0) {
          // Only calculate payout if views meet or exceed minimum requirement
          if (views >= minViews) {
            const campaignPayout = views * payoutPerView;
            totalEstimatedPayout += campaignPayout;
            console.log(`[Clipper Stats] Campaign "${campaignName}": ${views.toLocaleString()} views (min: ${minViews.toLocaleString()}) × $${payoutPerView.toFixed(6)}/view = $${campaignPayout.toFixed(2)}`);
          } else {
            console.log(`[Clipper Stats] Campaign "${campaignName}": ${views.toLocaleString()} views (need ${minViews.toLocaleString()}) - not eligible for payout yet`);
            // Track the minimum views requirement for display
            if (minViews > minViewsRequired) {
              minViewsRequired = minViews;
            }
          }
        }
      });

      // Status breakdown
      const approvedCount = submissions.filter((s: any) => s.status === 'APPROVED').length;
      const pendingCount = submissions.filter((s: any) => s.status === 'PENDING').length;
      const rejectedCount = submissions.filter((s: any) => s.status === 'REJECTED').length;

      // Platform breakdown
      const platformBreakdown = submissions.reduce((acc: any, s: any) => {
        acc[s.platform] = (acc[s.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true },
      });

      const username = user?.username || user?.email?.split('@')[0] || 'Unknown';

      // Get social account handles
      const socialAccounts = await prisma.socialAccount.findMany({
        where: { userId, status: 'VERIFIED' },
        select: { platform: true, handle: true },
      });

      const platformIcons: Record<string, string> = {
        'YOUTUBE': '▶️',
        'TIKTOK': '🎵',
        'INSTAGRAM': '📷',
      };

      const verifiedPlatforms = socialAccounts.map((acc: any) => {
        const icon = platformIcons[acc.platform] || '📱';
        return `${icon} ${acc.handle}`;
      }).join('\n') || 'None';

      // Create stats embed
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Your Clipper Statistics`)
        .setDescription(`Stats for **${username}**`)
        .addFields(
          {
            name: '👀 Total Views',
            value: totalViews.toLocaleString(),
            inline: true,
          },
          {
            name: '❤️ Total Likes',
            value: totalLikes.toLocaleString(),
            inline: true,
          },
          {
            name: '💬 Total Comments',
            value: totalComments.toLocaleString(),
            inline: true,
          },
          {
            name: '📤 Total Shares',
            value: totalShares.toLocaleString(),
            inline: true,
          },
          {
            name: '💰 Estimated Payout',
            value: totalEstimatedPayout > 0
              ? `$${totalEstimatedPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : minViewsRequired > 0 && totalViews < minViewsRequired
              ? `$0.00\n*(Need ${minViewsRequired.toLocaleString()} views)*`
              : '$0.00',
            inline: true,
          },
          {
            name: '📹 Total Submissions',
            value: totalSubmissions.toLocaleString(),
            inline: true,
          },
          {
            name: '✅ Approved',
            value: approvedCount.toLocaleString(),
            inline: true,
          },
          {
            name: '⏳ Pending',
            value: pendingCount.toLocaleString(),
            inline: true,
          },
          {
            name: '❌ Rejected',
            value: rejectedCount.toLocaleString(),
            inline: true,
          },
          {
            name: '✅ Verified Accounts',
            value: verifiedPlatforms || 'None',
            inline: false,
          },
        )
        .setTimestamp();

      // Add platform breakdown if there are submissions
      if (Object.keys(platformBreakdown).length > 0) {
        const platformList = Object.entries(platformBreakdown)
          .map(([platform, count]: [string, any]) => {
            const icon = platformIcons[platform] || '📱';
            return `${icon} ${platform}: ${count}`;
          })
          .join('\n');

        embed.addFields({
          name: '📱 Platform Breakdown',
          value: platformList,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error('[Clipper Stats] Error:', error);
      return interaction.editReply({
        content: `❌ Error fetching your statistics: ${error.message}`,
      });
    }
  },

  // Admin commands
  async adminCampaign(interaction: ChatInputCommandInteraction) {
    const action = interaction.options.getString('action', true);
    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.reply({
        content: '❌ You need to link your Discord account first. Use `/link <email>` to link your account.',
        ephemeral: true,
      });
    }

    // Check if user is admin
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return interaction.reply({
        content: '❌ Only admins can use this command.',
        ephemeral: true,
      });
    }

    if (action === 'create') {
      const name = interaction.options.getString('name');
      
      if (!name) {
        return interaction.reply({
          content: '❌ Campaign name is required. Usage: `/admin-campaign action:create name:YourCampaignName`',
          ephemeral: true,
        });
      }

      // Show modal form
      const modal = new ModalBuilder()
        .setCustomId(`campaign_create_${name}`)
        .setTitle(`Create Campaign: ${name}`);

      // Discord modals can only have 5 rows max and 1 input per row
      // Combine dates into one field: "MM/DD/YYYY - MM/DD/YYYY"
      const datesInput = new TextInputBuilder()
        .setCustomId('dates')
        .setLabel('Dates: Start - End (MM/DD/YYYY - MM/DD/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 03/15/2024 - 04/15/2024')
        .setRequired(true);

      const minViewsInput = new TextInputBuilder()
        .setCustomId('min_views')
        .setLabel('Minimum Views Required')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 100000')
        .setRequired(true);

      const paymentPerMillionInput = new TextInputBuilder()
        .setCustomId('payment_per_million')
        .setLabel('Payment per Million Views ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 1000')
        .setRequired(true);

      const totalBudgetInput = new TextInputBuilder()
        .setCustomId('total_budget')
        .setLabel('Total Budget ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 10000')
        .setRequired(true);

      const platformsInput = new TextInputBuilder()
        .setCustomId('platforms')
        .setLabel('Accepted Platforms (comma-separated)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., TIKTOK,INSTAGRAM,YOUTUBE or leave empty for all')
        .setRequired(false);

      // 5 rows, 1 input per row
      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(datesInput);
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minViewsInput);
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(paymentPerMillionInput);
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(totalBudgetInput);
      const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(platformsInput);

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

      return interaction.showModal(modal);

    } else if (action === 'edit') {
      try {
        const name = interaction.options.getString('name');
        
        if (!name) {
          return interaction.reply({
            content: '❌ Campaign name is required. Usage: `/admin-campaign action:edit name:CampaignName`',
            ephemeral: true,
          });
        }

        // Find campaign by name
        const campaign = await prisma.campaign.findFirst({
          where: { name },
          orderBy: { createdAt: 'desc' }, // Get most recent if multiple with same name
        });

        if (!campaign) {
          return interaction.reply({
            content: `❌ Campaign "${name}" not found. Please check the name and try again.`,
            ephemeral: true,
          });
        }

        // Format dates for display
        const formatDateForInput = (date: Date | null): string => {
          if (!date) return '';
          try {
            const dateObj = date instanceof Date ? date : new Date(date);
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const year = dateObj.getFullYear();
            return `${month}/${day}/${year}`;
          } catch (error) {
            console.error('Error formatting date:', error);
            return '';
          }
        };

        // Format platforms for display
        let platformsValue = '';
        if (campaign.acceptedPlatforms) {
          try {
            const platforms = typeof campaign.acceptedPlatforms === 'string' 
              ? JSON.parse(campaign.acceptedPlatforms) 
              : campaign.acceptedPlatforms;
            platformsValue = Array.isArray(platforms) ? platforms.join(',') : '';
          } catch (error) {
            console.error('Error parsing platforms:', error);
            platformsValue = '';
          }
        }

        // Calculate payment per million from payoutPerLink
        const paymentPerMillion = campaign.payoutPerLink ? (campaign.payoutPerLink * 1000000) : 0;

      // Show modal form with pre-filled values
      const modal = new ModalBuilder()
        .setCustomId(`campaign_edit_${campaign.id}`)
        .setTitle(`Edit Campaign: ${name}`);

      // Discord modals can only have 5 rows max and 1 input per row
      // Combine dates into one field: "MM/DD/YYYY - MM/DD/YYYY"
      const startDateFormatted = formatDateForInput(campaign.startDate);
      const endDateFormatted = formatDateForInput(campaign.endDate);
      const datesValue = startDateFormatted && endDateFormatted 
        ? `${startDateFormatted} - ${endDateFormatted}`
        : '';

      const datesInput = new TextInputBuilder()
        .setCustomId('dates')
        .setLabel('Dates: Start - End (MM/DD/YYYY - MM/DD/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 03/15/2024 - 04/15/2024')
        .setValue(datesValue)
        .setRequired(true);

      const minViewsInput = new TextInputBuilder()
        .setCustomId('min_views')
        .setLabel('Minimum Views Required')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 100000')
        .setValue(String(campaign.minViewsPerClip || ''))
        .setRequired(true);

      const paymentPerMillionInput = new TextInputBuilder()
        .setCustomId('payment_per_million')
        .setLabel('Payment per Million Views ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 1000')
        .setValue(String(paymentPerMillion || ''))
        .setRequired(true);

      const totalBudgetInput = new TextInputBuilder()
        .setCustomId('total_budget')
        .setLabel('Total Budget ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 10000')
        .setValue(String(campaign.totalBudget || ''))
        .setRequired(true);

      const platformsInput = new TextInputBuilder()
        .setCustomId('platforms')
        .setLabel('Accepted Platforms (comma-separated)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., TIKTOK,INSTAGRAM,YOUTUBE or leave empty for all')
        .setValue(platformsValue)
        .setRequired(false);

      // 5 rows, 1 input per row
      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(datesInput);
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minViewsInput);
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(paymentPerMillionInput);
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(totalBudgetInput);
      const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(platformsInput);

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

      return interaction.showModal(modal);
      } catch (error) {
        console.error('[Edit Campaign] Error:', error);
        return interaction.reply({
          content: `❌ **Error loading campaign:** ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the server logs for details.`,
          ephemeral: true,
        });
      }
    } else if (action === 'delete') {
      return interaction.reply({
        content: '⚠️ Delete functionality coming soon!',
        ephemeral: true,
      });
    }
  },

  async checkActiveCampaigns(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.editReply({
        content: '❌ You need to link your Discord account first.',
      });
    }

    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        return interaction.editReply({
          content: '❌ Only admins can check active campaigns.',
        });
      }

      // Get all campaigns with their status
      const campaigns = await prisma.campaign.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          _count: {
            select: {
              submissions: true,
              members: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
      const pausedCampaigns = campaigns.filter((c: any) => c.status === 'PAUSED');
      const otherCampaigns = campaigns.filter((c: any) => !['ACTIVE', 'PAUSED'].includes(c.status));

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Campaign Status Overview')
        .setTimestamp();

      if (activeCampaigns.length > 0) {
        let activeList = activeCampaigns.map((c: any) => {
          const startDate = c.startDate ? new Date(c.startDate).toLocaleDateString() : 'N/A';
          const endDate = c.endDate ? new Date(c.endDate).toLocaleDateString() : 'N/A';
          return `**${c.name}**\n` +
            `ID: \`${c.id}\`\n` +
            `Status: ✅ ACTIVE\n` +
            `Dates: ${startDate} - ${endDate}\n` +
            `Submissions: ${c._count.submissions} | Members: ${c._count.members}`;
        }).join('\n\n');

        embed.addFields({
          name: `✅ Active Campaigns (${activeCampaigns.length})`,
          value: activeList || 'None',
          inline: false,
        });
      } else {
        embed.addFields({
          name: '✅ Active Campaigns',
          value: 'No active campaigns',
          inline: false,
        });
      }

      if (pausedCampaigns.length > 0) {
        let pausedList = pausedCampaigns.slice(0, 5).map((c: any) => {
          return `**${c.name}** (ID: \`${c.id}\`) - ${c._count.submissions} submissions`;
        }).join('\n');

        if (pausedCampaigns.length > 5) {
          pausedList += `\n... and ${pausedCampaigns.length - 5} more`;
        }

        embed.addFields({
          name: `⏸️ Paused Campaigns (${pausedCampaigns.length})`,
          value: pausedList || 'None',
          inline: false,
        });
      }

      if (otherCampaigns.length > 0) {
        embed.addFields({
          name: `📋 Other Status (${otherCampaigns.length})`,
          value: otherCampaigns.map((c: any) => `**${c.name}** (ID: \`${c.id}\`) - ${c.status}`).join('\n') || 'None',
          inline: false,
        });
      }

      if (activeCampaigns.length > 1) {
        embed.setDescription(`⚠️ **Warning:** You have ${activeCampaigns.length} active campaigns. Only one should be active at a time.`);
        embed.setColor(0xffa500);
      } else if (activeCampaigns.length === 1) {
        embed.setDescription(`✅ You have 1 active campaign.`);
      } else {
        embed.setDescription(`ℹ️ No active campaigns.`);
      }

      // Create delete buttons for all campaigns
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      const allCampaigns = [...activeCampaigns, ...pausedCampaigns, ...otherCampaigns];
      
      // Discord allows max 5 action rows, and each row can have up to 5 buttons
      // We'll show up to 25 campaigns (5 rows × 5 buttons)
      const campaignsToShow = allCampaigns.slice(0, 25);
      
      for (let i = 0; i < campaignsToShow.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        const campaignBatch = campaignsToShow.slice(i, i + 5);
        
        campaignBatch.forEach((campaign: any) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`delete_campaign_${campaign.id}`)
              .setLabel(`🗑️ ${campaign.name.length > 20 ? campaign.name.substring(0, 17) + '...' : campaign.name}`)
              .setStyle(ButtonStyle.Danger)
          );
        });
        
        components.push(row);
      }

      return interaction.editReply({ 
        embeds: [embed],
        components: components.length > 0 ? components : undefined,
      });
    } catch (error: any) {
      console.error('[Check Active Campaigns] Error:', error);
      return interaction.editReply({
        content: `❌ Error checking campaigns: ${error.message}`,
      });
    }
  },

  async adminCampaignStats(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = await getUserIdFromDiscord(interaction.user.id);

    if (!userId) {
      return interaction.editReply({
        content: '❌ You need to link your Discord account first.',
      });
    }

    // Check if user is admin
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return interaction.editReply({
        content: '❌ Only admins can view campaign statistics.',
      });
    }

    const campaignName = interaction.options.getString('campaign');
    const now = new Date();

    try {
      let campaigns;

      if (campaignName) {
        // Get specific campaign
        const campaign = await prisma.campaign.findFirst({
          where: { name: campaignName },
          orderBy: { createdAt: 'desc' },
          include: {
            submissions: {
              where: {
                status: { in: ['PENDING', 'APPROVED'] },
              },
              select: {
                latestViews: true,
                status: true,
              },
            },
          },
        });

        if (!campaign) {
          return interaction.editReply({
            content: `❌ Campaign "${campaignName}" not found.`,
          });
        }

        campaigns = [campaign];
      } else {
        // Get all active campaigns
        campaigns = await prisma.campaign.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { startDate: null },
              { startDate: { lte: now } },
            ],
            AND: [
              { OR: [
                { endDate: null },
                { endDate: { gte: now } },
              ]},
            ],
          },
          include: {
            submissions: {
              where: {
                status: { in: ['PENDING', 'APPROVED'] },
              },
              select: {
                latestViews: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Limit to 10 most recent campaigns
        });
      }

      if (campaigns.length === 0) {
        return interaction.editReply({
          content: '❌ No active campaigns found.',
        });
      }

      // Get all active submissions count (for "All Campaigns" stat)
      const allActiveSubmissions = await prisma.submission.count({
        where: {
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      // Create embeds for each campaign
      const embeds = campaigns.map((campaign: any) => {
        const campaignSubmissions = campaign.submissions || [];
        const activeVideosThisCampaign = campaignSubmissions.length;
        const totalViews = campaignSubmissions.reduce((sum: number, s: any) => sum + (s.latestViews || 0), 0);

        // Calculate goal progress
        let goalProgress = '0.0';
        const minViewsRequired = campaign.minViewsPerClip || 0;
        
        if (campaign.targetSubmissions && campaign.targetSubmissions > 0) {
          goalProgress = ((activeVideosThisCampaign / campaign.targetSubmissions) * 100).toFixed(1);
        } else if (minViewsRequired > 0) {
          const estimatedGoal = minViewsRequired * Math.max(1, activeVideosThisCampaign);
          goalProgress = estimatedGoal > 0
            ? ((totalViews / estimatedGoal) * 100).toFixed(1)
            : '0.0';
        }

        // Calculate time remaining
        let timeRemaining = 'N/A';
        if (campaign.endDate) {
          const endDate = new Date(campaign.endDate);
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          timeRemaining = `${Math.max(0, daysRemaining)} days`;
        }

        // Format payment per million
        const paymentPerMillion = campaign.payoutPerLink 
          ? (campaign.payoutPerLink * 1000000).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })
          : '0.00';

        // Format total budget
        const totalBudget = campaign.totalBudget 
          ? campaign.totalBudget.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })
          : '0.00';

        // Create status embed
        const statusEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📊 Daily Campaign Status: ${campaign.name}`)
          .addFields(
            {
              name: '📹 Active Videos (This Campaign)',
              value: activeVideosThisCampaign.toLocaleString(),
              inline: true,
            },
            {
              name: '📹 Active Videos (All Campaigns)',
              value: allActiveSubmissions.toLocaleString(),
              inline: true,
            },
            {
              name: '👀 Total Views',
              value: totalViews.toLocaleString(),
              inline: true,
            },
            {
              name: '📈 Goal Progress',
              value: `${goalProgress}%`,
              inline: true,
            },
            {
              name: '⏰ Time Remaining',
              value: timeRemaining,
              inline: true,
            },
            {
              name: '💰 Payment per Million',
              value: `$${paymentPerMillion}`,
              inline: true,
            },
            {
              name: '💵 Total Budget',
              value: `$${totalBudget}`,
              inline: true,
            },
            {
              name: '🎯 Minimum Views Required',
              value: minViewsRequired.toLocaleString(),
              inline: true,
            },
          )
          .setTimestamp();

        return statusEmbed;
      });

      return interaction.editReply({
        content: campaigns.length === 1 
          ? `📊 **Campaign Statistics**` 
          : `📊 **Campaign Statistics** (showing ${campaigns.length} campaigns)`,
        embeds: embeds,
      });

    } catch (error: any) {
      console.error('[Admin Campaign Stats] Error:', error);
      return interaction.editReply({
        content: `❌ Error fetching campaign statistics: ${error.message}`,
      });
    }
  },

  async setup(interaction: ChatInputCommandInteraction) {
    console.log('[Setup] Command received! User:', interaction.user.id, 'Guild:', interaction.guildId);
    
    try {
      await interaction.deferReply({ ephemeral: true });
      console.log('[Setup] Deferred reply successfully');
    } catch (deferError) {
      console.error('[Setup] Failed to defer reply:', deferError);
      // Try to reply instead
      try {
        await interaction.reply({ content: 'Processing...', ephemeral: true });
      } catch (replyError) {
        console.error('[Setup] Failed to reply:', replyError);
        return;
      }
    }

    if (!interaction.guildId) {
      return interaction.editReply({
        content: '❌ This command must be used in a server.',
      });
    }

    const prisma = getPrismaClient();
    
    // Check if Discord account is linked
    let userId = await getUserIdFromDiscord(interaction.user.id);
    let user;
    
    if (!userId) {
      // Auto-create admin user if not linked
      // Use Discord username/ID as email if no account exists
      const discordEmail = `${interaction.user.id}@discord.local`;
      const discordUsername = interaction.user.username;
      
      try {
        // Check if user exists by email
        const existingUser = await prisma.user.findUnique({
          where: { email: discordEmail },
        });
        
        if (existingUser) {
          // Link existing user
          // @ts-ignore - discordId exists in schema but may not be in generated types yet
          await (prisma.user as any).update({
            where: { id: existingUser.id },
            data: { discordId: interaction.user.id },
          });
          userId = existingUser.id;
          user = existingUser;
        } else {
          // Create new admin user
          // @ts-ignore - discordId exists in schema but may not be in generated types yet
          user = await (prisma.user as any).create({
            data: {
              email: discordEmail,
              username: discordUsername,
              role: 'ADMIN',
              discordId: interaction.user.id,
            },
          });
          userId = user.id;
        }
      } catch (error) {
        console.error('Error creating/linking user:', error);
        return interaction.editReply({
          content: '❌ Failed to set up your account. Please contact support.',
        });
      }
    } else {
      // User is already linked, fetch their info
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
    }

    // Check if user is admin (or make them admin if auto-created)
    if (user?.role !== 'ADMIN') {
      // If user was just created, they're already admin
      // Otherwise, check if they should be admin
      return interaction.editReply({
        content: '❌ **Access Denied:** This command is only available to admins.',
      });
    }

    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply({
          content: '❌ Could not access guild information.',
        });
      }

      // Check if bot has necessary permissions
      const botMember = await guild.members.fetch(client.user!.id);
      const botPermissions = botMember.permissions;
      
      console.log('[Setup] Bot permissions:', botPermissions.toArray());
      
      if (!botPermissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: '❌ Bot needs "Manage Channels" permission to set up channels.\n\nPlease check:\n1. Bot role has "Manage Channels" permission\n2. Bot role is above the channels it needs to create\n3. Server settings → Roles → Bot role → Permissions',
        });
      }

      // Check if channels already exist
      // @ts-ignore - discordGuild exists in schema but may not be in generated types yet
      const existingGuild = await (prisma as any).discordGuild.findUnique({
        where: { guildId: interaction.guildId },
      });

      if (existingGuild?.adminCategoryId) {
        try {
          const existingCategory = await guild.channels.fetch(existingGuild.adminCategoryId);
          if (existingCategory) {
            return interaction.editReply({
              content: `✅ **Already Set Up!**\n\nChannels already exist:\n- Category: ${existingCategory.name}\n- Clipper Approval: <#${existingGuild.clipperApprovalChannelId}>\n- Content Review: <#${existingGuild.contentReviewChannelId}>\n\nIf you want to recreate them, delete the existing channels first.`,
            });
          }
        } catch (error) {
          // Category doesn't exist, continue with creation
          console.log('[Setup] Existing category not found, creating new one');
        }
      }

      // Create category
      console.log('[Setup] Creating category...');
      console.log('[Setup] Guild ID:', guild.id);
      console.log('[Setup] Bot user ID:', client.user?.id);
      console.log('[Setup] Bot member permissions:', botPermissions.toArray());
      console.log('[Setup] Bot has ManageChannels:', botPermissions.has(PermissionFlagsBits.ManageChannels));
      
      let category;
      try {
        // Create category with bot having full permissions
        category = await guild.channels.create({
          name: 'Clipping Bot',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: client.user!.id, // Bot itself - allow everything
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: interaction.user.id, // Admin user
              allow: [PermissionFlagsBits.ViewChannel],
            },
          ],
        });
        console.log('[Setup] Category created successfully:', category.id);
      } catch (createError: any) {
        console.error('[Setup] Category creation failed:', createError);
        console.error('[Setup] Error code:', createError.code);
        console.error('[Setup] Error message:', createError.message);
        throw createError; // Re-throw to be caught by outer catch
      }

      // Create clipper-approval channel
      console.log('[Setup] Creating clipper-approval channel...');
      const approvalChannel = await guild.channels.create({
        name: 'clipper-approval',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: client.user!.id, // Bot - allow everything
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: interaction.user.id, // Admin user
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
      console.log('[Setup] Approval channel created:', approvalChannel.id);

      // Create content-review channel
      console.log('[Setup] Creating content-review channel...');
      const reviewChannel = await guild.channels.create({
        name: 'content-review',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: client.user!.id, // Bot - allow everything
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: interaction.user.id, // Admin user
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
      console.log('[Setup] Review channel created:', reviewChannel.id);

      // Store in database
      console.log('[Setup] Saving to database...');
      // @ts-ignore - discordGuild exists in schema but may not be in generated types yet
      await (prisma as any).discordGuild.upsert({
        where: { guildId: interaction.guildId },
        update: {
          adminCategoryId: category.id,
          clipperApprovalChannelId: approvalChannel.id,
          contentReviewChannelId: reviewChannel.id,
        },
        create: {
          guildId: interaction.guildId,
          adminCategoryId: category.id,
          clipperApprovalChannelId: approvalChannel.id,
          contentReviewChannelId: reviewChannel.id,
        },
      });
      console.log('[Setup] Database updated');

      return interaction.editReply({
        content: `✅ **Setup Complete!**\n\nCreated:\n- Category: ${category.name}\n- Clipper Approval: ${approvalChannel}\n- Content Review: ${reviewChannel}\n\nYour account has been automatically linked as an admin.`,
      });
    } catch (error) {
      console.error('[Setup] Error details:', error);
      console.error('[Setup] Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      let errorMessage = '❌ Failed to set up channels.';
      
      if (error instanceof Error) {
        // Check for Discord API error codes
        const errorStr = JSON.stringify(error);
        const errorMsg = error.message;
        
        console.error('[Setup] Full error:', errorStr);
        console.error('[Setup] Error message:', errorMsg);
        
        if (errorMsg.includes('Missing Permissions') || errorMsg.includes('Missing Access') || errorStr.includes('50013')) {
          errorMessage += '\n\n**Permission Issue Detected**\n\nPlease check:\n1. Bot role has "Manage Channels" permission enabled\n2. Bot role is positioned HIGHER than other roles in Server Settings → Roles\n3. The bot role is above any roles that might restrict channel creation\n4. Try moving the bot role to the top of the role list';
        } else if (errorMsg.includes('rate limit') || errorStr.includes('429')) {
          errorMessage += '\n\nRate limited. Please wait a moment and try again.';
        } else if (errorMsg.includes('Invalid Form Body') || errorStr.includes('50035')) {
          errorMessage += '\n\nInvalid channel configuration. This might be a Discord API issue.';
        } else {
          errorMessage += `\n\n**Error Details:**\n\`\`\`${errorMsg}\`\`\`\n\nCheck server console for full error details.`;
        }
      } else {
        errorMessage += `\n\n**Unknown Error:**\n\`\`\`${JSON.stringify(error)}\`\`\``;
      }
      
      return interaction.editReply({
        content: errorMessage,
      });
    }
  },
};

// Handle button interactions
client.on('interactionCreate', async (interaction: any) => {
  if (interaction.isButton()) {
    try {
      if (interaction.customId.startsWith('check_verify_')) {
        // Handle check verification button
        await interaction.deferReply({ ephemeral: true });
        
        const accountId = interaction.customId.replace('check_verify_', '');
        const userId = await getUserIdFromDiscord(interaction.user.id);
        
        if (!userId) {
          return interaction.editReply({
            content: '❌ You need to link your Discord account first. Use `/link <email>` to link your account.',
          });
        }

        if (!interaction.guildId) {
          return interaction.editReply({
            content: '❌ This must be used in a server.',
          });
        }

        try {
          const prisma = getPrismaClient();
          const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

          // Find the account
          const account = await prisma.socialAccount.findFirst({
            where: {
              id: accountId,
              userId,
            },
          });

          if (!account) {
            return interaction.editReply({
              content: '❌ Account not found. Please start verification again with `/verify`.',
            });
          }

          // Verify the account
          const verifyResponse = await fetch(`${baseUrl}/api/social-accounts/${accountId}/verify`, {
            method: 'POST',
            headers: {
              'x-user-id': userId,
              'x-user-role': 'CLIPPER',
            },
          });

          const verifyData = await verifyResponse.json() as any;

          // Extract status from response (API returns socialAccount.status)
          const status = verifyData.socialAccount?.status || verifyData.status || 'PENDING';
          const isVerified = status === 'VERIFIED';
          const errorMessage = verifyData.message || verifyData.error || '';

          console.log('[Discord Bot] Verification response:', {
            ok: verifyResponse.ok,
            status,
            isVerified,
            errorMessage,
            verifyData,
          });

          // If verified, store Discord username and ID
          if (isVerified && userId) {
            try {
              // Update user's discordId and discordUsername
              const discordUsername = interaction.user.username || interaction.user.tag || null;
              const user = await prisma.user.findUnique({ where: { id: userId } }) as any;
              
              const updateData: any = {};
              if (!user.discordId) {
                updateData.discordId = interaction.user.id;
              }
              if (!user.discordUsername || user.discordUsername !== discordUsername) {
                updateData.discordUsername = discordUsername;
              }
              
              if (Object.keys(updateData).length > 0) {
                await prisma.user.update({
                  where: { id: userId },
                  data: updateData,
                });
                console.log(`[Discord Bot] Updated user ${userId} with Discord info: ${discordUsername} (${interaction.user.id})`);
              }
            } catch (error) {
              console.error('[Discord Bot] Error updating Discord info:', error);
            }
          }

          // If verified, automatically add user to active campaigns and link existing submissions
          if (isVerified) {
            try {
              const now = new Date();
              // Get all active campaigns
              const activeCampaigns = await prisma.campaign.findMany({
                where: {
                  status: 'ACTIVE',
                  campaignType: 'PUBLIC', // Only auto-join public campaigns
                  OR: [
                    { startDate: null },
                    { startDate: { lte: now } },
                  ],
                  AND: [
                    { OR: [
                      { endDate: null },
                      { endDate: { gte: now } },
                    ]},
                  ],
                },
                select: { id: true, name: true, acceptedPlatforms: true },
              });

              for (const campaign of activeCampaigns) {
                // Check if platform is allowed (if restrictions exist)
                let canJoin = true;
                if (campaign.acceptedPlatforms) {
                  const acceptedPlatforms = typeof campaign.acceptedPlatforms === 'string' 
                    ? JSON.parse(campaign.acceptedPlatforms) 
                    : campaign.acceptedPlatforms;
                  
                  if (Array.isArray(acceptedPlatforms) && !acceptedPlatforms.includes(account.platform)) {
                    canJoin = false;
                  }
                }

                if (canJoin) {
                  // Check if already a member
                  const existing = await prisma.campaignMember.findUnique({
                    where: {
                      userId_campaignId: {
                        userId,
                        campaignId: campaign.id,
                      },
                    },
                  });

                  if (!existing) {
                    // Auto-join the campaign
                    await prisma.campaignMember.create({
                      data: {
                        userId,
                        campaignId: campaign.id,
                      },
                    });
                    console.log(`[Auto-Join] Added user ${userId} to campaign ${campaign.name}`);

                    // Link existing submissions without campaignId to this campaign
                    await prisma.submission.updateMany({
                      where: {
                        userId,
                        campaignId: null,
                        platform: account.platform,
                        status: { in: ['PENDING', 'APPROVED'] },
                      },
                      data: {
                        campaignId: campaign.id,
                      },
                    });
                  }
                }
              }
            } catch (autoJoinError) {
              console.error('[Auto-Join] Error auto-joining campaigns:', autoJoinError);
              // Don't fail verification if auto-join fails
            }
          }

          // Get guild config and update message
          const guildConfig = await getGuildConfig(interaction.guildId);
          const approvalChannelId = guildConfig.clipperApprovalChannelId;

          const accountAny = account as any;
          if (approvalChannelId && accountAny.discordMessageId) {
            try {
              const approvalChannel = await client.channels.fetch(approvalChannelId);
              if (approvalChannel && approvalChannel.type === ChannelType.GuildText) {
                const message = await approvalChannel.messages.fetch(accountAny.discordMessageId);
                
                const newEmbed = new EmbedBuilder()
                  .setColor(isVerified ? 0x00ff00 : 0xffa500)
                  .setTitle(isVerified ? '✅ Verified' : '⏳ Still Pending')
                  .setDescription(`User ${interaction.user} verification ${isVerified ? 'succeeded' : 'is still pending'}`)
                  .addFields(
                    { name: 'Platform', value: account.platform, inline: true },
                    { name: 'Handle', value: account.handle, inline: true },
                    { name: 'Status', value: isVerified ? '✅ VERIFIED' : '⏳ PENDING', inline: true },
                  )
                  .setTimestamp();

                // Remove button if verified, keep it if still pending
                const components = isVerified ? [] : [message.components[0] || new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`check_verify_${accountId}`)
                    .setLabel('✅ Check Verification')
                    .setStyle(ButtonStyle.Primary)
                )];

                await message.edit({
                  embeds: [newEmbed],
                  components: components.length > 0 ? components : [],
                });
              }
            } catch (error) {
              console.error('Error updating verification message:', error);
            }
          }

          if (verifyResponse.ok && isVerified) {
            // Assign Clipper role if in a guild
            if (interaction.guildId) {
              try {
                await assignClipperRole(interaction.guildId, interaction.user.id);
              } catch (roleError) {
                console.error('[Verification] Error assigning role:', roleError);
                // Continue even if role assignment fails
              }
            }

            return interaction.editReply({
              content: `✅ **Account Verified!** Your ${account.platform} account has been successfully verified. You've been assigned the Clipper role!`,
            });
          } else {
            // Show more helpful error message
            const platformName = account.platform === 'YOUTUBE' ? 'YouTube' : account.platform === 'TIKTOK' ? 'TikTok' : 'Instagram';
            const location = account.platform === 'YOUTUBE' ? 'channel description' : 'bio';
            
            let message = `⏳ **Still Pending**\n\n`;
            if (errorMessage) {
              message += `${errorMessage}\n\n`;
            } else {
              message += `Verification code not found yet.\n\n`;
            }
            message += `**Make sure you:**\n`;
            message += `1. Added the code \`${account.verificationCode}\` to your ${platformName} ${location}\n`;
            message += `2. Saved the changes\n`;
            message += `3. Wait a few seconds for changes to update\n`;
            message += `4. Click the button again to check`;
            
            return interaction.editReply({
              content: message,
            });
          }
        } catch (error) {
          console.error('Error checking verification:', error);
          return interaction.editReply({
            content: '❌ Failed to check verification. Please try again later.',
          });
        }
      } else if (interaction.customId.startsWith('verify_override_')) {
        const accountId = interaction.customId.replace('verify_override_', '');
        // Admin override verification
        const prisma = getPrismaClient();
        const account = await prisma.socialAccount.findUnique({
          where: { id: accountId },
          select: { userId: true, platform: true },
        });

        if (!account) {
          return interaction.reply({ content: '❌ Account not found.', ephemeral: true });
        }

        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: 'VERIFIED', verifiedAt: new Date() },
        });

        // Auto-join user to active campaigns and link existing submissions
        try {
          const now = new Date();
          // Get all active campaigns
          const activeCampaigns = await prisma.campaign.findMany({
            where: {
              status: 'ACTIVE',
              campaignType: 'PUBLIC', // Only auto-join public campaigns
              OR: [
                { startDate: null },
                { startDate: { lte: now } },
              ],
              AND: [
                { OR: [
                  { endDate: null },
                  { endDate: { gte: now } },
                ]},
              ],
            },
            select: { id: true, name: true, acceptedPlatforms: true },
          });

          for (const campaign of activeCampaigns) {
            // Check if platform is allowed (if restrictions exist)
            let canJoin = true;
            if (campaign.acceptedPlatforms) {
              const acceptedPlatforms = typeof campaign.acceptedPlatforms === 'string' 
                ? JSON.parse(campaign.acceptedPlatforms) 
                : campaign.acceptedPlatforms;
              
              if (Array.isArray(acceptedPlatforms) && !acceptedPlatforms.includes(account.platform)) {
                canJoin = false;
              }
            }

            if (canJoin) {
              // Check if already a member
              const existing = await prisma.campaignMember.findUnique({
                where: {
                  userId_campaignId: {
                    userId: account.userId,
                    campaignId: campaign.id,
                  },
                },
              });

              if (!existing) {
                // Auto-join the campaign
                await prisma.campaignMember.create({
                  data: {
                    userId: account.userId,
                    campaignId: campaign.id,
                  },
                });
                console.log(`[Auto-Join] Added user ${account.userId} to campaign ${campaign.name}`);

                // Link existing submissions without campaignId to this campaign
                await prisma.submission.updateMany({
                  where: {
                    userId: account.userId,
                    campaignId: null,
                    platform: account.platform,
                    status: { in: ['PENDING', 'APPROVED'] },
                  },
                  data: {
                    campaignId: campaign.id,
                  },
                });
              }
            }
          }
        } catch (autoJoinError) {
          console.error('[Auto-Join] Error auto-joining campaigns:', autoJoinError);
          // Don't fail verification if auto-join fails
        }

        // Assign Clipper role if in a guild
        if (interaction.guildId) {
          try {
            await assignClipperRole(interaction.guildId, interaction.user.id);
          } catch (roleError) {
            console.error('[Verification] Error assigning role:', roleError);
          }
        }

        await interaction.reply({ content: '✅ Verification manually approved.', ephemeral: true });
        await interaction.message.edit({ components: [] });
      } else if (interaction.customId.startsWith('delete_campaign_')) {
        try {
          // Immediately disable the button and update message to show it's being deleted
          const campaignId = interaction.customId.replace('delete_campaign_', '');
          
          // Extract campaign name from button label for immediate feedback
          let campaignName = 'Campaign';
          if (interaction.message.components) {
            for (const row of interaction.message.components) {
              if ('components' in row && Array.isArray(row.components)) {
                for (const component of row.components) {
                  if (component.type === 2 && 'customId' in component && component.customId === interaction.customId) {
                    const buttonLabel = (component as any).label || '';
                    campaignName = buttonLabel.replace('🗑️ ', '').trim() || 'Campaign';
                    break;
                  }
                }
              }
            }
          }
          
          // Immediately remove the button from the message
          try {
            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            for (const row of interaction.message.components) {
              const newRow = new ActionRowBuilder<ButtonBuilder>();
              if ('components' in row && Array.isArray(row.components)) {
                for (const component of row.components) {
                  if (component.type === 2 && 'customId' in component && component.customId !== interaction.customId) {
                    newRow.addComponents(ButtonBuilder.from(component as any));
                  }
                }
              }
              if (newRow.components.length > 0) {
                components.push(newRow);
              }
            }
            
            // Update message immediately to remove the button
            await interaction.message.edit({ 
              components: components.length > 0 ? components : [],
            });
          } catch (editError) {
            console.error('[Delete Campaign] Error removing button immediately:', editError);
          }
          
          // Defer reply for the confirmation message
          await interaction.deferReply({ ephemeral: true });
          
          console.log(`[Delete Campaign] Attempting to delete campaign with ID: ${campaignId}`);
          
          // Check if user is admin
          const userId = await getUserIdFromDiscord(interaction.user.id);
          if (!userId) {
            return interaction.editReply({ 
              content: '❌ You need to link your Discord account first.',
            });
          }

          const prisma = getPrismaClient();
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });

          if (user?.role !== 'ADMIN') {
            return interaction.editReply({ 
              content: '❌ Only admins can delete campaigns.',
            });
          }

          // Get campaign info before deleting - try by ID first, then by name from button label
          let campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { id: true, name: true, status: true, _count: { select: { submissions: true, members: true } } },
          });

          // If not found by ID, try to find by name
          if (!campaign && campaignName && campaignName !== 'Campaign') {
            console.log(`[Delete Campaign] Campaign not found by ID, trying to find by name: ${campaignName}`);
            campaign = await prisma.campaign.findFirst({
              where: { name: campaignName },
              select: { id: true, name: true, status: true, _count: { select: { submissions: true, members: true } } },
            });
            if (campaign) {
              console.log(`[Delete Campaign] Found campaign by name: ${campaign.name} (ID: ${campaign.id})`);
            }
          }

          if (!campaign) {
            console.error(`[Delete Campaign] Campaign not found. ID: ${campaignId}, Name: ${campaignName}`);
            return interaction.editReply({ 
              content: `❌ Campaign not found.\n\nPlease try using \`/check-campaigns\` again to refresh the list.`,
            });
          }

          // Delete the campaign (cascade will handle related records)
          await prisma.campaign.delete({
            where: { id: campaign.id },
          });
          
          console.log(`[Delete Campaign] Successfully deleted campaign: ${campaign.name} (ID: ${campaign.id})`);

          // Update embed to show deletion confirmation
          try {
            const embed = interaction.message.embeds[0];
            if (embed) {
              const newEmbed = EmbedBuilder.from(embed);
              
              // Update description to show deleted campaign
              const currentDescription = embed.description || '';
              const deletedNote = `✅ **${campaign.name}** has been deleted.\n\n`;
              newEmbed.setDescription(deletedNote + currentDescription);
              
              await interaction.message.edit({ 
                embeds: [newEmbed],
              });
            }
          } catch (editError) {
            console.error('[Delete Campaign] Error updating embed:', editError);
            // Continue even if embed update fails
          }

          return interaction.editReply({ 
            content: `✅ Campaign **${campaign.name}** has been deleted successfully.`,
          });
        } catch (error: any) {
          console.error('[Delete Campaign] Error:', error);
          const errorMessage = error?.message || 'Unknown error occurred';
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ 
              content: `❌ Failed to delete campaign: ${errorMessage}`,
            });
          } else {
            return interaction.reply({ 
              content: `❌ Failed to delete campaign: ${errorMessage}`,
              ephemeral: true,
            });
          }
        }
      } else if (interaction.customId.startsWith('verify_reject_')) {
        const accountId = interaction.customId.replace('verify_reject_', '');
        const prisma = getPrismaClient();
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: 'FAILED' },
        });

        await interaction.reply({ content: '❌ Verification rejected.', ephemeral: true });
        await interaction.message.edit({ components: [] });
      } else if (interaction.customId.startsWith('approve_')) {
        const submissionId = interaction.customId.replace('approve_', '');
        const userId = await getUserIdFromDiscord(interaction.user.id);
        
        if (!userId) {
          return interaction.reply({ content: '❌ You need to link your account first.', ephemeral: true });
        }

        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
          return interaction.reply({ content: '❌ Only admins can approve submissions.', ephemeral: true });
        }

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const response = await fetch(`${baseUrl}/admin/submissions/${submissionId}/approve`, {
          method: 'POST',
          headers: {
            'x-user-id': userId,
            'x-user-role': 'ADMIN',
          },
        });

        if (response.ok) {
          await interaction.reply({ content: '✅ Submission approved.', ephemeral: true });
          // Update message embed
          const embed = interaction.message.embeds[0];
          if (embed) {
            const newEmbed = EmbedBuilder.from(embed)
              .setColor(0x00ff00)
              .setFields(
                ...embed.fields.map((f: any) => f.name === 'Status' ? { ...f, value: '✅ APPROVED' } : f)
              );
            await interaction.message.edit({ embeds: [newEmbed], components: [] });
          }
        }
      } else if (interaction.customId.startsWith('reject_')) {
        const submissionId = interaction.customId.replace('reject_', '');
        const userId = await getUserIdFromDiscord(interaction.user.id);
        
        if (!userId) {
          return interaction.reply({ content: '❌ You need to link your account first.', ephemeral: true });
        }

        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
          return interaction.reply({ content: '❌ Only admins can reject submissions.', ephemeral: true });
        }

        // For now, reject without reason (could add modal for reason)
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const response = await fetch(`${baseUrl}/admin/submissions/${submissionId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-role': 'ADMIN',
          },
          body: JSON.stringify({ reason: 'Rejected via Discord' }),
        });

        if (response.ok) {
          await interaction.reply({ content: '❌ Submission rejected.', ephemeral: true });
          const embed = interaction.message.embeds[0];
          if (embed) {
            const newEmbed = EmbedBuilder.from(embed)
              .setColor(0xff0000)
              .setFields(
                ...embed.fields.map((f: any) => f.name === 'Status' ? { ...f, value: '❌ REJECTED' } : f)
              );
            await interaction.message.edit({ embeds: [newEmbed], components: [] });
          }
        }
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      }
    }
  }
});

// Handle modal submissions
client.on('interactionCreate', async (interaction: any) => {
  if (interaction.isModalSubmit()) {
    try {
      const customId = interaction.customId;

      if (customId.startsWith('campaign_edit_')) {
        const campaignId = customId.replace('campaign_edit_', '');
        const userId = await getUserIdFromDiscord(interaction.user.id);

        if (!userId) {
          return interaction.reply({
            content: '❌ You need to link your Discord account first.',
            ephemeral: true,
          });
        }

        // Check if user is admin
        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
          return interaction.reply({
            content: '❌ Only admins can edit campaigns.',
            ephemeral: true,
          });
        }

        // Get form values
        const datesStr = interaction.fields.getTextInputValue('dates');
        // Parse combined dates format: "MM/DD/YYYY - MM/DD/YYYY"
        const datesMatch = datesStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/);
        if (!datesMatch) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use: MM/DD/YYYY - MM/DD/YYYY (e.g., 03/15/2024 - 04/15/2024)',
            ephemeral: true,
          });
        }
        const startDateStr = datesMatch[1].trim();
        const endDateStr = datesMatch[2].trim();
        const minViewsStr = interaction.fields.getTextInputValue('min_views');
        const paymentPerMillionStr = interaction.fields.getTextInputValue('payment_per_million');
        const totalBudgetStr = interaction.fields.getTextInputValue('total_budget');
        const platformsStr = interaction.fields.getTextInputValue('platforms') || '';

        // Parse dates (MM/DD/YYYY)
        const parseDate = (dateStr: string): Date => {
          const [month, day, year] = dateStr.split('/').map(Number);
          return new Date(year, month - 1, day);
        };

        let startDate: Date;
        let endDate: Date;
        try {
          startDate = parseDate(startDateStr);
          endDate = parseDate(endDateStr);
        } catch (error) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use MM/DD/YYYY (e.g., 03/15/2024)',
            ephemeral: true,
          });
        }

        // Parse numbers
        const minViews = parseInt(minViewsStr, 10);
        const paymentPerMillion = parseFloat(paymentPerMillionStr);
        const totalBudget = parseFloat(totalBudgetStr);

        if (isNaN(minViews) || isNaN(paymentPerMillion) || isNaN(totalBudget)) {
          return interaction.reply({
            content: '❌ Invalid number format. Please enter valid numbers.',
            ephemeral: true,
          });
        }

        // Parse platforms (comma-separated, uppercase)
        let acceptedPlatforms: string[] | null = null;
        if (platformsStr.trim()) {
          const platformList = platformsStr
            .split(',')
            .map((p: string) => p.trim().toUpperCase())
            .filter((p: string) => p.length > 0);
          
          // Validate platform names
          const validPlatforms = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'SNAPCHAT', 'TWITCH', 'KICK'];
          const invalidPlatforms = platformList.filter((p: string) => !validPlatforms.includes(p));
          
          if (invalidPlatforms.length > 0) {
            return interaction.reply({
              content: `❌ Invalid platform(s): ${invalidPlatforms.join(', ')}\n\nValid platforms: ${validPlatforms.join(', ')}`,
              ephemeral: true,
            });
          }
          
          acceptedPlatforms = platformList;
        }

        // Update campaign via API
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-role': 'ADMIN',
          },
          body: JSON.stringify({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            minViewsPerClip: minViews,
            payoutPerLink: paymentPerMillion / 1000000, // Convert per million to per view
            totalBudget: totalBudget,
            acceptedPlatforms: acceptedPlatforms, // Array of platform names
          }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          return interaction.reply({
            content: `❌ **Failed to update campaign:** ${data.message || data.error || 'Unknown error'}`,
            ephemeral: true,
          });
        }

        const campaign = data.campaign || data;

        // Reply to user
        let replyContent = `✅ **Campaign Updated!**\n\n**Name:** ${campaign.name || 'N/A'}\n**Start Date:** ${startDateStr}\n**End Date:** ${endDateStr}\n**Min Views:** ${minViews.toLocaleString()}\n**Payment per Million:** $${paymentPerMillion.toLocaleString()}\n**Total Budget:** $${totalBudget.toLocaleString()}`;
        
        if (acceptedPlatforms && acceptedPlatforms.length > 0) {
          replyContent += `\n**Accepted Platforms:** ${acceptedPlatforms.join(', ')}`;
        } else {
          replyContent += `\n**Accepted Platforms:** All platforms`;
        }

        return interaction.reply({
          content: replyContent,
          ephemeral: true,
        });
      } else if (customId.startsWith('campaign_create_')) {
        const campaignName = customId.replace('campaign_create_', '');
        const userId = await getUserIdFromDiscord(interaction.user.id);

        if (!userId) {
          return interaction.reply({
            content: '❌ You need to link your Discord account first.',
            ephemeral: true,
          });
        }

        // Check if user is admin
        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
          return interaction.reply({
            content: '❌ Only admins can create campaigns.',
            ephemeral: true,
          });
        }

        // Get form values
        const datesStr = interaction.fields.getTextInputValue('dates');
        const minViewsStr = interaction.fields.getTextInputValue('min_views');
        const paymentPerMillionStr = interaction.fields.getTextInputValue('payment_per_million');
        const totalBudgetStr = interaction.fields.getTextInputValue('total_budget');
        const platformsStr = interaction.fields.getTextInputValue('platforms') || '';

        // Parse combined dates format: "MM/DD/YYYY - MM/DD/YYYY"
        const datesMatch = datesStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/);
        if (!datesMatch) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use: MM/DD/YYYY - MM/DD/YYYY (e.g., 03/15/2024 - 04/15/2024)',
            ephemeral: true,
          });
        }
        const startDateStr = datesMatch[1].trim();
        const endDateStr = datesMatch[2].trim();

        // Parse dates (MM/DD/YYYY)
        const parseDate = (dateStr: string): Date => {
          const [month, day, year] = dateStr.split('/').map(Number);
          return new Date(year, month - 1, day);
        };

        let startDate: Date;
        let endDate: Date;
        try {
          startDate = parseDate(startDateStr);
          endDate = parseDate(endDateStr);
        } catch (error) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use MM/DD/YYYY (e.g., 03/15/2024)',
            ephemeral: true,
          });
        }

        // Parse numbers
        const minViews = parseInt(minViewsStr, 10);
        const paymentPerMillion = parseFloat(paymentPerMillionStr);
        const totalBudget = parseFloat(totalBudgetStr);

        if (isNaN(minViews) || isNaN(paymentPerMillion) || isNaN(totalBudget)) {
          return interaction.reply({
            content: '❌ Invalid number format. Please enter valid numbers.',
            ephemeral: true,
          });
        }

        // Parse platforms (comma-separated, uppercase)
        let acceptedPlatforms: string[] | null = null;
        if (platformsStr.trim()) {
          const platformList = platformsStr
            .split(',')
            .map((p: string) => p.trim().toUpperCase())
            .filter((p: string) => p.length > 0);
          
          // Validate platform names
          const validPlatforms = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'SNAPCHAT', 'TWITCH', 'KICK'];
          const invalidPlatforms = platformList.filter((p: string) => !validPlatforms.includes(p));
          
          if (invalidPlatforms.length > 0) {
            return interaction.reply({
              content: `❌ Invalid platform(s): ${invalidPlatforms.join(', ')}\n\nValid platforms: ${validPlatforms.join(', ')}`,
              ephemeral: true,
            });
          }
          
          acceptedPlatforms = platformList;
        }

        // Check for existing active campaigns before creating
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        const checkResponse = await fetch(`${baseUrl}/api/campaigns`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-role': 'ADMIN',
          },
        });

        let existingActiveCampaigns: any[] = [];
        if (checkResponse.ok) {
          const checkData = await checkResponse.json() as any;
          existingActiveCampaigns = checkData.campaigns || [];
        }

        // Create campaign via API (the API will automatically pause existing active campaigns)
        const response = await fetch(`${baseUrl}/api/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
            'x-user-role': 'ADMIN',
          },
          body: JSON.stringify({
            name: campaignName,
            companyName: campaignName, // Use name as company name for now
            shortDescription: `Campaign: ${campaignName}`,
            description: `Campaign created via Discord: ${campaignName}`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            minViewsPerClip: minViews,
            payoutPerLink: paymentPerMillion / 1000000, // Convert per million to per view
            totalBudget: totalBudget,
            acceptedPlatforms: acceptedPlatforms, // Array of platform names
            status: 'ACTIVE',
            campaignType: 'PUBLIC',
          }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          return interaction.reply({
            content: `❌ **Failed to create campaign:** ${data.message || data.error || 'Unknown error'}`,
            ephemeral: true,
          });
        }

        const campaign = data.campaign || data;

        // Notify if existing campaigns were paused
        if (existingActiveCampaigns.length > 0) {
          const pausedNames = existingActiveCampaigns.map((c: any) => c.name).join(', ');
          console.log(`[Campaign Create] Paused ${existingActiveCampaigns.length} existing active campaign(s): ${pausedNames}`);
        }

        // Create campaign channel and post announcement
        let channelCreated = false;
        let channelLink = '';
        
        if (interaction.guildId) {
          try {
            const guild = await client.guilds.fetch(interaction.guildId);
            
            // Sanitize campaign name for channel name (lowercase, replace spaces with hyphens, remove special chars)
            const channelName = `campaign-${campaignName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50)}`;
            
            // Create channel visible to everyone
            const campaignChannel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              permissionOverwrites: [
                {
                  id: guild.id, // @everyone - allow viewing
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                  ],
                },
                {
                  id: client.user!.id, // Bot - allow everything
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks,
                  ],
                },
              ],
            });

            channelCreated = true;
            channelLink = `<#${campaignChannel.id}>`;

            // Format dates for display
            const formatDate = (date: Date): string => {
              return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            };

            // Create announcement embed
            const announcementEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('🎯 New Campaign Started!')
              .setDescription(`${campaignName} has begun in ${guild.name}!`)
              .addFields(
                { name: 'Start Date', value: formatDate(startDate), inline: true },
                { name: 'End Date', value: formatDate(endDate), inline: true },
                { name: 'Minimum Views Required', value: minViews.toLocaleString(), inline: false },
                { name: 'Payment', value: `$${paymentPerMillion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per million views`, inline: false },
                { name: 'Total Budget', value: `$${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: false },
              );

            // Add enabled platforms (default to all if not specified)
            const platforms = campaign.acceptedPlatforms 
              ? (typeof campaign.acceptedPlatforms === 'string' ? JSON.parse(campaign.acceptedPlatforms) : campaign.acceptedPlatforms)
              : ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'SNAPCHAT'];
            
            const platformIcons: Record<string, string> = {
              'TIKTOK': '🎵',
              'INSTAGRAM': '📷',
              'YOUTUBE': '▶️',
              'TWITTER': '🐦',
              'SNAPCHAT': '👻',
            };

            const platformList = platforms.map((p: string) => {
              const icon = platformIcons[p] || '📱';
              return `${icon} ${p.charAt(0) + p.slice(1).toLowerCase()}`;
            }).join('\n');

            announcementEmbed.addFields({
              name: 'Enabled Platforms',
              value: platformList,
              inline: false,
            });

            // Add participation instructions
            announcementEmbed.addFields({
              name: 'How to Participate',
              value: `1. Join the server using the invite link below
2. Register as a clipper if you haven't already (\`/verify\`)
3. Submit content using \`/submit-clip\`
4. Track your stats with \`/leaderboard\``,
              inline: false,
            });

            // Add join server link if campaign has one
            if (campaign.discordInviteLink) {
              announcementEmbed.addFields({
                name: 'Join Server',
                value: `[Click here to join ${guild.name}](${campaign.discordInviteLink})`,
                inline: false,
              });
            }

            announcementEmbed.setTimestamp();

            // Post announcement to the channel
            await campaignChannel.send({ embeds: [announcementEmbed] });

            // Update campaign with channel ID in the database
            // @ts-ignore - discordChannelId exists in schema but may not be in generated types yet
            await (prisma.campaign as any).update({
              where: { id: campaign.id },
              data: { discordChannelId: campaignChannel.id },
            });
          } catch (channelError) {
            console.error('Error creating campaign channel:', channelError);
            // Continue even if channel creation fails
          }
        }

        // Reply to user
        let replyContent = `✅ **Campaign Created!**\n\n**Campaign ID:** \`${campaign.id}\`\n**Name:** ${campaignName}\n**Start Date:** ${startDateStr}\n**End Date:** ${endDateStr}\n**Min Views:** ${minViews.toLocaleString()}\n**Payment per Million:** $${paymentPerMillion.toLocaleString()}\n**Total Budget:** $${totalBudget.toLocaleString()}`;
        
        if (acceptedPlatforms && acceptedPlatforms.length > 0) {
          replyContent += `\n**Accepted Platforms:** ${acceptedPlatforms.join(', ')}`;
        } else {
          replyContent += `\n**Accepted Platforms:** All platforms`;
        }
        
        if (channelCreated && channelLink) {
          replyContent += `\n\n**Campaign Channel:** ${channelLink}`;
        }
        
        replyContent += `\n\n**Dashboard URL:** https://clipping-tracking-api-production-4f77.up.railway.app/campaign-dashboard?id=${campaign.id}`;

        return interaction.reply({
          content: replyContent,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Error handling modal submission:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      }
    }
  }
});

// Register slash commands
export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

  const commandsData = [
    // Clipper commands
    new SlashCommandBuilder()
      .setName('start')
      .setDescription('Get started with the bot - shows how to operate it'),

    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Verify a social media account')
      .addStringOption((option: any) =>
        option.setName('platform')
          .setDescription('Platform to verify')
          .setRequired(true)
          .addChoices(
            { name: 'YouTube', value: 'youtube' },
            { name: 'TikTok', value: 'tiktok' },
            { name: 'Instagram', value: 'instagram' },
          ))
      .addStringOption((option: any) =>
        option.setName('username')
          .setDescription('Your handle (e.g., @channelname)')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('verify-confirm')
      .setDescription('Confirm your account verification')
      .addStringOption((option: any) =>
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
      .addStringOption((option: any) =>
        option.setName('url')
          .setDescription('URL of the content to submit')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View top clippers leaderboard')
      .addStringOption((option: any) =>
        option.setName('campaign')
          .setDescription('Campaign name (optional, shows most recent active campaign if not specified)')
          .setRequired(false))
      .addIntegerOption((option: any) =>
        option.setName('page')
          .setDescription('Page number')
          .setMinValue(1)),

    new SlashCommandBuilder()
      .setName('clipper-stats')
      .setDescription('View your personal clipper statistics'),

    // Admin commands
    new SlashCommandBuilder()
      .setName('admin-campaign')
      .setDescription('Manage campaigns (Admin only)')
      .addStringOption((option: any) =>
        option.setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'Create', value: 'create' },
            { name: 'Edit', value: 'edit' },
            { name: 'Delete', value: 'delete' },
          ))
      .addStringOption((option: any) =>
        option.setName('name')
          .setDescription('Campaign name (required for create)')
          .setRequired(false)),

    new SlashCommandBuilder()
      .setName('check-campaigns')
      .setDescription('Check all campaign statuses (Admin only)'),

    new SlashCommandBuilder()
      .setName('admin-campaign-stats')
      .setDescription('View campaign statistics (Admin only)')
      .addStringOption((option: any) =>
        option.setName('campaign')
          .setDescription('Campaign name (optional, shows all if not specified)')
          .setRequired(false)),

    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Set up Discord channels (Admin only)'),
  ];

  try {
    console.log('Started refreshing application (/) commands.');

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const guildId = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands

    if (guildId) {
      // Register guild commands (instant)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData },
      );
      console.log(`Successfully registered ${commandsData.length} guild commands.`);
      
      // Clear global commands to prevent duplicates
      try {
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: [] },
        );
        console.log('✅ Cleared global commands to prevent duplicates.');
      } catch (clearError: any) {
        console.warn('⚠️ Could not clear global commands (this is okay if none exist):', clearError.message);
      }
    } else {
      // Register global commands
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData },
      );
      console.log(`Successfully registered ${commandsData.length} global commands.`);
      console.log('⚠️  Global commands can take up to 1 hour to appear in Discord.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Handle command interactions
client.on('interactionCreate', async (interaction: any) => {
  console.log('[Discord Bot] Interaction received, type:', interaction.type, 'isChatInputCommand:', interaction.isChatInputCommand());
  
  if (!interaction.isChatInputCommand()) {
    console.log('[Discord Bot] Not a chat input command, ignoring');
    return;
  }

  const commandName = interaction.commandName;
  console.log(`[Discord Bot] Received command: ${commandName} from user ${interaction.user.id} in guild ${interaction.guildId}`);
  
  // Map kebab-case command names to camelCase handler names
  const commandNameMap: Record<string, string> = {
    'submit-clip': 'submitClip',
    'verify-confirm': 'verifyConfirm',
    'admin-campaign': 'adminCampaign',
    'admin-campaign-stats': 'adminCampaignStats',
    'clipper-stats': 'clipperStats',
    'check-campaigns': 'checkActiveCampaigns',
  };
  
  const handlerName = commandNameMap[commandName] || commandName;
  const handler = (commands as any)[handlerName];
  
  if (!handler) {
    console.warn(`[Discord Bot] No handler found for command: ${commandName} (mapped to: ${handlerName})`);
  } else {
    console.log(`[Discord Bot] Handler found for ${commandName} (mapped to: ${handlerName}), executing...`);
  }

  if (handler) {
    try {
      await handler(interaction);
    } catch (error) {
      console.error(`[Discord Bot] Error handling command ${commandName}:`, error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ An error occurred while processing your command.' });
        } else {
          await interaction.reply({ content: '❌ An error occurred while processing your command.', ephemeral: true });
        }
      } catch (replyError) {
        console.error('[Discord Bot] Failed to send error message:', replyError);
      }
    }
  } else {
    console.warn(`[Discord Bot] Unknown command: ${commandName}`);
    try {
      await interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
    } catch (error) {
      console.error('[Discord Bot] Failed to reply to unknown command:', error);
    }
  }
});

// Initialize bot
export async function initializeDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.warn('⚠️ DISCORD_BOT_TOKEN not set - Discord bot disabled');
    return null;
  }

  if (!process.env.DISCORD_CLIENT_ID) {
    console.warn('⚠️ DISCORD_CLIENT_ID not set - Discord bot disabled');
    return null;
  }

  try {
    await registerCommands();
    
    // Add ready event listener
    client.once('ready', () => {
      console.log(`✅ Discord bot is ready! Logged in as ${client.user?.tag}`);
      console.log(`   Bot ID: ${client.user?.id}`);
      console.log(`   Servers: ${client.guilds.cache.size}`);
    });

    // Add error handlers
    client.on('error', (error: any) => {
      console.error('[Discord Bot] Client error:', error);
    });

    client.on('warn', (warning: any) => {
      console.warn('[Discord Bot] Warning:', warning);
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('✅ Discord bot logged in successfully');

    // Start daily campaign status scheduler
    try {
      const { startCampaignStatusScheduler } = await import('./campaignStatusScheduler');
      startCampaignStatusScheduler(client);
      console.log('✅ Campaign status scheduler started');
    } catch (error: any) {
      console.warn('⚠️ Failed to start campaign status scheduler:', error.message);
    }

    return client;
  } catch (error) {
    console.error('❌ Failed to initialize Discord bot:', error);
    return null;
  }
}

export default client;
