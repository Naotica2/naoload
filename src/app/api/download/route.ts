import { NextRequest, NextResponse } from 'next/server';

const RAPIDAPI_HOST = 'download-all-in-one2.p.rapidapi.com';
const MAX_POLL_ATTEMPTS = 30; // Max 30 attempts (about 30 seconds)
const POLL_INTERVAL = 1000; // 1 second between polls

interface MediaResult {
    index: number;
    download_url: string;
    media_type: string;
    alternative_download_urls?: string[];
}

interface ApiResponse {
    status: string;
    error: boolean;
    message?: string;
    url: string;
    uid: string;
    progress: number;
    media_result?: MediaResult[];
    audio_url?: string;
}

// Sleep helper
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Detect if URL is YouTube Music
function isYouTubeMusic(url: string): boolean {
    return url.includes('music.youtube.com');
}

// Call the download API with polling
async function downloadMedia(url: string, apiKey: string, type: 'video' | 'audio' = 'video'): Promise<{
    status: string;
    url: string;
    filename: string;
    thumb?: string;
    title?: string;
    quality?: string;
}> {
    // Use /music endpoint for YouTube Music, otherwise /media
    const isMusic = isYouTubeMusic(url);
    const endpoint = isMusic
        ? `https://${RAPIDAPI_HOST}/api/v1/download/music`
        : `https://${RAPIDAPI_HOST}/api/v1/download/media`;

    let lastResponse: ApiResponse | null = null;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, video_quality: 1080 }),
        });

        const data: ApiResponse = await response.json();
        lastResponse = data;

        console.log(`Poll attempt ${attempt + 1}:`, { status: data.status, progress: data.progress, error: data.error });

        if (data.error) {
            throw new Error(data.message || 'API returned an error');
        }

        if (data.status === 'Success') {
            // Success! Determine which URL to return
            let downloadUrl: string | undefined;
            let fileExt = 'mp4';

            if (type === 'audio' && data.audio_url) {
                // User wants audio only
                downloadUrl = data.audio_url;
                fileExt = 'mp3';
            } else if (data.media_result && data.media_result.length > 0) {
                // Return video
                downloadUrl = data.media_result[0].download_url;
                fileExt = 'mp4';
            } else if (data.audio_url) {
                // Fallback to audio if no video
                downloadUrl = data.audio_url;
                fileExt = 'mp3';
            }

            if (downloadUrl) {
                return {
                    status: 'redirect',
                    url: downloadUrl,
                    filename: `download_${Date.now()}.${fileExt}`,
                    quality: type === 'audio' ? 'Audio' : (data.media_result?.[0]?.media_type || 'Video'),
                };
            }
        }

        if (data.status === 'Failed') {
            throw new Error(data.message || 'Download failed');
        }

        // Still processing, wait before next poll
        if (attempt < MAX_POLL_ATTEMPTS - 1) {
            await sleep(POLL_INTERVAL);
        }
    }

    // Timeout
    console.error('API polling timeout. Last response:', lastResponse);
    throw new Error('Download timed out. Please try again.');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, type = 'video' } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        const apiKey = process.env.RAPIDAPI_KEY;
        if (!apiKey) {
            return NextResponse.json({ status: 'error', error: { code: 'API key not configured' } }, { status: 500 });
        }

        console.log('Download request:', { url, type, hasApiKey: !!apiKey });

        const result = await downloadMedia(url, apiKey, type);

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
