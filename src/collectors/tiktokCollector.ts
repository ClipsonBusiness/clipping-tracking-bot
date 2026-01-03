/**
 * TikTok Collector using Apify
 * Uses clockworks/tiktok-scraper actor for profiles and videos
 */

import { ApifyClient } from 'apify-client';

export interface UserInfo {
  userId: string;
  handle: string;
  profileUrl: string;
  bio: string;
}

export interface VerificationResult {
  ok: boolean;
  userId: string;
  handle: string;
  profileUrl: string;
}

export interface ParsedTikTokUrl {
  videoId: string;
  canonicalUrl: string;
}

export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface AuthorUserInfo {
  authorUserId: string;
}

export class TikTokCollector {
  private apifyClient: ApifyClient;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.APIFY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('APIFY_API_KEY is required for TikTok scraping');
    }
    this.apifyClient = new ApifyClient({ token: this.apiKey });
  }

  /**
   * Resolves a TikTok user from a handle or URL
   * Uses clockworks/tiktok-scraper actor
   */
  async resolveUser(handleOrUrl: string): Promise<UserInfo> {
    try {
      let handle: string | null = null;

      // Parse handle or URL
      if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) {
        const url = new URL(handleOrUrl);
        if (url.pathname.startsWith('/@')) {
          handle = url.pathname.slice(2);
        }
      } else if (handleOrUrl.startsWith('@')) {
        handle = handleOrUrl.slice(1);
      } else {
        handle = handleOrUrl;
      }

      if (!handle) {
        throw new Error('Invalid handle or URL format');
      }

      // Run TikTok scraper actor to get user profile
      // The actor expects 'profiles' for user profiles (array of usernames or profile URLs)
      const run = await this.apifyClient.actor('clockworks/tiktok-scraper').call({
        profiles: [`https://www.tiktok.com/@${handle}`],
      });

      // Wait for run to finish
      const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
      
      // Get results
      const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error('User not found');
      }

      const userData = items[0] as any;
      
      console.log(`[TikTok Collector] Profile data keys:`, Object.keys(userData));
      console.log(`[TikTok Collector] Profile data authorMeta:`, userData.authorMeta);
      
      // Try to get userId from various possible locations in the Apify response
      // Based on the image, the data structure has authorMeta with name, avatar, etc.
      const userId = userData.authorMeta?.id || 
                     userData.authorMeta?.userId ||
                     userData.userId || 
                     userData.id || 
                     userData.user?.id || 
                     userData.authorId;
      
      const normalizedUserId = userId ? String(userId) : `tiktok_${handle}`;
      
      // Try multiple fields for bio - TikTok profile scraper might return it in different places
      const bio = userData.authorMeta?.signature || 
                  userData.authorMeta?.bio ||
                  userData.signature || 
                  userData.bio || 
                  userData.text || 
                  userData.description || 
                  userData.authorMeta?.description ||
                  '';
      
      console.log(`[TikTok Collector] Resolved user ID: ${normalizedUserId} for handle: ${handle}`);
      console.log(`[TikTok Collector] Bio extracted (length: ${bio.length}):`, bio.substring(0, 200));
      console.log(`[TikTok Collector] Bio fields checked:`, {
        'authorMeta.signature': userData.authorMeta?.signature,
        'authorMeta.bio': userData.authorMeta?.bio,
        'signature': userData.signature,
        'bio': userData.bio,
        'text': userData.text,
        'description': userData.description,
      });
      
      return {
        userId: normalizedUserId,
        handle: userData.authorMeta?.name || userData.uniqueId || userData.username || handle,
        profileUrl: `https://www.tiktok.com/@${userData.authorMeta?.name || userData.uniqueId || userData.username || handle}`,
        bio: bio,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve user: ${error.message}`);
      }
      throw new Error('Failed to resolve user: Unknown error');
    }
  }

  /**
   * Verifies that a user's bio contains a specific verification code
   */
  async verifyUserBioContainsCode(
    handleOrUrl: string,
    code: string
  ): Promise<VerificationResult> {
    try {
      const userInfo = await this.resolveUser(handleOrUrl);
      const bio = userInfo.bio || '';
      
      // Make code search case-insensitive and handle whitespace
      const normalizedBio = bio.trim();
      const normalizedCode = code.trim();
      
      // Check if code exists in bio (case-insensitive)
      const codeFound = normalizedBio.toLowerCase().includes(normalizedCode.toLowerCase());
      
      console.log(`[TikTok Collector] Verifying code "${normalizedCode}" in bio:`);
      console.log(`[TikTok Collector] Bio: "${normalizedBio}"`);
      console.log(`[TikTok Collector] Code found: ${codeFound}`);

      return {
        ok: codeFound,
        userId: userInfo.userId,
        handle: userInfo.handle,
        profileUrl: userInfo.profileUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to verify user: ${error.message}`);
      }
      throw new Error('Failed to verify user: Unknown error');
    }
  }

  /**
   * Parses TikTok URLs
   * Supports: tiktok.com/@user/video/VIDEO_ID, vm.tiktok.com/VIDEO_ID
   */
  parseTikTokUrl(url: string): ParsedTikTokUrl {
    try {
      const parsedUrl = new URL(url);
      let videoId: string | null = null;

      let username: string | null = null;
      
      // tiktok.com/@user/video/VIDEO_ID
      if (parsedUrl.pathname.includes('/video/')) {
        const parts = parsedUrl.pathname.split('/video/');
        if (parts.length > 1) {
          videoId = parts[1].split('?')[0].split('#')[0];
          // Extract username from path like /@username/video/...
          const pathBeforeVideo = parts[0];
          if (pathBeforeVideo.startsWith('/@')) {
            username = pathBeforeVideo.slice(2);
          }
        }
      }
      // vm.tiktok.com/VIDEO_ID or direct video ID
      else if (parsedUrl.hostname === 'vm.tiktok.com' || parsedUrl.hostname === 'www.tiktok.com') {
        videoId = parsedUrl.pathname.slice(1).split('?')[0].split('#')[0];
      }

      if (!videoId) {
        throw new Error('Invalid TikTok URL format');
      }

      // Generate canonical URL - preserve username if available for better Apify compatibility
      const canonicalUrl = username 
        ? `https://www.tiktok.com/@${username}/video/${videoId}`
        : `https://www.tiktok.com/video/${videoId}`;

      return {
        videoId,
        canonicalUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse TikTok URL: ${error.message}`);
      }
      throw new Error('Failed to parse TikTok URL: Unknown error');
    }
  }

  /**
   * Fetches video metrics (views, likes, comments, shares)
   * Uses clockworks/tiktok-scraper actor
   * @param videoId - Can be video ID or full URL
   */
  async fetchVideoMetrics(videoId: string): Promise<VideoMetrics> {
    try {
      // Use full URL if provided, otherwise construct from videoId
      let videoUrl: string;
      if (videoId.startsWith('http://') || videoId.startsWith('https://')) {
        videoUrl = videoId;
      } else {
        videoUrl = `https://www.tiktok.com/video/${videoId}`;
      }

      console.log(`[TikTok Collector] Fetching metrics for: ${videoUrl}`);

      // Run TikTok scraper actor to get video data
      // The actor expects startUrls array with full TikTok URLs
      let run;
      try {
        // Try the actor - check if it exists first
        const actor = this.apifyClient.actor('clockworks/tiktok-scraper');
        
        // Get actor info to verify it exists
        try {
          const actorInfo = await actor.get();
          console.log(`[TikTok Collector] Actor found: ${(actorInfo as any).name || 'unknown'}, version: ${(actorInfo as any).defaultRunInput?.version || 'latest'}`);
        } catch (infoError) {
          console.warn(`[TikTok Collector] Could not get actor info:`, infoError);
        }
        
        // The actor expects 'postURLs' not 'startUrls'
        run = await actor.call({
          postURLs: [videoUrl],
        });
        console.log(`[TikTok Collector] Apify run started: ${run.id}`);
      } catch (actorError) {
        console.error(`[TikTok Collector] Failed to start Apify actor:`, actorError);
        const errorMsg = actorError instanceof Error ? actorError.message : 'Unknown error';
        // Check if actor doesn't exist
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          throw new Error(`Apify actor 'clockworks/tiktok-scraper' not found. Please verify the actor name is correct.`);
        }
        throw new Error(`Failed to start Apify actor: ${errorMsg}`);
      }

      // Wait for run to finish with timeout
      let finishedRun;
      try {
        finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
        console.log(`[TikTok Collector] Apify run finished with status: ${finishedRun.status}`);
      } catch (waitError) {
        console.error(`[TikTok Collector] Error waiting for Apify run:`, waitError);
        throw new Error(`Apify run timed out or failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
      }

      // Check if run failed
      if (finishedRun.status === 'FAILED' || finishedRun.status === 'ABORTED') {
        let errorDetails = '';
        try {
          // Get full log
          const runLog = await this.apifyClient.run(run.id).log().get();
          const logText = typeof runLog === 'string' ? runLog : JSON.stringify(runLog);
          // Get last 1000 characters of log for more context
          const logSnippet = logText.length > 1000 ? logText.substring(logText.length - 1000) : logText;
          errorDetails = ` Status: ${finishedRun.status}. Last 1000 chars of log: ${logSnippet}`;
          
          // Also try to get run execution details
          const runDetails = await this.apifyClient.run(run.id).get();
          if (runDetails?.statusMessage) {
            errorDetails += ` Status message: ${runDetails.statusMessage}`;
          }
        } catch (logError) {
          errorDetails = ` Status: ${finishedRun.status}. Could not fetch logs: ${logError instanceof Error ? logError.message : 'Unknown'}`;
        }
        throw new Error(`Apify run failed:${errorDetails}`);
      }

      // Get results
      const dataset = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
      const { items } = dataset;
      
      console.log(`[TikTok Collector] Got ${items?.length || 0} items from Apify`);
      
      if (!items || items.length === 0) {
        // Try to get more info about why it failed
        const runLog = await this.apifyClient.run(run.id).log().get();
        console.log(`[TikTok Collector] Run log:`, runLog);
        throw new Error(`Video not found: ${videoUrl}. Apify actor returned no results.`);
      }

      const videoData = items[0] as any;
      console.log(`[TikTok Collector] Video data keys:`, Object.keys(videoData));
      console.log(`[TikTok Collector] Video data authorMeta:`, videoData.authorMeta);
      console.log(`[TikTok Collector] Full videoData sample:`, JSON.stringify(videoData, null, 2).substring(0, 1000));
      
      // Based on the Apify data structure shown, the fields are:
      // playCount, diggCount, shareCount, commentCount, collectCount
      // And author info is in authorMeta
      const views = videoData.playCount || videoData.plays || videoData.viewCount || videoData.views || videoData.play || 
                   videoData.statistics?.playCount || videoData.statistics?.viewCount || 0;
      const likes = videoData.diggCount || videoData.diggs || videoData.likeCount || videoData.likes || videoData.digg || 
                   videoData.statistics?.diggCount || videoData.statistics?.likeCount || 0;
      const comments = videoData.commentCount || videoData.comments || videoData.comment || 
                      videoData.statistics?.commentCount || 0;
      const shares = videoData.shareCount || videoData.shares || videoData.share || 
                    videoData.statistics?.shareCount || 0;
      
      return {
        views: typeof views === 'number' ? views : parseInt(String(views)) || 0,
        likes: typeof likes === 'number' ? likes : parseInt(String(likes)) || 0,
        comments: typeof comments === 'number' ? comments : parseInt(String(comments)) || 0,
        shares: typeof shares === 'number' ? shares : parseInt(String(shares)) || 0,
      };
    } catch (error) {
      console.error(`[TikTok Collector] Error fetching video metrics:`, error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch video metrics: ${error.message}`);
      }
      throw new Error('Failed to fetch video metrics: Unknown error');
    }
  }

  /**
   * Resolves the author user ID for a video
   * Uses clockworks/tiktok-scraper actor
   * @param videoId - Can be video ID or full URL
   */
  async resolveVideoAuthorUserId(videoId: string): Promise<AuthorUserInfo> {
    try {
      // Use full URL if provided, otherwise construct from videoId
      let videoUrl: string;
      if (videoId.startsWith('http://') || videoId.startsWith('https://')) {
        videoUrl = videoId;
      } else {
        videoUrl = `https://www.tiktok.com/video/${videoId}`;
      }

      // Run TikTok scraper actor to get video data
      // The actor expects 'postURLs' for video URLs (array of URL strings)
      const run = await this.apifyClient.actor('clockworks/tiktok-scraper').call({
        postURLs: [videoUrl],
      });

      // Wait for run to finish
      const finishedRun = await this.apifyClient.run(run.id).waitForFinish();

      // Get results
      const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error(`Video not found: ${videoUrl}`);
      }

      const videoData = items[0] as any;
      
      // Based on the Apify response structure, author info is in authorMeta
      // Try different possible field names from the actor
      const authorUserId = videoData.authorMeta?.id || 
                           videoData.authorMeta?.userId ||
                           videoData.authorId || 
                           videoData.userId || 
                           videoData.author?.id ||
                           videoData.creator?.id;
      
      console.log(`[TikTok Collector] Video data keys:`, Object.keys(videoData));
      console.log(`[TikTok Collector] Author fields:`, {
        authorMetaId: videoData.authorMeta?.id,
        authorMetaUserId: videoData.authorMeta?.userId,
        authorMetaName: videoData.authorMeta?.name,
        authorId: videoData.authorId,
        userId: videoData.userId,
        authorId2: videoData.author?.id,
        creatorId: videoData.creator?.id,
      });
      
      if (!authorUserId) {
        // If we can't find user ID, try to get username and resolve it
        const username = videoData.authorMeta?.name || 
                         videoData.author?.uniqueId || 
                         videoData.creator?.uniqueId ||
                         videoData.authorMeta?.uniqueId;
        console.log(`[TikTok Collector] Trying to resolve by username: ${username}`);
        if (username) {
          // Resolve user to get ID
          const userInfo = await this.resolveUser(username);
          return {
            authorUserId: userInfo.userId,
          };
        }
        throw new Error('Author user ID not found in video data');
      }

      // Normalize to string for consistent comparison
      const normalizedAuthorUserId = String(authorUserId);
      console.log(`[TikTok Collector] Resolved author user ID: ${normalizedAuthorUserId}`);
      
      return {
        authorUserId: normalizedAuthorUserId,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve author user ID: ${error.message}`);
      }
      throw new Error('Failed to resolve author user ID: Unknown error');
    }
  }
}
