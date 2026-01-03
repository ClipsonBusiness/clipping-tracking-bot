/**
 * Platform Detection Utility
 * Automatically detects the platform (YouTube, TikTok, Instagram) from a URL
 */

export type Platform = 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | null;

/**
 * Detects the platform from a URL
 * @param url - The URL to analyze
 * @returns The detected platform or null if unknown
 */
export function detectPlatformFromUrl(url: string): Platform {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    // YouTube detection
    if (
      hostname.includes('youtube.com') ||
      hostname.includes('youtu.be') ||
      hostname.includes('youtube-nocookie.com')
    ) {
      return 'YOUTUBE';
    }

    // TikTok detection
    if (
      hostname.includes('tiktok.com') ||
      hostname.includes('vm.tiktok.com') ||
      hostname.includes('vt.tiktok.com')
    ) {
      return 'TIKTOK';
    }

    // Instagram detection
    if (
      hostname.includes('instagram.com') ||
      hostname.includes('instagr.am')
    ) {
      return 'INSTAGRAM';
    }

    return null;
  } catch (error) {
    // If URL parsing fails, try simple string matching
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'YOUTUBE';
    }
    if (urlLower.includes('tiktok.com')) {
      return 'TIKTOK';
    }
    if (urlLower.includes('instagram.com')) {
      return 'INSTAGRAM';
    }

    return null;
  }
}

/**
 * Converts platform enum to lowercase route format
 */
export function platformToRoute(platform: Platform): string | null {
  if (!platform) return null;
  return platform.toLowerCase();
}

