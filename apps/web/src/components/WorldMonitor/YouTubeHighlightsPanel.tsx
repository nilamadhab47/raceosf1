"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { searchYouTubeHighlights, getStaticHighlights, type YouTubeResult } from "@/lib/youtubeHighlights";
import { api } from "@/lib/api";
import { Play, ExternalLink, Loader2, Eye, Clock, Trophy, Volume2, VolumeX, Maximize2 } from "lucide-react";

const YouTubeHighlightsPanelInner = () => {
  const session = useF1Store((s) => s.session);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const isSimulating = useTimeline((s) => s.isPlaying);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasSimulating = useRef(false);

  // Auto-load highlights when session changes — no manual search needed
  useEffect(() => {
    if (!session) return;
    setError(null);
    setResults([]);
    setPlaying(null);
    setVideoError(false);

    const gpName = session.name.replace(/\d{4}\s*/, "").replace("Grand Prix", "").trim() || session.circuit;
    const searchTerm = gpName.length > 0 ? gpName : session.circuit;

    // 1. Try static DB first (instant)
    const staticResults = getStaticHighlights(session.year, searchTerm);
    if (staticResults.length > 0) {
      setResults(staticResults);
      return;
    }

    // 2. Backend search (yt-dlp → Anthropic fallback)
    let cancelled = false;
    setLoading(true);
    (async () => {
      const vids = await searchYouTubeHighlights(session.year, searchTerm);
      if (cancelled) return;
      if (vids.length > 0) {
        setResults(vids);
      } else {
        setError("No highlights found for this GP.");
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [session]);

  // Auto-play the first result when results arrive
  useEffect(() => {
    if (results.length > 0 && !playing) {
      setPlaying(results[0].videoId);
      setVideoError(false);
    }
  }, [results, playing]);

  // Auto-play/resume when simulation starts
  useEffect(() => {
    if (isSimulating && !wasSimulating.current) {
      // Simulation just started
      if (results.length > 0 && !playing) {
        setPlaying(results[0].videoId);
        setVideoError(false);
      }
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
    if (!isSimulating && wasSimulating.current) {
      // Simulation stopped — pause video
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
    wasSimulating.current = isSimulating;
  }, [isSimulating, results, playing]);

  const formatDuration = (secs: number) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatViews = (v: number) => {
    if (!v) return "";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return `${v}`;
  };

  const openOnYouTube = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank", "noopener,noreferrer");
  };

  const playVideo = (videoId: string) => {
    setPlaying(videoId);
    setVideoError(false);
  };

  const toggleMute = () => {
    setMuted((m) => !m);
    if (videoRef.current) videoRef.current.muted = !muted;
  };

  const winner = leaderboard.find((e) => e.position === 1);
  const playingResult = results.find((r) => r.videoId === playing);
  const otherResults = results.filter((r) => r.videoId !== playing).slice(0, 3);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!session ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-f1-text-dim">Load a session to view highlights</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-f1-red animate-spin" />
              <span className="text-xs text-f1-text-dim">Finding highlights…</span>
            </div>
          </div>
        ) : error && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-f1-text-dim text-center">{error}</p>
            <a
              href={`https://www.youtube.com/results?search_query=F1+${session.year}+${encodeURIComponent(session.circuit)}+race+highlights`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-f1-red hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Search YouTube
            </a>
          </div>
        ) : playing && !videoError ? (
          <>
            {/* ── Video Player ── */}
            <div className="rounded-[6px] overflow-hidden border border-f1-border bg-black relative group">
              <video
                ref={videoRef}
                key={playing}
                src={api.getStreamUrl(playing)}
                autoPlay
                muted={muted}
                playsInline
                className="w-full aspect-video bg-black"
                onError={() => setVideoError(true)}
                onEnded={() => {
                  // Auto-play next video if available
                  if (otherResults.length > 0) playVideo(otherResults[0].videoId);
                }}
              />

              {/* Video overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? (
                        <VolumeX className="w-3.5 h-3.5 text-white/70" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-white/70" />
                      )}
                    </button>
                    {playingResult && (
                      <span className="text-[9px] font-mono text-white/50 truncate max-w-[160px]">
                        {playingResult.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => videoRef.current?.requestFullscreen()}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-white/70" />
                    </button>
                    <button
                      onClick={() => playing && openOnYouTube(playing)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="Watch on YouTube (HD)"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Now playing info */}
            {playingResult && (
              <div className="flex items-center gap-2 px-1">
                {winner && (
                  <span className="flex items-center gap-1 text-[9px] text-yellow-400 font-mono">
                    <Trophy className="w-2.5 h-2.5" />
                    P1 {winner.driver}
                  </span>
                )}
                {playingResult.viewCount > 0 && (
                  <span className="flex items-center gap-1 text-[9px] text-white/40 font-mono">
                    <Eye className="w-2.5 h-2.5" />
                    {formatViews(playingResult.viewCount)}
                  </span>
                )}
                <span className="text-[9px] text-white/20 font-mono ml-auto">
                  Playing in-app • SD quality
                </span>
              </div>
            )}

            {/* ── Other videos ── */}
            {otherResults.length > 0 && (
              <div className="space-y-1">
                {otherResults.map((vid) => (
                  <button
                    key={vid.videoId}
                    onClick={() => playVideo(vid.videoId)}
                    className="group/item w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <div className="w-16 h-9 rounded overflow-hidden shrink-0 bg-white/5 relative">
                      <img
                        src={vid.thumbnail}
                        alt={vid.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <Play className="w-3 h-3 text-white" fill="white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-display font-bold text-white/60 group-hover/item:text-white/80 line-clamp-2 leading-tight transition-colors">
                        {vid.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {vid.lengthSeconds > 0 && (
                          <span className="text-[8px] font-mono text-white/30">{formatDuration(vid.lengthSeconds)}</span>
                        )}
                        {vid.viewCount > 0 && (
                          <span className="text-[8px] font-mono text-white/30">{formatViews(vid.viewCount)} views</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : results.length > 0 ? (
          /* ── Fallback: stream failed, show clickable card ── */
          <>
            <button
              onClick={() => openOnYouTube(results[0].videoId)}
              className="group w-full rounded-[6px] overflow-hidden border border-f1-border hover:border-f1-red/40 transition-all cursor-pointer text-left"
            >
              <div className="relative w-full aspect-video bg-black">
                <img
                  src={`https://i.ytimg.com/vi/${results[0].videoId}/hqdefault.jpg`}
                  alt={results[0].title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-f1-red/90 group-hover:bg-f1-red group-hover:scale-110 flex items-center justify-center transition-all shadow-lg shadow-f1-red/30">
                    <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                  </div>
                </div>
                {results[0].lengthSeconds > 0 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white/80">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDuration(results[0].lengthSeconds)}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-display font-bold text-white leading-tight line-clamp-2">
                    {results[0].title}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {winner && (
                      <span className="flex items-center gap-1 text-[9px] text-f1-amber font-mono">
                        <Trophy className="w-2.5 h-2.5" />
                        P1 {winner.driver}
                      </span>
                    )}
                    {results[0].viewCount > 0 && (
                      <span className="flex items-center gap-1 text-[9px] text-white/50 font-mono">
                        <Eye className="w-2.5 h-2.5" />
                        {formatViews(results[0].viewCount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 bg-white/[0.03] group-hover:bg-f1-red/10 flex items-center justify-between transition-colors">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-red">
                  ▶ Watch on YouTube (HD)
                </span>
                <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-f1-red transition-colors" />
              </div>
            </button>
            {videoError && (
              <p className="text-[9px] text-white/30 text-center">In-app playback unavailable — opens in YouTube</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export const YouTubeHighlightsPanel = memo(YouTubeHighlightsPanelInner);
