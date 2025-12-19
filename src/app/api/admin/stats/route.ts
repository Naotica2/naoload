import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        // Verify password
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check Supabase config
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                logs: [],
                stats: { total: 0, today: 0, topPlatform: 'N/A', byPlatform: {} }
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch logs
        const { data: logs, error: logsError } = await supabase
            .from('naoload_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (logsError) {
            console.error('Logs fetch error:', logsError);
        }

        // Calculate stats
        const allLogs = logs || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLogs = allLogs.filter(log => new Date(log.created_at) >= today);

        const byPlatform: Record<string, number> = {};
        allLogs.forEach(log => {
            byPlatform[log.platform] = (byPlatform[log.platform] || 0) + 1;
        });

        const topPlatform = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        // Get total count
        const { count } = await supabase
            .from('naoload_logs')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            logs: allLogs,
            stats: {
                total: count || allLogs.length,
                today: todayLogs.length,
                topPlatform,
                byPlatform,
            },
        });
    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
