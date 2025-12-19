import { NextRequest, NextResponse } from 'next/server';

// Helper to detect platform from URL
function detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | 'unknown' {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    return 'unknown';
}

// Extract Instagram shortcode from URL
function extractInstagramShortcode(url: string): string | null {
    const patterns = [
        /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
        /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
        /instagram\.com\/reels\/([A-Za-z0-9_-]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
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
        const apiMethod = 'GET';

        // Build API request based on platform
        switch (platform) {
            case 'instagram': {
                const shortcode = extractInstagramShortcode(url);
                if (!shortcode) {
                    return NextResponse.json(
                        { status: 'error', error: { code: 'Invalid Instagram URL' } },
                        { status: 400 }
                    );
                }
                apiUrl = `https://${rapidApiHost}/instagram/media/post?shortcode=${shortcode}`;
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
                apiUrl = `https://${rapidApiHost}/youtube/v3/video/details?videoId=${videoId}`;
                break;
            }
            case 'tiktok': {
                apiUrl = `https://${rapidApiHost}/tiktok/post/details?url=${encodeURIComponent(url)}`;
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
            method: apiMethod,
            headers: {
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': rapidApiHost,
            },
        });

        const data = await response.json();

        console.log('API response status:', response.status);
        console.log('API response:', JSON.stringify(data).substring(0, 500));

        if (!response.ok) {
            return NextResponse.json(
                { status: 'error', error: { code: data.message || data.error || 'Download failed' } },
                { status: response.status || 400 }
            );
        }

        // Extract download URL based on platform response format
        let mediaUrl = null;
        let filename = 'download';
        const medias: Array<{ url: string; type: string; quality?: string }> = [];

        if (platform === 'instagram') {
            // Instagram response parsing
            if (data.video_url) {
                mediaUrl = data.video_url;
                filename = 'instagram_video.mp4';
            } else if (data.display_url || data.thumbnail_url) {
                mediaUrl = data.display_url || data.thumbnail_url;
                filename = 'instagram_image.jpg';
            } else if (data.edge_sidecar_to_children?.edges) {
                // Carousel post
                for (const edge of data.edge_sidecar_to_children.edges) {
                    const node = edge.node;
                    medias.push({
                        url: node.video_url || node.display_url,
                        type: node.is_video ? 'video' : 'image',
                    });
                }
            }
        } else if (platform === 'youtube') {
            // YouTube response parsing
            if (data.formats && data.formats.length > 0) {
                // Get best quality video with audio
                const videoWithAudio = data.formats.filter((f: { hasAudio: boolean; hasVideo: boolean }) =>
                    f.hasAudio && f.hasVideo
                );
                if (videoWithAudio.length > 0) {
                    const best = videoWithAudio[videoWithAudio.length - 1]; // Usually highest quality is last
                    mediaUrl = best.url;
                    filename = 'youtube_video.mp4';
                } else if (data.formats[0]?.url) {
                    mediaUrl = data.formats[0].url;
                    filename = 'youtube_video.mp4';
                }
                // Add all formats to picker
                for (const format of data.formats) {
                    if (format.url) {
                        medias.push({
                            url: format.url,
                            type: format.hasVideo ? 'video' : 'audio',
                            quality: format.qualityLabel || format.quality,
                        });
                    }
                }
            }
        } else if (platform === 'tiktok') {
            // TikTok response parsing
            if (data.video_url || data.videoUrl || data.play) {
                mediaUrl = data.video_url || data.videoUrl || data.play;
                filename = 'tiktok_video.mp4';
            } else if (data.video?.playAddr) {
                mediaUrl = data.video.playAddr;
                filename = 'tiktok_video.mp4';
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
            error: { code: 'Could not extract media URL' },
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
