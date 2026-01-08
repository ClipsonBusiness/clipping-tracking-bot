import { Client, EmbedBuilder, ChannelType } from 'discord.js';
import { getPrismaClient } from '../utils/prisma';

/**
 * Calculate and post daily campaign status to Discord channel
 */
export async function postDailyCampaignStatus(client: Client): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();

  try {
    // Find all active campaigns with Discord channels
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        // @ts-ignore - discordChannelId exists in schema but may not be in generated types yet
        discordChannelId: { not: null },
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
    }) as any[];

    console.log(`[Campaign Status] Found ${campaigns.length} active campaigns with channels`);

    for (const campaign of campaigns) {
      const campaignAny = campaign as any;
      if (!campaignAny.discordChannelId) continue;

      try {
        // Get channel
        const channel = await client.channels.fetch(campaignAny.discordChannelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
          console.warn(`[Campaign Status] Channel ${campaign.discordChannelId} not found or not a text channel`);
          continue;
        }

        // Calculate campaign stats
        const campaignSubmissions = (campaign as any).submissions || [];
        const activeVideosThisCampaign = campaignSubmissions.length;
        const totalViews = campaignSubmissions.reduce((sum: number, s: any) => sum + (s.latestViews || 0), 0);

        // Get all active submissions (for "All Campaigns" stat)
        const allActiveSubmissions = await prisma.submission.count({
          where: {
            status: { in: ['PENDING', 'APPROVED'] },
          },
        });

        // Calculate goal progress (based on target submissions or total views goal)
        // If targetSubmissions is set, calculate progress based on active videos
        // Otherwise, use minViewsPerClip as a per-video requirement
        let goalProgress = '0.0';
        const minViewsRequired = campaign.minViewsPerClip || 0;
        
        if (campaign.targetSubmissions && campaign.targetSubmissions > 0) {
          goalProgress = ((activeVideosThisCampaign / campaign.targetSubmissions) * 100).toFixed(1);
        } else if (minViewsRequired > 0) {
          // Use total views vs a calculated goal (e.g., minViewsPerClip * targetSubmissions)
          // For now, just show percentage based on minViewsPerClip
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

        // Create daily status embed
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

        // Post status message
        await channel.send({ embeds: [statusEmbed] });
        console.log(`[Campaign Status] Posted daily status for campaign: ${campaign.name}`);

      } catch (error: any) {
        console.error(`[Campaign Status] Error posting status for campaign ${campaign.name}:`, error.message);
      }
    }

  } catch (error: any) {
    console.error('[Campaign Status] Error in daily status update:', error);
  }
}

/**
 * Start the daily campaign status scheduler
 * Runs once per day at a specified time (default: 4:00 AM UTC)
 */
export function startCampaignStatusScheduler(client: Client): NodeJS.Timeout {
  console.log('[Campaign Status] Starting daily campaign status scheduler');

  // Calculate time until next 4:00 AM UTC
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(4, 0, 0, 0);
  
  // If it's already past 4 AM today, schedule for tomorrow
  if (now.getUTCHours() >= 4) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  const msUntilNextRun = nextRun.getTime() - now.getTime();
  console.log(`[Campaign Status] Next status update scheduled for: ${nextRun.toISOString()}`);

  // Schedule first run
  const timeout = setTimeout(() => {
    postDailyCampaignStatus(client).catch(error => {
      console.error('[Campaign Status] Error in scheduled status update:', error);
    });

    // Then run every 24 hours
    const interval = setInterval(() => {
      postDailyCampaignStatus(client).catch(error => {
        console.error('[Campaign Status] Error in scheduled status update:', error);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Store interval for cleanup if needed
    (global as any).campaignStatusInterval = interval;
  }, msUntilNextRun);

  return timeout as any;
}

