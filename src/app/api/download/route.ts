import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        const rapidApiKey = process.env.RAPIDAPI_KEY;
        const rapidApiHost = process.env.RAPIDAPI_HOST || 'social-download-all-in-one.p.rapidapi.com';

        if (!rapidApiKey) {
            console.error('RAPIDAPI_KEY not configured');
            return NextResponse.json(
                { status: 'error', error: { code: 'API key not configured' } },
                { status: 500 }
            );
        }

        console.log('Download request for URL:', url);
        console.log('Using RapidAPI Social Download All-In-One');

        const response = await fetch(`https://${rapidApiHost}/v1/social/autolink`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': rapidApiHost,
            },
            body: JSON.stringify({ url }),
        });

        const data = await response.json();

        console.log('RapidAPI response status:', response.status);
        console.log('RapidAPI response:', JSON.stringify(data).substring(0, 500));

        if (!response.ok || data.error) {
            return NextResponse.json(
                { status: 'error', error: { code: data.message || data.error || 'Download failed' } },
                { status: response.status || 400 }
            );
        }

        // Extract download URL from response
        // The API returns different formats, try to find the best quality video/image
        let mediaUrl = null;
        let filename = 'download';

        // Check common response patterns
        if (data.url) {
            mediaUrl = data.url;
        } else if (data.medias && data.medias.length > 0) {
            // Find best quality video or image
            const videos = data.medias.filter((m: { type: string }) => m.type === 'video');
            const images = data.medias.filter((m: { type: string }) => m.type === 'image');

            if (videos.length > 0) {
                // Get highest quality video
                const bestVideo = videos.reduce((best: { quality?: number }, current: { quality?: number }) =>
                    (current.quality || 0) > (best.quality || 0) ? current : best
                );
                mediaUrl = bestVideo.url;
                filename = 'video.mp4';
            } else if (images.length > 0) {
                mediaUrl = images[0].url;
                filename = 'image.jpg';
            }
        } else if (data.video) {
            mediaUrl = data.video;
            filename = 'video.mp4';
        } else if (data.image) {
            mediaUrl = data.image;
            filename = 'image.jpg';
        }

        if (mediaUrl) {
            return NextResponse.json({
                status: 'redirect',
                url: mediaUrl,
                filename: filename,
            });
        }

        // If medias array exists but we couldn't extract, return all medias
        if (data.medias && data.medias.length > 0) {
            return NextResponse.json({
                status: 'picker',
                picker: data.medias.map((m: { url: string; type: string; quality?: number }) => ({
                    url: m.url,
                    type: m.type,
                    quality: m.quality,
                })),
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
