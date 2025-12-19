import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, format } = body;

        // Validate input
        if (!platform || !format) {
            return NextResponse.json({ error: 'Missing platform or format' }, { status: 400 });
        }

        const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
        const validFormats = ['mp3', 'mp4'];

        if (!validPlatforms.includes(platform) || !validFormats.includes(format)) {
            return NextResponse.json({ error: 'Invalid platform or format' }, { status: 400 });
        }

        // Initialize Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase credentials not configured');
            return NextResponse.json({ success: true }); // Silent fail if not configured
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Insert log
        const { error } = await supabase
            .from('naoload_logs')
            .insert({ platform, format });

        if (error) {
            console.error('Supabase insert error:', error);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Log download error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
