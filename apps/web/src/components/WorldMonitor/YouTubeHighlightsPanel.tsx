"use client";

import { useState, useEffect, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import { Play, ExternalLink, Loader2, Trophy } from "lucide-react";

interface HighlightResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
  viewCount?: number;
  platform?: "dailymotion" | "youtube";
  embedUrl?: string;
  watchUrl?: string;
}

const YouTubeHighlightsPanelInner = () => {
  const session = useF1Store((s) => s.session);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const [results, setResults] = useState<HighlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<HighlightResult | null>(null);

  useEffect(() => {
    if (!session) { setResults([]); setPlaying(null); return; }

    const gpName = session.name.replace(/\d{4}\s*/, "").replace("Grand Prix", "").trim() || session.circuit;
    const term = gpName.length > 0 ? gpName : session.circuit;

    let cancelled = false;
    setLoading(true);
    setResults([]);
    setPlaying(null);

    (async () => {
      try {
        const data = await api.searchHighlights(session.year, term);
        if (cancelled) return;
        const vids: HighlightResult[] = data.results || [];
        setResults(vids);
        // Auto-play the first embeddable (Dailymotion) result
        const embeddable = vids.find(v => v.platform === "dailymotion");
        if (embeddable) setPlaying(embeddable);
      } catch {
        // Backend unavailable
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

  const winner = leaderboard.find((e) => e.position === 1);

  const openExternal = (vid: HighlightResult) => {
    const url = vid.watchUrl || (vid.platform === "dailymotion"
      ? `https://www.dailymotion.com/video/${vid.videoId}`
      : `https://www.youtube.com/watch?v=${vid.videoId}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const platformLabel = (p?: string) => p === "dailymotion" ? "Dailymotion" : "YouTube";
  const platformColor = (p?: string) => p === "dailymotion" ? "text-blue-400" : "text-f1-red";

  return (
    <div className="h-full flex flex-col">
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
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-xs text-f1-text-dim text-center">No highlights found</p>
          <a
            href={`https://www.youtube.com/results?search_query=F1+${session.year}+${encodeURIComponent(session.circuit)}+race+highlights`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-f1-red hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Search on YouTube
          </a>
        </div>
      ) : (
        <>
          {/* ── Embedded player (Dailymotion) or Hero thumbnail (YouTube) ── */}
          {playing?.embedUrl && playing.platform === "dailymotion" ? (
            <div className="flex-1 min-h-0 m-2">
              <div className="rounded-[6px] overflow-hidden border border-f1-border bg-black h-full relative group">
                <iframe
                  key={playing.videoId}
                  src={playing.embedUrl}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  className="w-full h-full"
                  title="F1 Race Highlights"
                />
                <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openExternal(playing)}
                    className="p-1 rounded bg-black/60 hover:bg-white/10 transition-colors"
                    title="Open on Dailymotion"
                  >
                    <ExternalLink className="w-3 h-3 text-white/70" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2">
              <button
                onClick={() => results[0] && openExternal(results[0])}
                className="group w-full rounded-[6px] overflow-hidden border border-f1-border hover:border-f1-red/40 transition-all cursor-pointer text-left"
              >
                <div className="relative w-full aspect-video bg-black">
                  <img
                    src={results[0]?.thumbnail}
                    alt={results[0]?.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-f1-red/90 group-hover:bg-f1-red group-hover:scale-110 flex items-center justify-center transition-all shadow-lg shadow-f1-red/30">
                      <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-[11px] font-display font-bold text-white leading-tight line-clamp-2">
                      {results[0]?.title}
                    </p>
                    {winner && (
                      <span className="flex items-center gap-1 text-[9px] text-yellow-400 font-mono mt-1">
                        <Trophy className="w-2.5 h-2.5" /> P1 {winner.driver}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-white/[0.03] group-hover:bg-f1-red/10 flex items-center justify-between transition-colors">
                  <span className="text-[9px] font-display font-bold uppercase tracking-wider text-f1-red">
                    ▶ Watch on {platformLabel(results[0]?.platform)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-f1-red transition-colors" />
                </div>
              </button>
            </div>
          )}

          {/* ── Video list ── */}
          <div className="px-2 pb-1 space-y-0.5 overflow-y-auto max-h-[140px] border-t border-f1-border/20">
            {results
              .filter(v => v.videoId !== playing?.videoId)
              .map((vid) => (
                <button
                  key={`${vid.platform}-${vid.videoId}`}
                  onClick={() => vid.platform === "dailymotion" ? setPlaying(vid) : openExternal(vid)}
                  className="group/item w-full flex items-center gap-2 p-1.5 rounded hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-16 h-9 rounded overflow-hidden shrink-0 bg-white/5 relative">
                    <img
                      src={vid.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Play className="w-2.5 h-2.5 text-white" fill="white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-display font-bold text-white/60 group-hover/item:text-white/80 line-clamp-2 leading-tight transition-colors">
                      {vid.title}
                    </p>
                    <span className={`text-[8px] font-mono ${platformColor(vid.platform)}`}>
                      {platformLabel(vid.platform)}
                      {vid.platform === "dailymotion" ? " • Tap to play" : " • Opens in new tab"}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

export const YouTubeHighlightsPanel = memo(YouTubeHighlightsPanelInner);
