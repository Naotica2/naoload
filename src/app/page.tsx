'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Download, Sparkles, Zap, Shield, Globe } from 'lucide-react';

// URL validation regex for supported platforms
const URL_REGEX = /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|instagram\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|music\.youtube\.com)\/.+$/i;

// Platform detection
function detectPlatform(url: string): string {
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('music.youtube.com')) return 'youtube_music';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

// Rate limiting helper
function getRateLimitInfo(): { count: number; resetTime: number } {
  if (typeof window === 'undefined') return { count: 0, resetTime: 0 };
  const stored = localStorage.getItem('naoload_ratelimit');
  if (!stored) return { count: 0, resetTime: 0 };
  return JSON.parse(stored);
}

function updateRateLimit(): boolean {
  const now = Date.now();
  const info = getRateLimitInfo();

  // Reset if cooldown passed
  if (info.resetTime && now > info.resetTime) {
    localStorage.setItem('naoload_ratelimit', JSON.stringify({ count: 0, resetTime: 0 }));
    return true;
  }

  // Check if in cooldown
  if (info.count >= 3 && info.resetTime > now) {
    return false;
  }

  // Increment count
  const newCount = info.count + 1;
  const newResetTime = newCount >= 3 ? now + 60000 : info.resetTime;
  localStorage.setItem('naoload_ratelimit', JSON.stringify({ count: newCount, resetTime: newResetTime }));
  return true;
}

function getCooldownRemaining(): number {
  const info = getRateLimitInfo();
  if (!info.resetTime) return 0;
  const remaining = Math.ceil((info.resetTime - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; filename: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useState(() => {
    const interval = setInterval(() => {
      const remaining = getCooldownRemaining();
      setCooldown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  });

  const handleDownload = async () => {
    setError('');
    setResult(null);

    // Validate URL
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!URL_REGEX.test(url)) {
      setError('Please enter a valid TikTok, Instagram, Facebook, or YouTube URL');
      return;
    }

    // Check rate limit
    if (cooldown > 0) {
      setError(`Please wait ${cooldown} seconds before downloading again`);
      return;
    }

    if (!updateRateLimit()) {
      setCooldown(getCooldownRemaining());
      setError(`Rate limit reached. Please wait ${getCooldownRemaining()} seconds`);
      return;
    }

    setLoading(true);

    try {
      // Call our server-side proxy to avoid CORS issues
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
        }),
      });

      const data = await response.json();

      if (data.status === 'error') {
        setError(data.error?.code || 'Download failed. Please try again.');
        setLoading(false);
        return;
      }

      if (data.status === 'tunnel' || data.status === 'redirect') {
        setResult({ url: data.url, filename: data.filename || 'download' });

        // Log to Supabase
        const platform = detectPlatform(url);
        await fetch('/api/log-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, format: 'mp4' }),
        });
      } else if (data.status === 'picker') {
        // Handle picker (multiple items)
        if (data.picker && data.picker.length > 0) {
          setResult({ url: data.picker[0].url, filename: 'download' });
        }
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap, title: 'Lightning Fast', desc: 'Instant processing with no wait times' },
    { icon: Shield, title: 'Privacy First', desc: 'No data stored, completely anonymous' },
    { icon: Globe, title: 'All-in-One', desc: 'Download from any platform' },
    { icon: Sparkles, title: 'HD Quality', desc: 'Best quality available, always' },
  ];

  return (
    <main className="min-h-screen relative z-10 px-4 py-12 md:py-20">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
            Naoload
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto">
            Effortless media downloads, simplified.
          </p>
        </motion.div>

        {/* Main Input Container - Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass-card p-8 md:p-10 max-w-2xl mx-auto mb-16"
        >


          {/* URL Input */}
          <div className="relative mb-6">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste your link to Naoload..."
              className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
            />
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={loading || cooldown > 0}
            className={`w-full glow-button ${loading ? '' : 'pulse-glow'} rounded-2xl py-4 font-bold text-lg text-slate-900 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
          >
            {loading ? (
              <NaoloadingSpinner />
            ) : cooldown > 0 ? (
              <>Wait {cooldown}s</>
            ) : (
              <>
                <Download size={22} />
                Naoload It!
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-center mt-4"
            >
              {error}
            </motion.p>
          )}

          {/* Result Card */}
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl"
            >
              <p className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                <Sparkles size={18} />
                Ready to Download!
              </p>
              <a
                href={result.url}
                download={result.filename}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-3 rounded-xl text-center transition-all"
              >
                Download Video
              </a>
            </motion.div>
          )}
        </motion.div>

        {/* Bento Grid Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="glass-card p-6 hover:border-amber-400/50 transition-all group"
            >
              <feature.icon className="text-amber-400 mb-3 group-hover:scale-110 transition-transform" size={28} />
              <h3 className="font-bold text-white mb-1">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-16 text-slate-500 text-sm"
        >
          <p>© 2025 Naoload. Download responsibly.</p>
        </motion.footer>
      </div>
    </main>
  );
}

// Naoloading Spinner Component
function NaoloadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 border-2 border-slate-900/30 rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-slate-900 rounded-full naoloading-spinner" />
      </div>
      <span>Naoloading...</span>
    </div>
  );
}
