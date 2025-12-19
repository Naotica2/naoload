import { NextRequest, NextResponse } from 'next/server';

// Cobalt API - Free, open-source, no API key needed
// Docs: https://github.com/imputnet/cobalt

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        // Cobalt API URL - You can use the public instance or self-host
        // Public instance: https://api.cobalt.tools
        // Alternative: https://co.wuk.sh (older)
        const cobaltApiUrl = process.env.COBALT_API_URL || 'https://api.cobalt.tools';

        console.log('Download request for URL:', url);
        console.log('Using Cobalt API:', cobaltApiUrl);

        const response = await fetch(`${cobaltApiUrl}/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                videoQuality: '1080',      // Max quality: 144, 240, 360, 480, 720, 1080, 1440, 2160, max
                audioFormat: 'mp3',        // mp3, ogg, opus, wav
                filenameStyle: 'pretty',   // classic, pretty, basic, nerdy
                downloadMode: 'auto',      // auto, audio, mute
                youtubeVideoCodec: 'h264', // h264, av1, vp9
                youtubeDubLang: 'id',      // Language for dubbed audio
            }),
        });

        const data = await response.json();

        console.log('Cobalt API response status:', response.status);
        console.log('Cobalt API response:', JSON.stringify(data).substring(0, 1000));

        if (!response.ok) {
            return NextResponse.json(
                {
                    status: 'error',
                    error: {
                        code: data.error?.code || data.text || `API Error: ${response.status}`
                    }
                },
                { status: response.status || 400 }
            );
        }

        // Handle Cobalt response types
        // status can be: redirect, tunnel, picker, error

        if (data.status === 'redirect' || data.status === 'tunnel') {
            // Direct download URL
            return NextResponse.json({
                status: 'redirect',
                url: data.url,
                filename: data.filename || 'download',
            });
        }

        if (data.status === 'picker') {
            // Multiple options available (e.g., Instagram carousel, TikTok slideshow)
            const picker = data.picker?.map((item: { url: string; type?: string; thumb?: string }) => ({
                url: item.url,
                type: item.type || 'video',
                thumb: item.thumb,
            })) || [];

            return NextResponse.json({
                status: 'picker',
                picker: picker,
                audio: data.audio, // Optional audio URL for slideshows
            });
        }

        if (data.status === 'error') {
            return NextResponse.json({
                status: 'error',
                error: { code: data.error?.code || data.text || 'Unknown error from Cobalt' },
            });
        }

        // Fallback - return raw response
        return NextResponse.json({
            status: 'error',
            error: { code: 'Unknown response format from Cobalt' },
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
