/**
 * YouTube Data API v3 Collector
 * Handles channel resolution, verification, video parsing, and metrics fetching
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface ChannelInfo {
  channelId: string;
  handle: string;
  profileUrl: string;
  description: string;
}

export interface VerificationResult {
  ok: boolean;
  channelId: string;
  handle: string;
  profileUrl: string;
}

export interface ParsedYouTubeUrl {
  videoId: string;
  canonicalUrl: string;
}

export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares?: number;
}

export interface AuthorChannelInfo {
  authorChannelId: string;
}

export class YouTubeCollector {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('YOUTUBE_API_KEY is required');
    }
  }

  /**
   * Resolves a YouTube channel from a handle or URL
   * Supports: @handle, youtube.com/@handle, youtube.com/c/name, youtube.com/channel/ID, channel ID
   */
  async resolveChannel(handleOrUrl: string): Promise<ChannelInfo> {
    try {
      let channelId: string | null = null;
      let handle: string | null = null;

      // Parse handle or URL
      if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) {
        // URL format
        const url = new URL(handleOrUrl);
        
        if (url.pathname.startsWith('/@')) {
          // youtube.com/@handle
          handle = url.pathname.slice(2);
        } else if (url.pathname.startsWith('/c/')) {
          // youtube.com/c/channelname
          handle = url.pathname.slice(3);
        } else if (url.pathname.startsWith('/channel/')) {
          // youtube.com/channel/CHANNEL_ID
          channelId = url.pathname.slice(9);
        } else if (url.pathname.startsWith('/user/')) {
          // youtube.com/user/username (legacy)
          handle = url.pathname.slice(6);
        }
      } else if (handleOrUrl.startsWith('@')) {
        // @handle format
        handle = handleOrUrl.slice(1);
      } else if (handleOrUrl.length === 24 && handleOrUrl.startsWith('UC')) {
        // Channel ID format (typically starts with UC and is 24 chars)
        channelId = handleOrUrl;
      } else {
        // Assume it's a handle without @
        handle = handleOrUrl;
      }

      // Fetch channel data
      let url: string;
      if (channelId) {
        url = `${YOUTUBE_API_BASE}/channels?part=snippet&id=${channelId}&key=${this.apiKey}`;
      } else if (handle) {
        // Use forHandle parameter (requires handle without @)
        url = `${YOUTUBE_API_BASE}/channels?part=snippet&forHandle=${handle}&key=${this.apiKey}`;
      } else {
        throw new Error('Invalid handle or URL format');
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as any;
        throw new Error(`YouTube API error: ${error?.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;

      if (!data.items || data.items.length === 0) {
        throw new Error('Channel not found');
      }

      const channel = data.items[0];
      const snippet = channel.snippet;

      return {
        channelId: channel.id,
        handle: snippet.customUrl ? snippet.customUrl.replace('@', '') : `channel/${channel.id}`,
        profileUrl: `https://www.youtube.com/${snippet.customUrl || `channel/${channel.id}`}`,
        description: snippet.description || '',
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve channel: ${error.message}`);
      }
      throw new Error('Failed to resolve channel: Unknown error');
    }
  }

  /**
   * Verifies that a channel's description contains a specific verification code
   */
  async verifyChannelDescriptionContainsCode(
    handleOrUrl: string,
    code: string
  ): Promise<VerificationResult> {
    try {
      const channelInfo = await this.resolveChannel(handleOrUrl);
      
      const description = channelInfo.description || '';
      const codeFound = description.includes(code);

      return {
        ok: codeFound,
        channelId: channelInfo.channelId,
        handle: channelInfo.handle,
        profileUrl: channelInfo.profileUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to verify channel: ${error.message}`);
      }
      throw new Error('Failed to verify channel: Unknown error');
    }
  }

  /**
   * Parses YouTube URLs (supports shorts and watch URLs)
   * Returns video ID and canonical URL
   */
  parseYouTubeUrl(url: string): ParsedYouTubeUrl {
    try {
      const parsedUrl = new URL(url);
      let videoId: string | null = null;

      // youtube.com/watch?v=VIDEO_ID
      if (parsedUrl.pathname === '/watch') {
        videoId = parsedUrl.searchParams.get('v');
      }
      // youtube.com/shorts/VIDEO_ID
      else if (parsedUrl.pathname.startsWith('/shorts/')) {
        videoId = parsedUrl.pathname.slice(8);
      }
      // youtube.com/embed/VIDEO_ID
      else if (parsedUrl.pathname.startsWith('/embed/')) {
        videoId = parsedUrl.pathname.slice(7);
      }
      // youtube.com/v/VIDEO_ID
      else if (parsedUrl.pathname.startsWith('/v/')) {
        videoId = parsedUrl.pathname.slice(3);
      }
      // youtu.be/VIDEO_ID
      else if (parsedUrl.hostname === 'youtu.be') {
        videoId = parsedUrl.pathname.slice(1);
      }

      if (!videoId) {
        throw new Error('Invalid YouTube URL format');
      }

      // Clean video ID (remove any query params or fragments)
      videoId = videoId.split('?')[0].split('#')[0];

      // Generate canonical URL (always use watch format)
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

      return {
        videoId,
        canonicalUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse YouTube URL: ${error.message}`);
      }
      throw new Error('Failed to parse YouTube URL: Unknown error');
    }
  }

  /**
   * Fetches video metrics (views, likes, comments)
   * Shares are not available via YouTube Data API v3, so returns 0
   */
  async fetchVideoMetrics(videoId: string): Promise<VideoMetrics> {
    try {
      const url = `${YOUTUBE_API_BASE}/videos?part=statistics&id=${videoId}&key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as any;
        throw new Error(`YouTube API error: ${error?.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;

      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = data.items[0];
      const stats = video.statistics;

      return {
        views: parseInt(stats.viewCount || '0', 10),
        likes: parseInt(stats.likeCount || '0', 10),
        comments: parseInt(stats.commentCount || '0', 10),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch video metrics: ${error.message}`);
      }
      throw new Error('Failed to fetch video metrics: Unknown error');
    }
  }

  /**
   * Resolves the author channel ID for a video
   */
  async resolveVideoAuthorChannelId(videoId: string): Promise<AuthorChannelInfo> {
    try {
      const url = `${YOUTUBE_API_BASE}/videos?part=snippet&id=${videoId}&key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as any;
        throw new Error(`YouTube API error: ${error?.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;

      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = data.items[0];
      const channelId = video.snippet?.channelId;

      if (!channelId) {
        throw new Error('Channel ID not found in video data');
      }

      return {
        authorChannelId: channelId,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve author channel ID: ${error.message}`);
      }
      throw new Error('Failed to resolve author channel ID: Unknown error');
    }
  }
}

