import { NextRequest, NextResponse } from 'next/server';

// Cobalt API - Free, open-source video downloader
// List of public instances: https://instances.cobalt.best

// Try multiple instances in order of reliability
const COBALT_INSTANCES = [
    'https://cobalt-api.meowing.de',      // 92% uptime
    'https://cobalt-backend.canine.tools', // 80% uptime  
    'https://capi.3kh0.net',              // 76% uptime
    'https://kityune.imput.net',          // 76% uptime
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        console.log('Download request for URL:', url);

        // Try each instance until one works
        let lastError = null;

        for (const instance of COBALT_INSTANCES) {
            try {
                console.log('Trying Cobalt instance:', instance);

                const response = await fetch(`${instance}/`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: url,
                        videoQuality: '1080',
                        audioFormat: 'mp3',
                        filenameStyle: 'pretty',
                        downloadMode: 'auto',
                        youtubeVideoCodec: 'h264',
                    }),
                });

                const data = await response.json();
                console.log('Response from', instance, ':', response.status, JSON.stringify(data).substring(0, 500));

                // Check if successful
                if (response.ok && (data.status === 'redirect' || data.status === 'tunnel' || data.status === 'picker')) {
                    // Success! Return the result
                    if (data.status === 'redirect' || data.status === 'tunnel') {
                        return NextResponse.json({
                            status: 'redirect',
                            url: data.url,
                            filename: data.filename || 'download',
                        });
                    }

                    if (data.status === 'picker') {
                        const picker = data.picker?.map((item: { url: string; type?: string; thumb?: string }) => ({
                            url: item.url,
                            type: item.type || 'video',
                            thumb: item.thumb,
                        })) || [];

                        return NextResponse.json({
                            status: 'picker',
                            picker: picker,
                            audio: data.audio,
                        });
                    }
                }

                // If this instance returned an error, save it and try next
                lastError = data.error?.code || data.text || `HTTP ${response.status}`;

            } catch (instanceError) {
                console.log('Instance failed:', instance, instanceError);
                lastError = instanceError instanceof Error ? instanceError.message : 'Connection failed';
                // Continue to next instance
            }
        }

        // All instances failed
        return NextResponse.json({
            status: 'error',
            error: { code: `All Cobalt instances failed. Last error: ${lastError}` },
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
