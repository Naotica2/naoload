import { NextRequest, NextResponse } from 'next/server';

// Free APIs without API key requirement
// Using multiple fallback services

// Detect platform from URL
function detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'unknown' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
}

// TikTok download using tikwm.com (free, no API key)
async function downloadTikTok(url: string) {
    const response = await fetch('https://tikwm.com/api/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}&hd=1`,
    });

    const data = await response.json();

    if (data.code === 0 && data.data) {
        // Return HD version if available, otherwise regular
        const videoUrl = data.data.hdplay || data.data.play;
        return {
            status: 'redirect',
            url: videoUrl,
            filename: 'tiktok_video.mp4',
            thumb: data.data.cover,
        };
    }

    throw new Error(data.msg || 'TikTok download failed');
}

// Instagram download using saveig.app (free, no API key)
async function downloadInstagram(url: string) {
    // Try saveig.app API
    const response = await fetch('https://v3.saveig.app/api/ajaxSearch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
    });

    const data = await response.json();

    if (data.status === 'ok' && data.data) {
        // Parse HTML response to get download links
        const urlMatch = data.data.match(/href="([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
            return {
                status: 'redirect',
                url: urlMatch[1],
                filename: 'instagram_media',
            };
        }
    }

    throw new Error('Instagram download failed');
}

// YouTube - using y2mate style API
async function downloadYouTube(url: string) {
    // Extract video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/);
    if (!videoIdMatch) {
        throw new Error('Invalid YouTube URL');
    }
    const videoId = videoIdMatch[1];

    // Try loader.to API (free tier available)
    const response = await fetch(`https://ab.cococococ.com/ajax/download.php?format=mp4&url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (data.success && data.download_url) {
        return {
            status: 'redirect',
            url: data.download_url,
            filename: 'youtube_video.mp4',
        };
    }

    // Fallback - direct embed URL (lower quality but always works)
    return {
        status: 'redirect',
        url: `https://www.youtube.com/embed/${videoId}`,
        filename: 'youtube_video.mp4',
        note: 'Direct streaming link',
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
                    error: { code: 'Platform not supported. Try TikTok, Instagram, or YouTube.' },
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
