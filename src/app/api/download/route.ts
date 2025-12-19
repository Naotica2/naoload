import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, downloadMode } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: { code: 'Missing URL' } }, { status: 400 });
        }

        const apiUrl = process.env.NEXT_PUBLIC_COBALT_API_URL || 'https://nsoyivss-naoload-api.hf.space';

        console.log('Fetching from Cobalt API:', apiUrl);
        console.log('Request body:', { url, downloadMode });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                downloadMode: downloadMode || 'auto',
                filenameStyle: 'basic',
            }),
        });

        console.log('Cobalt API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cobalt API error response:', errorText);
            return NextResponse.json(
                { status: 'error', error: { code: `API returned ${response.status}` } },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('Cobalt API response data:', data);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Cobalt proxy error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { status: 'error', error: { code: `Fetch failed: ${errorMessage}` } },
            { status: 500 }
        );
    }
}
