import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// API 1: For MP3/Audio downloads (500/day limit)
const AUDIO_API_HOST = 'youtube-info-download-api.p.rapidapi.com';

// API 2: For MP4/Video downloads - snap-video3
const VIDEO_API_HOST = 'snap-video3.p.rapidapi.com';

// Rate limits per IP per day
const RATE_LIMITS = {
    video: 4,   // 4 video downloads per day
    audio: 10,  // 10 audio downloads per day
};

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL = 2000;

interface AudioInitialResponse {
    success: boolean;
    id: string;
    title?: string;
    info?: {
        image?: string;
        title?: string;
    };
    progress_url?: string;
    message?: string;
    error?: boolean;
}

interface AudioProgressResponse {
    success: boolean;
    progress?: number;
    download_url?: string;
    text?: string;
    error?: boolean;
}

interface SnapVideoMedia {
    url: string;
    quality: string;
    extension: string;
    size: number | string;
    formattedSize?: string | null;
    videoAvailable: boolean;
    audioAvailable: boolean;
    chunked: boolean;
    cached: boolean;
}

interface SnapVideoResponse {
    url?: string;
    title?: string;
    thumbnail?: string;
    duration?: string;
    source?: string;
    medias?: SnapVideoMedia[];
    error?: string;
    message?: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function detectPlatform(url: string): string {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('music.youtube.com')) return 'youtube-music';
    return 'other';
}

// Get client IP from request headers
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    return 'unknown';
}

// Check if user has exceeded rate limit
async function checkRateLimit(ip: string, type: 'video' | 'audio'): Promise<{ allowed: boolean; remaining: number }> {
    const limit = RATE_LIMITS[type];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        const { data, error } = await supabase
            .from('download_limits')
            .select('download_count')
            .eq('ip_address', ip)
            .eq('download_type', type)
            .eq('download_date', today)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Rate limit check error:', error);
            return { allowed: true, remaining: limit }; // Allow on error
        }

        const currentCount = data?.download_count || 0;
        const remaining = Math.max(0, limit - currentCount);

        return {
            allowed: currentCount < limit,
            remaining: remaining
        };
    } catch (err) {
        console.error('Rate limit check failed:', err);
        return { allowed: true, remaining: limit }; // Allow on error
    }
}

// Increment download count for IP
async function incrementDownloadCount(ip: string, type: 'video' | 'audio'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
        // Try to upsert the record
        const { error } = await supabase
            .from('download_limits')
            .upsert(
                {
                    ip_address: ip,
                    download_type: type,
                    download_date: today,
                    download_count: 1,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'ip_address,download_type,download_date',
                    ignoreDuplicates: false
                }
            );

        if (error) {
            // If upsert fails, try increment instead
            const { data: existing } = await supabase
                .from('download_limits')
                .select('download_count')
                .eq('ip_address', ip)
                .eq('download_type', type)
                .eq('download_date', today)
                .single();

            if (existing) {
                await supabase
                    .from('download_limits')
                    .update({
                        download_count: existing.download_count + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('ip_address', ip)
                    .eq('download_type', type)
                    .eq('download_date', today);
            }
        }
    } catch (err) {
        console.error('Failed to increment download count:', err);
    }
}

// Download MP3/Audio using youtube-info-download-api
async function downloadAudio(url: string, apiKey: string): Promise<{
    status: string;
    url: string;
    filename: string;
    thumb?: string;
    title?: string;
    quality?: string;
}> {
    const apiUrl = new URL(`https://${AUDIO_API_HOST}/ajax/download.php`);
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('format', 'mp3');
    apiUrl.searchParams.set('add_info', '0');
    apiUrl.searchParams.set('audio_quality', '128');
    apiUrl.searchParams.set('allow_extended_duration', 'false');
    apiUrl.searchParams.set('no_merge', 'false');
    apiUrl.searchParams.set('audio_language', 'en');

    console.log('Calling Audio API:', apiUrl.toString());

    const initialResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
            'x-rapidapi-host': AUDIO_API_HOST,
            'x-rapidapi-key': apiKey,
        },
    });

    if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        console.error('Audio API Error:', errorText);
        throw new Error(`Audio API request failed: ${initialResponse.status}`);
    }

    const initialData: AudioInitialResponse = await initialResponse.json();
    console.log('Audio API Initial Response:', JSON.stringify(initialData, null, 2));

    if (!initialData.success || initialData.error) {
        throw new Error(initialData.message || 'Audio download failed to initialize');
    }

    const title = initialData.title || initialData.info?.title || 'download';
    const thumbnail = initialData.info?.image;

    // Poll progress_url until download is ready
    if (initialData.progress_url) {
        console.log('Polling progress URL:', initialData.progress_url);

        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await sleep(POLL_INTERVAL);

            const progressResponse = await fetch(initialData.progress_url);

            if (!progressResponse.ok) {
                console.log(`Progress poll attempt ${attempt + 1} failed: ${progressResponse.status}`);
                continue;
            }

            const progressData: AudioProgressResponse = await progressResponse.json();
            console.log(`Progress poll attempt ${attempt + 1}:`, progressData);

            if (progressData.download_url) {
                return {
                    status: 'redirect',
                    url: progressData.download_url,
                    filename: `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_${Date.now()}.mp3`,
                    thumb: thumbnail,
                    title: title,
                    quality: 'MP3 128kbps',
                };
            }

            if (progressData.error) {
                throw new Error(progressData.text || 'Audio download processing failed');
            }

            if (progressData.progress !== undefined && progressData.progress < 100) {
                console.log(`Progress: ${progressData.progress}%`);
            }
        }

        throw new Error('Audio download timed out. Please try again.');
    }

    throw new Error('No progress URL returned from Audio API');
}

// Download MP4/Video using snap-video3
async function downloadVideo(url: string, apiKey: string): Promise<{
    status: string;
    url: string;
    filename: string;
    thumb?: string;
    title?: string;
    quality?: string;
}> {
    const platform = detectPlatform(url);

    console.log('Calling Video API for platform:', platform);

    // snap-video3 uses form-urlencoded format
    const response = await fetch(`https://${VIDEO_API_HOST}/download`, {
        method: 'POST',
        headers: {
            'x-rapidapi-host': VIDEO_API_HOST,
            'x-rapidapi-key': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}`,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Video API Error:', errorText);
        throw new Error(`Video API request failed: ${response.status}`);
    }

    const data: SnapVideoResponse = await response.json();
    console.log('Video API Response:', JSON.stringify(data, null, 2));

    if (data.error || data.message) {
        throw new Error(data.error || data.message || 'Video download failed');
    }

    if (!data.medias || data.medias.length === 0) {
        throw new Error('No media found for this URL');
    }

    // Find MP4 options and pick the highest quality
    const mp4Options = data.medias.filter((m: SnapVideoMedia) =>
        m.extension === 'mp4' && m.videoAvailable && m.audioAvailable
    );

    if (mp4Options.length === 0) {
        throw new Error('No MP4 download option found');
    }

    // Sort by quality (1080p > 720p > 360p)
    const qualityOrder: Record<string, number> = { '1080p': 3, '720p': 2, '360p': 1 };
    mp4Options.sort((a: SnapVideoMedia, b: SnapVideoMedia) =>
        (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0)
    );

    const bestOption = mp4Options[0];
    const title = data.title || 'video_download';

    return {
        status: 'redirect',
        url: bestOption.url,
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_${Date.now()}.mp4`,
        thumb: data.thumbnail || undefined,
        title: title,
        quality: `MP4 ${bestOption.quality}`,
    };
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

        // Get client IP and check rate limit
        const clientIP = getClientIP(request);
        const downloadType = type === 'audio' ? 'audio' : 'video';
        const rateLimit = await checkRateLimit(clientIP, downloadType);

        console.log('Rate limit check:', { clientIP, downloadType, allowed: rateLimit.allowed, remaining: rateLimit.remaining });

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    status: 'error',
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: `Daily limit reached! You can only download ${RATE_LIMITS[downloadType]} ${downloadType}s per day. Try again tomorrow.`
                    },
                    remaining: 0
                },
                { status: 429 }
            );
        }

        const platform = detectPlatform(url);
        console.log('Download request:', { url, type, platform, hasApiKey: !!apiKey });

        let result;

        if (type === 'audio') {
            // Use Audio API for MP3 downloads
            result = await downloadAudio(url, apiKey);
        } else {
            // Use Video API for MP4 downloads
            result = await downloadVideo(url, apiKey);
        }

        // Increment download count after successful download
        await incrementDownloadCount(clientIP, downloadType);

        // Add remaining downloads info to response
        const updatedRemaining = rateLimit.remaining - 1;

        console.log('Download result:', result);
        return NextResponse.json({
            ...result,
            remaining: updatedRemaining
        });

    } catch (error) {
        console.error('Download error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { status: 'error', error: { code: errorMessage } },
            { status: 500 }
        );
    }
}
