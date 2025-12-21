'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Download,
    TrendingUp,
    Clock,
    Lock,
    Youtube,
    Instagram,
    Facebook,
    Music2,
    RefreshCw
} from 'lucide-react';

interface LogEntry {
    id: string;
    platform: string;
    format: string;
    created_at: string;
}

interface Stats {
    total: number;
    today: number;
    topPlatform: string;
    byPlatform: Record<string, number>;
}

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (response.ok) {
                setIsAuthenticated(true);
                fetchData();
            } else {
                setError('Invalid password');
            }
        } catch {
            setError('Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || []);
                setStats(data.stats || null);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'youtube': return <Youtube size={16} className="text-red-500" />;
            case 'instagram': return <Instagram size={16} className="text-pink-500" />;
            case 'facebook': return <Facebook size={16} className="text-blue-500" />;
            case 'tiktok': return <Music2 size={16} className="text-cyan-400" />;
            default: return <Download size={16} />;
        }
    };

    if (!isAuthenticated) {
        return (
            <main className="min-h-screen relative z-10 flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 w-full max-w-md"
                >
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Lock className="text-amber-400" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Nao-Admin</h1>
                        <p className="text-slate-400 text-sm mt-1">Enter password to access dashboard</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 mb-4"
                        />
                        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full glow-button rounded-xl py-3 font-bold text-slate-900"
                        >
                            {loading ? 'Authenticating...' : 'Access Dashboard'}
                        </button>
                    </form>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="min-h-screen relative z-10 px-4 py-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Nao-Admin</h1>
                        <p className="text-slate-400">My dashboard atmin</p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-3 glass-card hover:border-amber-400/50 transition-all"
                    >
                        <RefreshCw size={20} className={`text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center">
                                <Download className="text-amber-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">Total Downloads</p>
                                <p className="text-3xl font-bold text-white">{stats?.total || 0}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-400/10 rounded-xl flex items-center justify-center">
                                <TrendingUp className="text-green-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">Today</p>
                                <p className="text-3xl font-bold text-white">{stats?.today || 0}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-400/10 rounded-xl flex items-center justify-center">
                                <BarChart3 className="text-purple-400" size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm">Top Platform</p>
                                <p className="text-2xl font-bold text-white capitalize">{stats?.topPlatform || 'N/A'}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Platform Breakdown */}
                {stats?.byPlatform && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-6 mb-8"
                    >
                        <h2 className="text-lg font-bold text-white mb-4">Platform Breakdown</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(stats.byPlatform).map(([platform, count]) => (
                                <div key={platform} className="bg-slate-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        {getPlatformIcon(platform)}
                                        <span className="text-slate-300 capitalize">{platform}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{count}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Recent Logs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-6"
                >
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Clock size={20} />
                        Recent Activity
                    </h2>

                    {logs.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No downloads logged yet</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                                        <th className="pb-3 font-medium">Platform</th>
                                        <th className="pb-3 font-medium">Format</th>
                                        <th className="pb-3 font-medium">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.slice(0, 20).map((log) => (
                                        <tr key={log.id} className="border-b border-slate-800 last:border-0">
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    {getPlatformIcon(log.platform)}
                                                    <span className="text-white capitalize">{log.platform}</span>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${log.format === 'mp3'
                                                        ? 'bg-purple-500/20 text-purple-400'
                                                        : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {log.format.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-3 text-slate-400 text-sm">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </div>
        </main>
    );
}
