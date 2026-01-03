/**
 * Instagram Collector using Apify
 * Uses apify/instagram-profile-scraper for profiles and apify/instagram-reel-scraper for reels/posts
 * 
 * Note: The instagram-reel-scraper actor requires a username field. If the URL doesn't contain
 * a username (e.g., instagram.com/reel/SHORTCODE), we try to work around this limitation.
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

export interface ParsedInstagramUrl {
  mediaId: string;
  canonicalUrl: string;
}

export interface MediaMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface AuthorUserInfo {
  authorUserId: string;
}

export class InstagramCollector {
  private apifyClient: ApifyClient;
  private apifyApiKey: string;
  private sociaVaultApiKey: string;

  constructor(apifyApiKey?: string, sociaVaultApiKey?: string) {
    this.apifyApiKey = apifyApiKey || process.env.APIFY_API_KEY || '';
    this.sociaVaultApiKey = sociaVaultApiKey || process.env.SOCIAVAULT_API_KEY || '';
    
    if (!this.apifyApiKey) {
      throw new Error('APIFY_API_KEY is required for Instagram profile scraping');
    }
    
    this.apifyClient = new ApifyClient({ token: this.apifyApiKey });
  }

  /**
   * Resolves an Instagram user from a handle or URL
   * Uses apify/instagram-profile-scraper actor
   */
  async resolveUser(handleOrUrl: string): Promise<UserInfo> {
    try {
      let handle: string | null = null;

      // Parse handle or URL
      if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) {
        const url = new URL(handleOrUrl);
        if (url.pathname.startsWith('/')) {
          handle = url.pathname.slice(1).replace('@', '').replace('/', '');
        }
      } else if (handleOrUrl.startsWith('@')) {
        handle = handleOrUrl.slice(1);
      } else {
        handle = handleOrUrl;
      }

      if (!handle) {
        throw new Error('Invalid handle or URL format');
      }

      // Run Instagram profile scraper actor
      const run = await this.apifyClient.actor('apify/instagram-profile-scraper').call({
        usernames: [handle],
        resultsLimit: 1,
      });

      // Wait for run to finish and get results
      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error('User not found');
      }

      const userData = items[0] as any;
      
      return {
        userId: userData.id || userData.userId || `instagram_${handle}`,
        handle: userData.username || handle,
        profileUrl: `https://www.instagram.com/${userData.username || handle}/`,
        bio: userData.biography || userData.bio || '',
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
      const codeFound = bio.toLowerCase().includes(code.toLowerCase());

      return {
        ok: codeFound,
        userId: userInfo.userId,
        handle: userInfo.handle,
        profileUrl: userInfo.profileUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to verify account: ${error.message}`);
      }
      throw new Error('Failed to verify account: Unknown error');
    }
  }

  /**
   * Parses Instagram URLs
   * Supports: instagram.com/p/POST_ID, instagram.com/reel/REEL_ID
   */
  parseInstagramUrl(url: string): ParsedInstagramUrl {
    try {
      const parsedUrl = new URL(url);
      let mediaId: string | null = null;

      // instagram.com/p/POST_ID or instagram.com/reel/REEL_ID
      const pathParts = parsedUrl.pathname.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        const type = pathParts[0]; // 'p' or 'reel'
        mediaId = pathParts[1].split('?')[0].split('#')[0];
      }

      if (!mediaId) {
        throw new Error('Invalid Instagram URL format');
      }

      // Generate canonical URL (preserve original format with username if present)
      // If URL has username like instagram.com/username/p/SHORTCODE, preserve it
      const canonicalUrl = `https://www.instagram.com${parsedUrl.pathname.split('?')[0]}`;

      return {
        mediaId,
        canonicalUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse Instagram URL: ${error.message}`);
      }
      throw new Error('Failed to parse Instagram URL: Unknown error');
    }
  }

  /**
   * Fetches media metrics (views, likes, comments, shares)
   * Uses Instagram oEmbed API (free) as primary method, with Apify as fallback
   */
  async fetchMediaMetrics(mediaId: string): Promise<MediaMetrics> {
    try {
      // Normalize URL
      let instagramUrl: string;
      
      if (mediaId.startsWith('http')) {
        instagramUrl = mediaId;
      } else {
        instagramUrl = `https://www.instagram.com/p/${mediaId}/`;
      }

      // Extract shortcode
      const shortcodeMatch = instagramUrl.match(/\/(p|reel)\/([^\/\?]+)/);
      const shortcode = shortcodeMatch ? shortcodeMatch[2] : null;
      
      // Convert /p/ URLs to /reel/ format for better compatibility with Apify actors
      // User says "reel link" works in Apify, so let's try that format
      let reelUrl: string | null = null;
      if (shortcode) {
        reelUrl = `https://www.instagram.com/reel/${shortcode}/`;
      }

      // Strategy 1: Try apify/instagram-reel-scraper FIRST
      // User says it works in Apify console - let's replicate it exactly
      console.log(`[Instagram Collector] Strategy 1: Trying apify/instagram-reel-scraper (replicating console format)`);
      try {
        // Get the actor's default input and schema to see exactly what it expects
        let actorDefaultInput: any = null;
        let actorInputSchema: any = null;
        try {
          const actorInfo = await this.apifyClient.actor('apify/instagram-reel-scraper').get();
          actorDefaultInput = actorInfo.defaultRunInput;
          actorInputSchema = actorInfo.inputSchema;
          
          console.log(`[Instagram Collector] Actor name: ${actorInfo.name}`);
          console.log(`[Instagram Collector] Actor default input:`, JSON.stringify(actorDefaultInput, null, 2));
          if (actorInputSchema) {
            console.log(`[Instagram Collector] Actor input schema (first 3000 chars):`, JSON.stringify(actorInputSchema, null, 2).substring(0, 3000));
          }
        } catch (actorInfoError) {
          console.log(`[Instagram Collector] Could not get actor info: ${actorInfoError instanceof Error ? actorInfoError.message : 'Unknown'}`);
        }
        
        // First, extract username from Instagram page HTML (might be required by actor API)
        let username: string | undefined;
        console.log(`[Instagram Collector] Extracting username from Instagram page...`);
        
        // Try fetching the page and extracting from window._sharedData
        try {
          const response = await fetch(reelUrl || instagramUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          
          if (response.ok) {
            const htmlText = await response.text();
            console.log(`[Instagram Collector] Fetched page HTML (${htmlText.length} chars)`);
            
            // Try multiple methods to extract username
            
            // Method 1: window._sharedData (most reliable)
            const sharedDataMatch = htmlText.match(/window\._sharedData\s*=\s*({.+?});/);
            if (sharedDataMatch) {
              try {
                const sharedData = JSON.parse(sharedDataMatch[1]);
                username = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.owner?.username ||
                          sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.ownerUsername ||
                          sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.owner?.username;
                if (username) {
                  console.log(`[Instagram Collector] ✅ Extracted username from window._sharedData: ${username}`);
                }
              } catch (e) {
                console.log(`[Instagram Collector] Failed to parse window._sharedData: ${e instanceof Error ? e.message : 'Unknown'}`);
              }
            }
            
            // Method 2: window.__additionalDataLoaded (alternative data structure)
            if (!username) {
              const additionalDataMatch = htmlText.match(/window\.__additionalDataLoaded\s*\([^,]+,\s*({.+?})\)/);
              if (additionalDataMatch) {
                try {
                  const additionalData = JSON.parse(additionalDataMatch[1]);
                  username = additionalData?.graphql?.shortcode_media?.owner?.username ||
                            additionalData?.graphql?.shortcode_media?.ownerUsername;
                  if (username) {
                    console.log(`[Instagram Collector] ✅ Extracted username from window.__additionalDataLoaded: ${username}`);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
            
            // Method 3: Look for JSON-LD structured data
            if (!username) {
              const jsonLdMatch = htmlText.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.+?)<\/script>/is);
              if (jsonLdMatch) {
                try {
                  const jsonLd = JSON.parse(jsonLdMatch[1]);
                  if (Array.isArray(jsonLd)) {
                    const author = jsonLd.find((item: any) => item['@type'] === 'Person' || item.author);
                    username = author?.alternateName || author?.author?.alternateName;
                  } else {
                    username = jsonLd.author?.alternateName || jsonLd['@graph']?.find((item: any) => item['@type'] === 'Person')?.alternateName;
                  }
                  if (username) {
                    console.log(`[Instagram Collector] ✅ Extracted username from JSON-LD: ${username}`);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
            
            // Method 4: Look for meta tags
            if (!username) {
              const metaMatch = htmlText.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
              if (metaMatch) {
                const ogUrl = metaMatch[1];
                const urlMatch = ogUrl.match(/instagram\.com\/([^\/\?]+)/);
                if (urlMatch && urlMatch[1] && urlMatch[1] !== 'p' && urlMatch[1] !== 'reel') {
                  username = urlMatch[1];
                  console.log(`[Instagram Collector] ✅ Extracted username from og:url meta tag: ${username}`);
                }
              }
            }
            
            // Method 5: Regex patterns in HTML
            if (!username) {
              const patterns = [
                /"ownerUsername":\s*"([^"]+)"/i,
                /"username":\s*"([^"]+)"[^}]*"owner"/i,
                /"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                /"shortcode_media":\s*\{[^}]*"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                /instagram\.com\/([a-zA-Z0-9._]+)[^\/\?"']*["']/i,
                /"profilePage_([^"]+)":/i, // Sometimes username appears in profilePage_username
              ];
              
              for (const pattern of patterns) {
                const match = htmlText.match(pattern);
                if (match && match[1] && match[1] !== 'p' && match[1] !== 'reel' && match[1].length > 1 && match[1].length < 50) {
                  username = match[1];
                  console.log(`[Instagram Collector] ✅ Extracted username from HTML pattern: ${username}`);
                  break;
                }
              }
            }
            
            // Method 6: Look for canonical URL or link tags
            if (!username) {
              const canonicalMatch = htmlText.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
              if (canonicalMatch) {
                const canonicalUrl = canonicalMatch[1];
                const urlMatch = canonicalUrl.match(/instagram\.com\/([^\/\?]+)/);
                if (urlMatch && urlMatch[1] && urlMatch[1] !== 'p' && urlMatch[1] !== 'reel') {
                  username = urlMatch[1];
                  console.log(`[Instagram Collector] ✅ Extracted username from canonical URL: ${username}`);
                }
              }
            }
          }
        } catch (fetchError) {
          console.log(`[Instagram Collector] Failed to fetch page for username extraction: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
        }
        
        if (!username) {
          console.log(`[Instagram Collector] ⚠️ Could not extract username, will try actor without it (may fail)`);
        }
        
        // Try with /reel/ format first (user says this works!), then /p/ format
        const urlsToTry = reelUrl ? [reelUrl, instagramUrl] : [instagramUrl];
        
        for (const urlToTry of urlsToTry) {
          // EXACT format from Apify console (user provided):
          // {
          //   "username": ["https://www.instagram.com/p/DTCJ63HDB_t/"],
          //   "includeDownloadedVideo": false,
          //   "includeSharesCount": false,
          //   "includeTranscript": false,
          //   "resultsLimit": 30,
          //   "skipPinnedPosts": false
          // }
          // Key insight: "username" is an ARRAY of URLs, not a string!
          const inputFormats = [
            // Format 1: EXACT console format - username as array of URLs
            {
              username: [urlToTry],
              includeDownloadedVideo: false,
              includeSharesCount: false,
              includeTranscript: false,
              resultsLimit: 30,
              skipPinnedPosts: false,
            },
            // Format 2: Minimal version (just username array)
            { username: [urlToTry] },
            // Format 3: With extracted username as string (if we have it, though console doesn't use this)
            username ? { username: [urlToTry], extractedUsername: username } : null,
            // Format 4: Fallback to startUrls (in case actor accepts both)
            { startUrls: [{ url: urlToTry }] },
            { startUrls: [urlToTry] },
          ].filter(Boolean) as any[];
          
          for (const input of inputFormats) {
            try {
              console.log(`[Instagram Collector] Calling apify/instagram-reel-scraper with input:`, JSON.stringify(input));
              console.log(`[Instagram Collector] Using EXACT console format: username as array of URLs`);
              const run = await this.apifyClient.actor('apify/instagram-reel-scraper').call(input);
              console.log(`[Instagram Collector] Actor run started: ${run.id}`);
              
              console.log(`[Instagram Collector] Waiting for actor run ${run.id} to finish (max 120 seconds)...`);
              const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 120 });
              console.log(`[Instagram Collector] Actor run ${run.id} finished with status: ${finishedRun.status}`);
              
              if (finishedRun.status === 'SUCCEEDED') {
                const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
                console.log(`[Instagram Collector] Dataset has ${items?.length || 0} items`);
                if (items && items.length > 0) {
                  const mediaData = items[0] as any;
                  console.log(`[Instagram Collector] ✅ apify/instagram-reel-scraper succeeded!`);
                  console.log(`[Instagram Collector] Media data keys:`, Object.keys(mediaData));
                  console.log(`[Instagram Collector] Full media data sample:`, JSON.stringify(mediaData, null, 2).substring(0, 2000));
                  
                  // Extract metrics - try various field names
                  const views = mediaData.videoViewCount || 
                              mediaData.videoPlayCount || 
                              mediaData.playCount || 
                              mediaData.viewCount || 
                              mediaData.video_views ||
                              mediaData.views ||
                              0;
                  
                  const likes = mediaData.likesCount || 
                              mediaData.likeCount || 
                              mediaData.likes || 
                              mediaData.like_count ||
                              mediaData.edge_media_preview_like?.count ||
                              0;
                  
                  const comments = mediaData.commentsCount || 
                                 mediaData.commentCount || 
                                 mediaData.comments || 
                                 mediaData.comment_count ||
                                 mediaData.edge_media_to_comment?.count ||
                                 0;
                  
                  const shares = mediaData.sharesCount || 
                               mediaData.shareCount || 
                               mediaData.shares || 
                               mediaData.share_count ||
                               0;
                  
                  console.log(`[Instagram Collector] Extracted metrics - views: ${views}, likes: ${likes}, comments: ${comments}, shares: ${shares}`);
                  
                  if (views > 0 || likes > 0 || comments > 0 || shares > 0) {
                    return {
                      views: views || 0,
                      likes: likes || 0,
                      comments: comments || 0,
                      shares: shares || 0,
                    };
                  } else {
                    console.log(`[Instagram Collector] ⚠️ apify/instagram-reel-scraper returned data but no metrics found`);
                  }
                } else {
                  console.log(`[Instagram Collector] ⚠️ apify/instagram-reel-scraper returned no items`);
                }
              } else {
                const runDetails = await this.apifyClient.run(run.id).get();
                console.log(`[Instagram Collector] ❌ apify/instagram-reel-scraper status: ${finishedRun.status}, message: ${runDetails?.statusMessage || 'none'}`);
                
                // Try to get error logs
                try {
                  const runLog = await this.apifyClient.run(run.id).log().get();
                  const logText = typeof runLog === 'string' ? runLog : JSON.stringify(runLog);
                  const logSnippet = logText.length > 2000 ? logText.substring(logText.length - 2000) : logText;
                  console.log(`[Instagram Collector] Last 2000 chars of log:`, logSnippet);
                } catch (logError) {
                  console.log(`[Instagram Collector] Could not fetch logs: ${logError instanceof Error ? logError.message : 'Unknown'}`);
                }
              }
              
              // If we got here and didn't return, try next input format
              continue;
            } catch (inputError) {
              const errorMsg = inputError instanceof Error ? inputError.message : 'Unknown';
              console.log(`[Instagram Collector] ❌ apify/instagram-reel-scraper with ${Object.keys(input)[0]} failed: ${errorMsg}`);
              
              // If it's a username error, skip other input formats for this URL and try next URL
              if (errorMsg.includes('username') || errorMsg.includes('required')) {
                console.log(`[Instagram Collector] Actor requires username, will try to extract and retry...`);
                break; // Break out of input formats loop, try next URL
              }
              // Otherwise, try next input format
              continue;
            }
          }
          
          // If we got here, all input formats failed for this URL, try next URL
          if (urlToTry === reelUrl && urlsToTry.length > 1) {
            console.log(`[Instagram Collector] /reel/ format didn't work, trying /p/ format...`);
            continue;
          }
          break; // If we tried all URLs, break
        }
      } catch (strategy1Error) {
        console.log(`[Instagram Collector] Strategy 1 (apify/instagram-reel-scraper) failed:`, strategy1Error instanceof Error ? strategy1Error.message : 'Unknown');
        if (strategy1Error instanceof Error && strategy1Error.stack) {
          console.log(`[Instagram Collector] Error stack:`, strategy1Error.stack);
        }
      }
      
      // If Strategy 1 failed, try with username extraction (fallback)
      console.log(`[Instagram Collector] Strategy 1 failed, trying with username extraction...`);
      try {
        // First, extract username from URL or use oEmbed
        let username: string | undefined;
        
        // Try to extract username from URL first
        try {
          const urlMatch = instagramUrl.match(/instagram\.com\/([^\/]+)\/(p|reel)\//);
          if (urlMatch && urlMatch[1] && urlMatch[1] !== 'p' && urlMatch[1] !== 'reel') {
            username = urlMatch[1];
            console.log(`[Instagram Collector] ✅ Extracted username from URL: ${username}`);
          }
        } catch (e) {
          // Ignore
        }
        
        // If no username in URL, try SociaVault comments endpoint (we know this works!)
        if (!username && this.sociaVaultApiKey) {
          console.log(`[Instagram Collector] No username in URL, trying SociaVault comments endpoint to extract username...`);
          try {
            const sociaVaultUrl = `https://api.sociavault.com/v1/scrape/instagram/comments?url=${encodeURIComponent(instagramUrl)}`;
            const response = await fetch(sociaVaultUrl, {
              headers: {
                'X-API-Key': this.sociaVaultApiKey,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const data = await response.json() as any;
              // SociaVault comments response might have post owner info
              // Try to extract from the first comment's owner or from post metadata
              if (data?.data?.comments) {
                const comments = data.data.comments;
                // Get username from first comment's owner (if available)
                const firstComment = comments[Object.keys(comments)[0]];
                if (firstComment?.user?.username) {
                  // This is the commenter, not the post owner, but we can try to infer
                  // Actually, we need the post owner, not commenter
                }
              }
              
              // Check if there's post metadata in the response
              if (data?.data?.ownerUsername) {
                username = data.data.ownerUsername;
                console.log(`[Instagram Collector] ✅ Extracted username from SociaVault: ${username}`);
              }
            }
          } catch (sociaVaultError) {
            console.log(`[Instagram Collector] SociaVault comments endpoint failed: ${sociaVaultError instanceof Error ? sociaVaultError.message : 'Unknown'}`);
          }
        }
        
        // If still no username, try Instagram JSON endpoint
        if (!username && shortcode) {
          console.log(`[Instagram Collector] Still no username, trying Instagram JSON endpoint...`);
          try {
            const jsonUrls = [
              `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
              `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`,
            ];
            
            for (const jsonUrl of jsonUrls) {
              try {
                const response = await fetch(jsonUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                  },
                });
                
                if (response.ok) {
                  const jsonData = await response.json() as any;
                  const mediaData = jsonData?.graphql?.shortcode_media || jsonData?.items?.[0] || jsonData?.data;
                  
                  if (mediaData) {
                    const ownerUsername = mediaData?.owner?.username || 
                                       mediaData?.user?.username ||
                                       mediaData?.ownerUsername;
                    
                    if (ownerUsername) {
                      username = ownerUsername;
                      console.log(`[Instagram Collector] ✅ Extracted username from Instagram JSON: ${username}`);
                      break;
                    }
                  }
                }
              } catch (jsonError) {
                continue; // Try next URL format
              }
            }
          } catch (jsonError) {
            console.log(`[Instagram Collector] Instagram JSON endpoint failed: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`);
          }
        }
        
        // If still no username, try oEmbed API and parse HTML if needed
        if (!username) {
          console.log(`[Instagram Collector] Still no username, trying oEmbed API as final fallback...`);
          try {
            const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(instagramUrl)}`;
            const response = await fetch(oembedUrl);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const oembedData = await response.json() as any;
                const authorUrl = oembedData.author_url || oembedData.authorUrl;
                if (authorUrl) {
                  const authorMatch = authorUrl.match(/instagram\.com\/([^\/\?]+)/);
                  if (authorMatch && authorMatch[1]) {
                    username = authorMatch[1];
                    console.log(`[Instagram Collector] ✅ Extracted username from oEmbed: ${username}`);
                  }
                }
                
                if (!username && oembedData.author_name) {
                  username = oembedData.author_name.replace('@', '');
                  console.log(`[Instagram Collector] ✅ Extracted username from author_name: ${username}`);
                }
              } else {
                // Try to parse HTML response
                console.log(`[Instagram Collector] oEmbed returned HTML, trying to parse it...`);
                try {
                  const htmlText = await response.text();
                  // Try to extract username from HTML meta tags or links
                  const metaMatch = htmlText.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
                  if (metaMatch && metaMatch[1]) {
                    const urlMatch = metaMatch[1].match(/instagram\.com\/([^\/\?]+)/);
                    if (urlMatch && urlMatch[1]) {
                      username = urlMatch[1];
                      console.log(`[Instagram Collector] ✅ Extracted username from oEmbed HTML meta tag: ${username}`);
                    }
                  }
                  
                  // Also try to find author link in HTML
                  if (!username) {
                    const authorLinkMatch = htmlText.match(/instagram\.com\/([^\/\?"']+)[^>]*>.*author/i);
                    if (authorLinkMatch && authorLinkMatch[1]) {
                      username = authorLinkMatch[1];
                      console.log(`[Instagram Collector] ✅ Extracted username from oEmbed HTML link: ${username}`);
                    }
                  }
                } catch (htmlError) {
                  console.log(`[Instagram Collector] Failed to parse oEmbed HTML: ${htmlError instanceof Error ? htmlError.message : 'Unknown'}`);
                }
              }
            }
          } catch (oembedError) {
            console.log(`[Instagram Collector] oEmbed failed: ${oembedError instanceof Error ? oembedError.message : 'Unknown'}`);
          }
        }
        
        // Last resort: Try to fetch the actual Instagram page and parse it
        if (!username) {
          console.log(`[Instagram Collector] Last resort: Trying to fetch Instagram page HTML to extract username...`);
          try {
            const response = await fetch(instagramUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
              },
            });
            
            if (response.ok) {
              const htmlText = await response.text();
              console.log(`[Instagram Collector] Fetched Instagram page HTML (${htmlText.length} chars)`);
              
              // First, try window._sharedData (most reliable)
              const sharedDataMatch = htmlText.match(/window\._sharedData\s*=\s*({.+?});/);
              if (sharedDataMatch) {
                try {
                  const sharedData = JSON.parse(sharedDataMatch[1]);
                  const ownerUsername = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.owner?.username ||
                                      sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.ownerUsername;
                  if (ownerUsername) {
                    username = ownerUsername;
                    console.log(`[Instagram Collector] ✅ Extracted username from window._sharedData: ${username}`);
                  }
                } catch (e) {
                  // Ignore JSON parse errors
                }
              }
              
              // If not found, try regex patterns
              if (!username) {
                const patterns = [
                  // Look for owner data in JSON-LD or script tags
                  /"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                  /"username":\s*"([^"]+)"[^}]*"owner"/i,
                  /"ownerUsername":\s*"([^"]+)"/i,
                  // Look for profile links
                  /instagram\.com\/([a-zA-Z0-9._]+)[^\/\?"']*["']/i,
                  // Look for meta tags
                  /<meta[^>]*property=["']og:url["'][^>]*content=["']https?:\/\/www\.instagram\.com\/([^\/\?"']+)/i,
                  // Look for canonical URL
                  /<link[^>]*rel=["']canonical["'][^>]*href=["']https?:\/\/www\.instagram\.com\/([^\/\?"']+)/i,
                ];
                
                for (const pattern of patterns) {
                  const matches = htmlText.matchAll(new RegExp(pattern.source, 'gi'));
                  for (const match of matches) {
                    if (match[1] && match[1] !== 'p' && match[1] !== 'reel' && match[1] !== 'static' && match[1].length > 1) {
                      username = match[1];
                      console.log(`[Instagram Collector] ✅ Extracted username from Instagram page HTML using pattern: ${username}`);
                      break;
                    }
                  }
                  if (username) break;
                }
              }
            }
          } catch (htmlError) {
            console.log(`[Instagram Collector] Failed to fetch Instagram page: ${htmlError instanceof Error ? htmlError.message : 'Unknown'}`);
          }
        }
        
        // Try the actor - user says they just provide the URL and Apify handles the rest
        // So let's try calling it with just the URL first (like the user does manually)
        // If it fails with "username required", we'll extract username and retry
        try {
          // Try multiple input formats - start with just URL (like user does manually)
          // If we already have username, include it; otherwise try without first
          const inputFormats = username ? [
            // If we have username, try with it
            { inputUrl: instagramUrl, username: username },
            { inputUrls: [instagramUrl], username: username },
            { startUrls: [{ url: instagramUrl }], username: username },
            { urls: [instagramUrl], username: username },
            { postURLs: [instagramUrl], username: username },
            { directUrls: [instagramUrl], username: username },
            { url: instagramUrl, username: username },
            { postUrl: instagramUrl, username: username },
          ] : [
            // Try without username first (like user does manually on Apify console)
            // The actor should be able to extract it from the URL
            { inputUrl: instagramUrl },
            { inputUrls: [instagramUrl] },
            { startUrls: [{ url: instagramUrl }] },
            { urls: [instagramUrl] },
            { postURLs: [instagramUrl] },
            { directUrls: [instagramUrl] },
            { url: instagramUrl },
            { postUrl: instagramUrl },
          ];
        
        for (const input of inputFormats) {
          try {
            console.log(`[Instagram Collector] Trying actor xMc5Ga1oCONPmWJIa with input format:`, Object.keys(input)[0], `Input:`, JSON.stringify(input));
            const run = await this.apifyClient.actor('xMc5Ga1oCONPmWJIa').call({
              ...input,
              resultsLimit: 1,
            });
            console.log(`[Instagram Collector] Actor run started: ${run.id}`);
            
            console.log(`[Instagram Collector] Waiting for actor run ${run.id} to finish (max 120 seconds)...`);
            const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 120 });
            console.log(`[Instagram Collector] Actor run ${run.id} finished with status: ${finishedRun.status}`);
            
            if (finishedRun.status === 'SUCCEEDED') {
              const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
              console.log(`[Instagram Collector] Dataset has ${items?.length || 0} items`);
              if (items && items.length > 0) {
                const mediaData = items[0] as any;
                console.log(`[Instagram Collector] ✅ Actor xMc5Ga1oCONPmWJIa succeeded!`);
                console.log(`[Instagram Collector] Media data keys:`, Object.keys(mediaData));
                console.log(`[Instagram Collector] Full media data sample:`, JSON.stringify(mediaData, null, 2).substring(0, 2000));
                
                // If we didn't have username before, try to extract it from the response
                if (!username && mediaData.ownerUsername) {
                  username = mediaData.ownerUsername;
                  console.log(`[Instagram Collector] ✅ Extracted username from actor response: ${username}`);
                }
                
                // Also check other possible fields for username
                if (!username) {
                  const possibleUsername = mediaData.owner?.username || 
                                         mediaData.user?.username ||
                                         mediaData.username ||
                                         mediaData.ownerUsername;
                  if (possibleUsername) {
                    username = possibleUsername;
                    console.log(`[Instagram Collector] ✅ Extracted username from actor response (alternative field): ${username}`);
                  }
                }
                
                // Extract metrics from various possible field names
                // Priority: Check for the xMc5Ga1oCONPmWJIa actor's response format first
                const views = mediaData.videoViewCount || 
                            mediaData.videoPlayCount || 
                            mediaData.playCount || 
                            mediaData.viewCount || 
                            mediaData.video_views ||
                            mediaData.views ||
                            mediaData.view_count ||
                            mediaData.play_count ||
                            0;
                
                const likes = mediaData.likesCount || 
                            mediaData.likeCount || 
                            mediaData.likes || 
                            mediaData.like_count ||
                            mediaData.edge_media_preview_like?.count ||
                            0;
                
                const comments = mediaData.commentsCount || 
                               mediaData.commentCount || 
                               mediaData.comments || 
                               mediaData.comment_count ||
                               mediaData.edge_media_to_comment?.count ||
                               0;
                
                const shares = mediaData.sharesCount || 
                             mediaData.shareCount || 
                             mediaData.shares || 
                             mediaData.share_count ||
                             0;
                
                console.log(`[Instagram Collector] Extracted metrics - views: ${views}, likes: ${likes}, comments: ${comments}, shares: ${shares}`);
                
                if (views > 0 || likes > 0 || comments > 0 || shares > 0) {
                  return {
                    views: views || 0,
                    likes: likes || 0,
                    comments: comments || 0,
                    shares: shares || 0,
                  };
                } else {
                  console.log(`[Instagram Collector] ⚠️ Actor xMc5Ga1oCONPmWJIa returned data but no metrics found`);
                }
              } else {
                console.log(`[Instagram Collector] ⚠️ Actor xMc5Ga1oCONPmWJIa returned no items`);
              }
            } else {
              const runDetails = await this.apifyClient.run(run.id).get();
              console.log(`[Instagram Collector] ❌ Actor xMc5Ga1oCONPmWJIa status: ${finishedRun.status}, message: ${runDetails?.statusMessage || 'none'}`);
              
              // If the error says username is required and we don't have it, try to extract from error or logs
              if (!username && runDetails?.statusMessage?.includes('username')) {
                console.log(`[Instagram Collector] Actor requires username but we don't have it yet. Will try to extract from other methods.`);
              }
              
              // Try to get error logs
              try {
                const runLog = await this.apifyClient.run(run.id).log().get();
                const logText = typeof runLog === 'string' ? runLog : JSON.stringify(runLog);
                const logSnippet = logText.length > 2000 ? logText.substring(logText.length - 2000) : logText;
                console.log(`[Instagram Collector] Last 2000 chars of log:`, logSnippet);
              } catch (logError) {
                console.log(`[Instagram Collector] Could not fetch logs: ${logError instanceof Error ? logError.message : 'Unknown'}`);
              }
            }
          } catch (formatError) {
            const errorMsg = formatError instanceof Error ? formatError.message : 'Unknown';
            console.log(`[Instagram Collector] ❌ Actor xMc5Ga1oCONPmWJIa with ${Object.keys(input)[0]} failed:`, errorMsg);
            
            // If error says username is required, and we tried without username, extract it and retry
            if (!username && errorMsg.includes('username')) {
              console.log(`[Instagram Collector] Actor requires username. Extracting from Instagram page HTML and retrying...`);
              
              // Try to extract username from Instagram page HTML
              try {
                const response = await fetch(instagramUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  },
                });
                
                if (response.ok) {
                  const htmlText = await response.text();
                  console.log(`[Instagram Collector] Fetched HTML page (${htmlText.length} chars), searching for username...`);
                  
                  // First, try to extract from window._sharedData (most reliable)
                  const sharedDataMatch = htmlText.match(/window\._sharedData\s*=\s*({.+?});/);
                  if (sharedDataMatch) {
                    try {
                      const sharedData = JSON.parse(sharedDataMatch[1]);
                      const ownerUsername = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.owner?.username ||
                                          sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media?.ownerUsername;
                      if (ownerUsername) {
                        username = ownerUsername;
                        console.log(`[Instagram Collector] ✅ Extracted username from window._sharedData: ${username}`);
                      }
                    } catch (e) {
                      // Ignore JSON parse errors
                    }
                  }
                  
                  // If not found, try regex patterns
                  if (!username) {
                    const patterns = [
                      /"ownerUsername":\s*"([^"]+)"/i,
                      /"username":\s*"([^"]+)"[^}]*"owner"/i,
                      /"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                      /"user":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                      /instagram\.com\/([a-zA-Z0-9._]+)[^\/\?"']*["']/i,
                      /"shortcode_media":\s*\{[^}]*"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                      /"graphql":\s*\{[^}]*"shortcode_media":\s*\{[^}]*"owner":\s*\{[^}]*"username":\s*"([^"]+)"/i,
                    ];
                    
                    for (const pattern of patterns) {
                      const match = htmlText.match(pattern);
                      if (match && match[1] && match[1] !== 'p' && match[1] !== 'reel' && match[1].length > 1) {
                        username = match[1];
                        console.log(`[Instagram Collector] ✅ Extracted username from page HTML: ${username}`);
                      
                      // Retry with this username
                      const retryInput = { ...input, username: username };
                      try {
                        console.log(`[Instagram Collector] Retrying actor with extracted username: ${username}...`);
                        const retryRun = await this.apifyClient.actor('xMc5Ga1oCONPmWJIa').call({
                          ...retryInput,
                          resultsLimit: 1,
                        });
                        const retryFinished = await this.apifyClient.run(retryRun.id).waitForFinish({ waitSecs: 120 });
                        
                        if (retryFinished.status === 'SUCCEEDED') {
                          const { items } = await this.apifyClient.dataset(retryFinished.defaultDatasetId).listItems();
                          if (items && items.length > 0) {
                            const mediaData = items[0] as any;
                            console.log(`[Instagram Collector] ✅ Retry succeeded!`);
                            
                            // Extract metrics
                            const views = mediaData.videoViewCount || mediaData.videoPlayCount || mediaData.playCount || mediaData.viewCount || 0;
                            const likes = mediaData.likesCount || mediaData.likeCount || mediaData.likes || 0;
                            const comments = mediaData.commentsCount || mediaData.commentCount || mediaData.comments || 0;
                            const shares = mediaData.sharesCount || mediaData.shareCount || mediaData.shares || 0;
                            
                            if (views > 0 || likes > 0 || comments > 0 || shares > 0) {
                              return {
                                views: views || 0,
                                likes: likes || 0,
                                comments: comments || 0,
                                shares: shares || 0,
                              };
                            }
                          }
                        }
                      } catch (retryError) {
                        console.log(`[Instagram Collector] Retry with username also failed: ${retryError instanceof Error ? retryError.message : 'Unknown'}`);
                      }
                      break; // Found username, stop trying patterns
                      }
                    }
                  }
                }
              } catch (htmlError) {
                console.log(`[Instagram Collector] Failed to extract username from page: ${htmlError instanceof Error ? htmlError.message : 'Unknown'}`);
              }
            }
            
            if (formatError instanceof Error && formatError.stack) {
              console.log(`[Instagram Collector] Error stack:`, formatError.stack);
            }
            continue; // Try next input format
          }
        }
        } catch (actorError) {
          console.log(`[Instagram Collector] ❌ Actor xMc5Ga1oCONPmWJIa completely failed:`, actorError instanceof Error ? actorError.message : 'Unknown');
          if (actorError instanceof Error && actorError.stack) {
            console.log(`[Instagram Collector] Error stack:`, actorError.stack);
          }
        }
      } catch (strategy1Error) {
        console.log(`[Instagram Collector] Strategy 1 (xMc5Ga1oCONPmWJIa) failed:`, strategy1Error instanceof Error ? strategy1Error.message : 'Unknown');
      }

      // Strategy 2: Try different Apify actors and input formats (fallback)
      console.log(`[Instagram Collector] Strategy 2: Trying other Apify actors with different input formats`);
      
      // Try multiple Apify actors and input formats
      const apifyActors = [
        { id: 'apify/instagram-reel-scraper', inputs: [
          { startUrls: [{ url: instagramUrl }] },
          { directUrls: [instagramUrl] },
          { postUrls: [instagramUrl] },
        ]},
        { id: 'apify/instagram-post-scraper', inputs: [
          { startUrls: [{ url: instagramUrl }] },
          { urls: [instagramUrl] },
        ]},
        { id: 'apify/instagram-scraper', inputs: [
          { startUrls: [{ url: instagramUrl }] },
          { urls: [instagramUrl] },
        ]},
      ];
      
      for (const actorConfig of apifyActors) {
        for (const input of actorConfig.inputs) {
          try {
            console.log(`[Instagram Collector] Trying ${actorConfig.id} with input:`, Object.keys(input)[0]);
            const run = await this.apifyClient.actor(actorConfig.id).call({
              ...input,
              resultsLimit: 1,
            });
            
            const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
            
            if (finishedRun.status === 'SUCCEEDED') {
              const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
              if (items && items.length > 0) {
                const mediaData = items[0] as any;
                console.log(`[Instagram Collector] ✅ ${actorConfig.id} succeeded with ${Object.keys(input)[0]}!`);
                console.log(`[Instagram Collector] Media data keys:`, Object.keys(mediaData));
                console.log(`[Instagram Collector] Full media data sample:`, JSON.stringify(mediaData, null, 2).substring(0, 1500));
                
                // Extract metrics from various possible field names
                const views = mediaData.playCount || 
                            mediaData.viewCount || 
                            mediaData.videoPlayCount || 
                            mediaData.video_views ||
                            mediaData.views ||
                            mediaData.view_count ||
                            0;
                
                const likes = mediaData.likesCount || 
                            mediaData.likeCount || 
                            mediaData.likes || 
                            mediaData.like_count ||
                            0;
                
                const comments = mediaData.commentsCount || 
                               mediaData.commentCount || 
                               mediaData.comments || 
                               mediaData.comment_count ||
                               0;
                
                const shares = mediaData.sharesCount || 
                             mediaData.shareCount || 
                             mediaData.shares || 
                             mediaData.share_count ||
                             0;
                
                if (views > 0 || likes > 0 || comments > 0 || shares > 0) {
                  return {
                    views: views || 0,
                    likes: likes || 0,
                    comments: comments || 0,
                    shares: shares || 0,
                  };
                } else {
                  console.log(`[Instagram Collector] ⚠️ ${actorConfig.id} returned data but no metrics found`);
                }
              } else {
                console.log(`[Instagram Collector] ⚠️ ${actorConfig.id} returned no items`);
              }
            } else {
              const runDetails = await this.apifyClient.run(run.id).get();
              console.log(`[Instagram Collector] ${actorConfig.id} status: ${finishedRun.status}, message: ${runDetails?.statusMessage || 'none'}`);
            }
          } catch (actorError) {
            console.log(`[Instagram Collector] ${actorConfig.id} with ${Object.keys(input)[0]} failed: ${actorError instanceof Error ? actorError.message : 'Unknown'}`);
            continue; // Try next combination
          }
        }
      }

      // Strategy 3: Try Instagram's public JSON endpoint (works without username)
      if (shortcode) {
        console.log(`[Instagram Collector] Strategy 3: Trying Instagram public JSON endpoint for: ${shortcode}`);
        try {
          // Try both post and reel formats
          const jsonUrls = [
            `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
            `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`,
          ];
          
          for (const jsonUrl of jsonUrls) {
            try {
              const response = await fetch(jsonUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/json',
                },
              });
              
              if (response.ok) {
                const jsonData = await response.json() as any;
                console.log(`[Instagram Collector] JSON response keys:`, Object.keys(jsonData));
                
                // Try multiple possible data structures
                const mediaData = jsonData?.graphql?.shortcode_media || 
                                jsonData?.items?.[0] || 
                                jsonData?.data || 
                                jsonData;
                
                if (mediaData) {
                  // Extract metrics from various possible field names
                  const views = mediaData?.video_view_count || 
                              mediaData?.play_count || 
                              mediaData?.view_count || 
                              mediaData?.video_play_count ||
                              mediaData?.views || 0;
                  
                  const likes = mediaData?.edge_media_preview_like?.count || 
                              mediaData?.like_count || 
                              mediaData?.likes?.count ||
                              mediaData?.likes || 0;
                  
                  const comments = mediaData?.edge_media_to_comment?.count || 
                                  mediaData?.comment_count || 
                                  mediaData?.comments?.count ||
                                  mediaData?.comments || 0;
                  
                  const shares = mediaData?.edge_media_to_parent_comment?.count || 
                               mediaData?.share_count || 
                               mediaData?.shares?.count ||
                               mediaData?.shares || 0;
                  
                  // If we got any metrics, return them
                  if (views > 0 || likes > 0 || comments > 0 || shares > 0) {
                    console.log(`[Instagram Collector] ✅ Successfully fetched from Instagram JSON!`);
                    return {
                      views: views || 0,
                      likes: likes || 0,
                      comments: comments || 0,
                      shares: shares || 0,
                    };
                  }
                }
              }
            } catch (jsonError) {
              continue; // Try next URL format
            }
          }
        } catch (jsonError) {
          console.log(`[Instagram Collector] JSON endpoint failed: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`);
        }
      }

      // Strategy 4: Try oEmbed API to get username, then use Apify
      console.log(`[Instagram Collector] Strategy 4: Trying oEmbed API to extract username`);
      let username: string | undefined;
      
      // Extract username from URL if available
      try {
        const urlMatch = instagramUrl.match(/instagram\.com\/([^\/]+)\/(p|reel)\//);
        if (urlMatch && urlMatch[1] && urlMatch[1] !== 'p' && urlMatch[1] !== 'reel') {
          username = urlMatch[1];
        }
      } catch (e) {
        // Ignore
      }

      if (!username) {
        try {
          const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(instagramUrl)}`;
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
            const oembedData = await response.json() as any;
            console.log(`[Instagram Collector] oEmbed data:`, JSON.stringify(oembedData, null, 2));
            
            const authorUrl = oembedData.author_url || oembedData.authorUrl;
            if (authorUrl) {
              const authorMatch = authorUrl.match(/instagram\.com\/([^\/\?]+)/);
              if (authorMatch && authorMatch[1]) {
                username = authorMatch[1];
                console.log(`[Instagram Collector] ✅ Extracted username from oEmbed: ${username}`);
              }
            }
            
            if (!username && oembedData.author_name) {
              username = oembedData.author_name.replace('@', '');
              console.log(`[Instagram Collector] ✅ Extracted username from author_name: ${username}`);
            }
          }
        } catch (oembedError) {
          console.log(`[Instagram Collector] oEmbed failed: ${oembedError instanceof Error ? oembedError.message : 'Unknown'}`);
        }
      }

      // Strategy 6: If we have username from oEmbed, use apify/instagram-reel-scraper with it
      if (username) {
        console.log(`[Instagram Collector] Strategy 6: Using apify/instagram-reel-scraper with extracted username: ${username}`);
        try {
          const input = {
            directUrls: [instagramUrl],
            username: username,
            resultsLimit: 1,
          };
          
          const run = await this.apifyClient.actor('apify/instagram-reel-scraper').call(input);
          const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
          
          if (finishedRun.status === 'SUCCEEDED') {
            const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
            if (items && items.length > 0) {
              const mediaData = items[0] as any;
              console.log(`[Instagram Collector] ✅ instagram-reel-scraper with username succeeded!`);
              return {
                views: mediaData.playCount || mediaData.viewCount || mediaData.videoPlayCount || 0,
                likes: mediaData.likesCount || mediaData.likeCount || mediaData.likes || 0,
                comments: mediaData.commentsCount || mediaData.commentCount || mediaData.comments || 0,
                shares: mediaData.sharesCount || mediaData.shareCount || mediaData.shares || 0,
              };
            }
          } else {
            const runDetails = await this.apifyClient.run(run.id).get();
            console.log(`[Instagram Collector] instagram-reel-scraper with username failed: ${finishedRun.status}, message: ${runDetails?.statusMessage || 'none'}`);
          }
        } catch (reelError) {
          console.log(`[Instagram Collector] instagram-reel-scraper with username failed: ${reelError instanceof Error ? reelError.message : 'Unknown'}`);
        }
      }


      // All strategies failed
      throw new Error(
        `Failed to fetch Instagram post metrics. All methods failed.\n\n` +
        `Tried:\n` +
        `- apify/instagram-reel-scraper (primary method)\n` +
        `- Other Apify actors with different input formats\n` +
        `- Instagram JSON endpoint\n` +
        `- oEmbed API for username extraction\n\n` +
        `Please try using the full URL with username:\n` +
        `✅ https://www.instagram.com/username/p/SHORTCODE/\n` +
        `Your URL: ${instagramUrl}\n\n` +
        `Check server logs for detailed error messages.`
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch media metrics: ${error.message}`);
      }
      throw new Error('Failed to fetch media metrics: Unknown error');
    }
  }

  /**
   * Resolves the author user ID for a media post
   * Tries multiple strategies to work without requiring username
   */
  async resolveMediaAuthorUserId(mediaId: string): Promise<AuthorUserInfo> {
    try {
      // Normalize URL
      let instagramUrl: string;
      
      if (mediaId.startsWith('http')) {
        instagramUrl = mediaId;
      } else {
        instagramUrl = `https://www.instagram.com/p/${mediaId}/`;
      }

      // Extract shortcode
      const shortcodeMatch = instagramUrl.match(/\/(p|reel)\/([^\/\?]+)/);
      const shortcode = shortcodeMatch ? shortcodeMatch[2] : null;

      // Strategy 1: SociaVault API - DISABLED (no /post endpoint available)
      // SociaVault only has /comments endpoint, which doesn't provide post author info directly
      // TODO: Find correct SociaVault endpoint or use alternative API
      if (false && this.sociaVaultApiKey) {
        console.log(`[Instagram Collector] Resolving author: Strategy 1 - Trying SociaVault API (DISABLED)`);
        // Disabled until we find the correct endpoint
      }

      // Strategy 2: Use the SAME successful format as metrics extraction (apify/instagram-reel-scraper)
      // This works for metrics, so it should work for author resolution too!
      console.log(`[Instagram Collector] Resolving author: Strategy 2 - Using apify/instagram-reel-scraper (same format as metrics)`);
      try {
        // Use the EXACT same format that works for metrics
        const input = {
          username: [instagramUrl],
          includeDownloadedVideo: false,
          includeSharesCount: false,
          includeTranscript: false,
          resultsLimit: 1,
          skipPinnedPosts: false,
        };
        
        try {
          console.log(`[Instagram Collector] Calling apify/instagram-reel-scraper for author with input:`, JSON.stringify(input));
          const run = await this.apifyClient.actor('apify/instagram-reel-scraper').call(input);
          const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 120 });
          
          if (finishedRun.status === 'SUCCEEDED') {
            const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
            if (items && items.length > 0) {
              const mediaData = items[0] as any;
              console.log(`[Instagram Collector] ✅ apify/instagram-reel-scraper succeeded for author!`);
              console.log(`[Instagram Collector] Author data keys:`, Object.keys(mediaData));
              console.log(`[Instagram Collector] Author data sample:`, JSON.stringify(mediaData, null, 2).substring(0, 2000));
              
              // Extract ownerId from the response (we know this format works from metrics extraction)
              const authorUserId = mediaData.ownerId || 
                                   mediaData.owner?.id || 
                                   mediaData.owner?.pk ||
                                   mediaData.userId ||
                                   mediaData.user?.id ||
                                   mediaData.user?.pk ||
                                   mediaData.authorId ||
                                   mediaData.author?.id ||
                                   mediaData.author?.pk ||
                                   mediaData.owner_id ||
                                   mediaData.user_id ||
                                   mediaData.author_id ||
                                   mediaData.owner?.userId ||
                                   mediaData.owner?.user_id;
                
              if (authorUserId) {
                console.log(`[Instagram Collector] ✅ Found author ID: ${authorUserId}`);
                return { authorUserId: authorUserId.toString() };
              }
              
              // Also try extracting from owner username (we know ownerUsername is in the response)
              const ownerUsername = mediaData.ownerUsername ||
                                    mediaData.owner?.username;
              
              if (ownerUsername) {
                console.log(`[Instagram Collector] Found owner username: ${ownerUsername}, resolving to ID...`);
                try {
                  const userInfo = await this.resolveUser(ownerUsername);
                  console.log(`[Instagram Collector] ✅ Resolved author ID from username: ${userInfo.userId}`);
                  return { authorUserId: userInfo.userId };
                } catch (resolveError) {
                  console.log(`[Instagram Collector] Failed to resolve username to ID: ${resolveError instanceof Error ? resolveError.message : 'Unknown'}`);
                }
              } else {
                console.log(`[Instagram Collector] ⚠️ No owner username found in media data`);
              }
            }
          } else {
            const runDetails = await this.apifyClient.run(run.id).get();
            console.log(`[Instagram Collector] apify/instagram-reel-scraper status: ${finishedRun.status}, message: ${runDetails?.statusMessage || 'none'}`);
          }
        } catch (actorError) {
          const errorMsg = actorError instanceof Error ? actorError.message : 'Unknown';
          console.log(`[Instagram Collector] apify/instagram-reel-scraper failed for author:`, errorMsg);
          throw actorError; // Re-throw to try next strategy
        }
      } catch (apifyError) {
        console.log(`[Instagram Collector] instagram-reel-scraper with startUrls failed: ${apifyError instanceof Error ? apifyError.message : 'Unknown'}`);
        if (apifyError instanceof Error && apifyError.stack) {
          console.log(`[Instagram Collector] Error stack:`, apifyError.stack);
        }
      }

      // Strategy 2: Try Instagram's public JSON endpoint
      if (shortcode) {
        console.log(`[Instagram Collector] Resolving author: Strategy 2 - Trying Instagram JSON for: ${shortcode}`);
        try {
          const jsonUrls = [
            `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
            `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`,
          ];
          
          for (const jsonUrl of jsonUrls) {
            try {
              const response = await fetch(jsonUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/json',
                },
              });
              
              if (response.ok) {
                const jsonData = await response.json() as any;
                const mediaData = jsonData?.graphql?.shortcode_media || 
                                jsonData?.items?.[0] || 
                                jsonData?.data || 
                                jsonData;
                
                if (mediaData) {
                  const authorUserId = mediaData?.owner?.id || 
                                     mediaData?.user?.id ||
                                     mediaData?.owner_id ||
                                     mediaData?.user_id;
                  
                  if (authorUserId) {
                    console.log(`[Instagram Collector] ✅ Extracted author ID from JSON: ${authorUserId}`);
                    return { authorUserId: authorUserId.toString() };
                  }
                }
              }
            } catch (jsonError) {
              continue;
            }
          }
        } catch (jsonError) {
          console.log(`[Instagram Collector] JSON endpoint failed for author: ${jsonError instanceof Error ? jsonError.message : 'Unknown'}`);
        }
      }

      // Strategy 3: Try oEmbed API to get username, then resolve
      console.log(`[Instagram Collector] Resolving author: Strategy 3 - Trying oEmbed API`);
      let username: string | undefined;
      try {
        const urlMatch = instagramUrl.match(/instagram\.com\/([^\/]+)\/(p|reel)\//);
        if (urlMatch && urlMatch[1] && urlMatch[1] !== 'p' && urlMatch[1] !== 'reel') {
          username = urlMatch[1];
        }
      } catch (e) {
        // Ignore
      }

      if (!username) {
        try {
          const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(instagramUrl)}`;
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
            const oembedData = await response.json() as any;
            const authorUrl = oembedData.author_url || oembedData.authorUrl;
            if (authorUrl) {
              const authorMatch = authorUrl.match(/instagram\.com\/([^\/\?]+)/);
              if (authorMatch && authorMatch[1]) {
                username = authorMatch[1];
                console.log(`[Instagram Collector] ✅ Extracted username from oEmbed: ${username}`);
              }
            }
            
            if (!username && oembedData.author_name) {
              username = oembedData.author_name.replace('@', '');
              console.log(`[Instagram Collector] ✅ Extracted username from author_name: ${username}`);
            }
          }
        } catch (oembedError) {
          console.log(`[Instagram Collector] oEmbed failed: ${oembedError instanceof Error ? oembedError.message : 'Unknown'}`);
        }
      }

      // Strategy 4: Use Apify with username if we have it
      if (username) {
        console.log(`[Instagram Collector] Resolving author: Strategy 4 - Using Apify with extracted username: ${username}`);
        try {
          const input = {
            directUrls: [instagramUrl],
            username: username,
            resultsLimit: 1,
          };
          
          const run = await this.apifyClient.actor('apify/instagram-reel-scraper').call(input);
          const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
          
          if (finishedRun.status === 'SUCCEEDED') {
            const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
            if (items && items.length > 0) {
              const mediaData = items[0] as any;
              const authorUserId = mediaData.ownerId || 
                                 mediaData.owner?.id || 
                                 mediaData.userId ||
                                 mediaData.authorId;
              
              if (authorUserId) {
                console.log(`[Instagram Collector] ✅ Extracted author ID from Apify with username: ${authorUserId}`);
                return { authorUserId: authorUserId.toString() };
              }
            }
          }
        } catch (apifyError) {
          console.log(`[Instagram Collector] Apify with username failed: ${apifyError instanceof Error ? apifyError.message : 'Unknown'}`);
        }
        
        // Strategy 4b: If we have username, try resolving it directly
        try {
          const userInfo = await this.resolveUser(username);
          console.log(`[Instagram Collector] ✅ Resolved author ID from username via profile scraper: ${userInfo.userId}`);
          return { authorUserId: userInfo.userId };
        } catch (resolveError) {
          console.log(`[Instagram Collector] Failed to resolve username to ID: ${resolveError instanceof Error ? resolveError.message : 'Unknown'}`);
        }
      }

      // Strategy 5: Try alternative Apify actors
      console.log(`[Instagram Collector] Resolving author: Strategy 5 - Trying alternative Apify actors`);
      const alternativeActors = [
        'apify/instagram-post-scraper',
        'apify/instagram-scraper',
      ];
      
      for (const actorId of alternativeActors) {
        try {
          const input = {
            startUrls: [{ url: instagramUrl }],
            resultsLimit: 1,
          };
          
          const run = await this.apifyClient.actor(actorId).call(input);
          const finishedRun = await this.apifyClient.run(run.id).waitForFinish({ waitSecs: 60 });
          
          if (finishedRun.status === 'SUCCEEDED') {
            const { items } = await this.apifyClient.dataset(finishedRun.defaultDatasetId).listItems();
            if (items && items.length > 0) {
              const mediaData = items[0] as any;
              const authorUserId = mediaData.ownerId || 
                                 mediaData.owner?.id || 
                                 mediaData.userId ||
                                 mediaData.authorId;
              
              if (authorUserId) {
                console.log(`[Instagram Collector] ✅ Extracted author ID from ${actorId}: ${authorUserId}`);
                return { authorUserId: authorUserId.toString() };
              }
            }
          }
        } catch (altError) {
          console.log(`[Instagram Collector] Actor ${actorId} failed: ${altError instanceof Error ? altError.message : 'Unknown'}`);
          continue;
        }
      }

      throw new Error(
        `Failed to resolve Instagram post author. All methods failed.\n\n` +
        `Tried:\n` +
        `- Apify actor xMc5Ga1oCONPmWJIa (primary method)\n` +
        `- instagram-reel-scraper with startUrls\n` +
        `- Instagram JSON endpoint\n` +
        `- oEmbed API\n` +
        `- Alternative Apify actors\n\n` +
        `Please try using the full URL with username:\n` +
        `✅ https://www.instagram.com/username/p/SHORTCODE/\n` +
        `Your URL: ${instagramUrl}\n\n` +
        `Check server logs for detailed error messages. SociaVault API key configured: ${this.sociaVaultApiKey ? 'Yes' : 'No'}`
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve media author: ${error.message}`);
      }
      throw new Error('Failed to resolve media author: Unknown error');
    }
  }
}
