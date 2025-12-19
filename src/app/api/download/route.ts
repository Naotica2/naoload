import { NextRequest, NextResponse } from 'next/server';

// Helper to detect platform from URL
function detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | 'unknown' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return 'unknown';
}

// Extract YouTube video ID from URL
function extractYoutubeVideoId(url: string): string | null {
    const patterns = [
        /youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/,
        /youtu\.be\/([A-Za-z0-9_-]+)/,
        /youtube\.com\/shorts\/([A-Za-z0-9_-]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        const rapidApiKey = process.env.RAPIDAPI_KEY;
        const rapidApiHost = process.env.RAPIDAPI_HOST || 'social-media-video-downloader.p.rapidapi.com';

        if (!rapidApiKey) {
            console.error('RAPIDAPI_KEY not configured');
            return NextResponse.json(
                { status: 'error', error: { code: 'API key not configured' } },
                { status: 500 }
            );
        }

        const platform = detectPlatform(url);
        console.log('Download request for URL:', url);
        console.log('Detected platform:', platform);
        console.log('Using API Host:', rapidApiHost);

        let apiUrl = '';

        // Build API request based on platform
        // Using the smvd (Social Media Video Downloader) API endpoint format
        switch (platform) {
            case 'instagram': {
                // Try the generic download endpoint with the full URL
                apiUrl = `https://${rapidApiHost}/smvd/get/all?url=${encodeURIComponent(url)}`;
                break;
            }
            case 'youtube': {
                const videoId = extractYoutubeVideoId(url);
                if (!videoId) {
                    return NextResponse.json(
                        { status: 'error', error: { code: 'Invalid YouTube URL' } },
                        { status: 400 }
                    );
                }
                // YouTube endpoint
                apiUrl = `https://${rapidApiHost}/youtube/v3/video/details?videoId=${videoId}`;
                break;
            }
            case 'tiktok': {
                // TikTok endpoint
                apiUrl = `https://${rapidApiHost}/smvd/get/all?url=${encodeURIComponent(url)}`;
                break;
            }
            default:
                return NextResponse.json(
                    { status: 'error', error: { code: 'Platform not supported. Use Instagram, TikTok, or YouTube.' } },
                    { status: 400 }
                );
        }

        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': rapidApiHost,
            },
        });

        const data = await response.json();

        console.log('API response status:', response.status);
        console.log('API response:', JSON.stringify(data).substring(0, 1000));

        if (!response.ok) {
            return NextResponse.json(
                { status: 'error', error: { code: data.message || data.error || `API Error: ${response.status}` } },
                { status: response.status || 400 }
            );
        }

        // Extract download URL based on response format
        let mediaUrl = null;
        let filename = 'download';
        const medias: Array<{ url: string; type: string; quality?: string }> = [];

        // Common response patterns for social media video downloaders
        // Pattern 1: Direct URL in response
        if (data.link || data.url || data.download_url) {
            mediaUrl = data.link || data.url || data.download_url;
            filename = platform === 'youtube' ? 'youtube_video.mp4' :
                platform === 'instagram' ? 'instagram_media' :
                    'tiktok_video.mp4';
        }

        // Pattern 2: links array (common for SMVD API)
        if (data.links && Array.isArray(data.links) && data.links.length > 0) {
            for (const link of data.links) {
                medias.push({
                    url: link.link || link.url,
                    type: link.type || 'video',
                    quality: link.quality || link.resolution,
                });
            }
            // Get the first/best quality
            if (medias.length > 0 && medias[0].url) {
                mediaUrl = medias[0].url;
                filename = `${platform}_video.mp4`;
            }
        }

        // Pattern 3: YouTube formats array
        if (data.formats && Array.isArray(data.formats) && data.formats.length > 0) {
            for (const format of data.formats) {
                if (format.url) {
                    medias.push({
                        url: format.url,
                        type: format.hasVideo ? 'video' : 'audio',
                        quality: format.qualityLabel || format.quality,
                    });
                }
            }
            // Get video with audio
            const videoWithAudio = data.formats.filter((f: { hasAudio?: boolean; hasVideo?: boolean }) =>
                f.hasAudio && f.hasVideo
            );
            if (videoWithAudio.length > 0) {
                mediaUrl = videoWithAudio[videoWithAudio.length - 1].url;
                filename = 'youtube_video.mp4';
            } else if (medias.length > 0) {
                mediaUrl = medias[0].url;
                filename = 'youtube_video.mp4';
            }
        }

        // Pattern 4: media array
        if (data.media && Array.isArray(data.media) && data.media.length > 0) {
            for (const m of data.media) {
                medias.push({
                    url: m.url || m.link,
                    type: m.type || 'video',
                    quality: m.quality,
                });
            }
            if (medias.length > 0 && medias[0].url) {
                mediaUrl = medias[0].url;
                filename = `${platform}_media`;
            }
        }

        // Pattern 5: video/image direct properties
        if (!mediaUrl) {
            if (data.video || data.video_url || data.videoUrl) {
                mediaUrl = data.video || data.video_url || data.videoUrl;
                filename = `${platform}_video.mp4`;
            } else if (data.image || data.image_url || data.imageUrl) {
                mediaUrl = data.image || data.image_url || data.imageUrl;
                filename = `${platform}_image.jpg`;
            }
        }

        // Return single media URL if found
        if (mediaUrl) {
            return NextResponse.json({
                status: 'redirect',
                url: mediaUrl,
                filename: filename,
            });
        }

        // Return picker if multiple medias found
        if (medias.length > 0) {
            return NextResponse.json({
                status: 'picker',
                picker: medias,
            });
        }

        // Return raw response for debugging if we couldn't parse
        return NextResponse.json({
            status: 'error',
            error: { code: 'Could not extract media URL from API response' },
            debug: data,
        });

    } catch (error) {
        console.error('Download proxy error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { status: 'error', error: { code: `Fetch failed: ${errorMessage}` } },
            { status: 500 }
        );
    }
}
