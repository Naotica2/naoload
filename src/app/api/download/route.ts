import { NextRequest, NextResponse } from 'next/server';

// Free APIs without API key requirement

// Detect platform from URL
function detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'unknown' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
    // Handle all YouTube URL formats:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://youtu.be/VIDEO_ID?si=xxxxx
    // https://youtube.com/shorts/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID

    const patterns = [
        /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// TikTok download using tikwm.com (free, no API key)
async function downloadTikTok(url: string) {
    console.log('Downloading TikTok:', url);

    const response = await fetch('https://tikwm.com/api/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: `url=${encodeURIComponent(url)}&hd=1`,
    });

    const data = await response.json();
    console.log('TikWM response:', JSON.stringify(data).substring(0, 500));

    if (data.code === 0 && data.data) {
        const videoUrl = data.data.hdplay || data.data.play;
        if (videoUrl) {
            return {
                status: 'redirect',
                url: videoUrl,
                filename: 'tiktok_video.mp4',
                thumb: data.data.cover,
            };
        }
    }

    throw new Error(data.msg || 'TikTok download failed');
}

// Instagram download using multiple APIs
async function downloadInstagram(url: string) {
    console.log('Downloading Instagram:', url);

    // Try igdownloader.app API
    try {
        const response = await fetch('https://igdownloader.app/api/ajaxSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
        });

        const data = await response.json();
        console.log('IG response:', JSON.stringify(data).substring(0, 500));

        if (data.status === 'ok' && data.data) {
            // Parse HTML response to get download links
            const urlMatch = data.data.match(/href="([^"]+download[^"]+)"/);
            if (urlMatch && urlMatch[1]) {
                return {
                    status: 'redirect',
                    url: urlMatch[1].replace(/&amp;/g, '&'),
                    filename: 'instagram_media',
                };
            }
        }
    } catch (e) {
        console.log('First IG API failed:', e);
    }

    throw new Error('Instagram download failed - try a different link');
}

// YouTube download
async function downloadYouTube(url: string) {
    console.log('Downloading YouTube:', url);

    const videoId = extractYouTubeId(url);
    if (!videoId) {
        throw new Error('Could not extract YouTube video ID from URL');
    }

    console.log('Extracted video ID:', videoId);

    // Try multiple YouTube download APIs

    // API 1: y2mate style
    try {
        const response = await fetch(`https://ab.cococococ.com/ajax/download.php?format=mp4&url=${encodeURIComponent(`https://youtube.com/watch?v=${videoId}`)}`);
        const data = await response.json();
        console.log('YT API 1 response:', JSON.stringify(data).substring(0, 500));

        if (data.success && data.download_url) {
            return {
                status: 'redirect',
                url: data.download_url,
                filename: `youtube_${videoId}.mp4`,
            };
        }
    } catch (e) {
        console.log('YT API 1 failed:', e);
    }

    // API 2: yt1s style
    try {
        const response = await fetch(`https://yt1s.com/api/ajaxSearch/index`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodeURIComponent(`https://youtube.com/watch?v=${videoId}`)}&vt=mp4`,
        });
        const data = await response.json();
        console.log('YT API 2 response:', JSON.stringify(data).substring(0, 500));

        if (data.status === 'ok' && data.links?.mp4) {
            const mp4Links = Object.values(data.links.mp4) as Array<{ k: string; q: string }>;
            if (mp4Links.length > 0) {
                // Get the convert URL for the highest quality
                const bestQuality = mp4Links[0];
                return {
                    status: 'redirect',
                    url: `https://yt1s.com/api/ajaxConvert/convert?vid=${videoId}&k=${bestQuality.k}`,
                    filename: `youtube_${videoId}.mp4`,
                    quality: bestQuality.q,
                };
            }
        }
    } catch (e) {
        console.log('YT API 2 failed:', e);
    }

    // Fallback: Return embed URL (user can use browser to download)
    return {
        status: 'redirect',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        filename: `youtube_${videoId}.mp4`,
        note: 'Direct YouTube link - use browser extension to download',
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        const platform = detectPlatform(url);
        console.log('Download request:', { url, platform });

        if (platform === 'unknown') {
            return NextResponse.json({
                status: 'error',
                error: { code: 'Platform not supported. Try TikTok, Instagram, or YouTube.' },
            }, { status: 400 });
        }

        let result;

        switch (platform) {
            case 'tiktok':
                result = await downloadTikTok(url);
                break;
            case 'instagram':
                result = await downloadInstagram(url);
                break;
            case 'youtube':
                result = await downloadYouTube(url);
                break;
            default:
                return NextResponse.json({
                    status: 'error',
                    error: { code: 'Platform not yet implemented' },
                }, { status: 400 });
        }

        console.log('Download result:', result);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Download error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { status: 'error', error: { code: errorMessage } },
            { status: 500 }
        );
    }
}
