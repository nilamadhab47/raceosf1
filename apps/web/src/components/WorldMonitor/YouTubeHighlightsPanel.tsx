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
}

const YouTubeHighlightsPanelInner = () => {
  const session = useF1Store((s) => s.session);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const [results, setResults] = useState<HighlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

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
        const vids = data.results || [];
        setResults(vids);
        if (vids.length > 0) setPlaying(vids[0].videoId);
      } catch {
        // Backend unavailable
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

  const winner = leaderboard.find((e) => e.position === 1);

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
            <span className="text-xs text-f1-text-dim">Finding embeddable highlights…</span>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-xs text-f1-text-dim text-center">No embeddable highlights found</p>
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
      ) : (
        <>
          {/* Embedded player */}
          {playing && (
            <div className="flex-1 min-h-0 rounded-[6px] overflow-hidden border border-f1-border bg-black m-2">
              <iframe
                key={playing}
                src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="w-full h-full"
                title="F1 Race Highlights"
              />
            </div>
          )}

          {/* Video list */}
          {results.length > 1 && (
            <div className="px-2 pb-1 space-y-0.5 max-h-[120px] overflow-y-auto">
              {results.filter(v => v.videoId !== playing).map((vid) => (
                <button
                  key={vid.videoId}
                  onClick={() => setPlaying(vid.videoId)}
                  className="group/item w-full flex items-center gap-2 p-1 rounded hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-14 h-8 rounded overflow-hidden shrink-0 bg-white/5 relative">
                    <img src={vid.thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Play className="w-2.5 h-2.5 text-white" fill="white" />
                    </div>
                  </div>
                  <p className="text-[8px] font-display text-white/50 group-hover/item:text-white/80 line-clamp-2 leading-tight transition-colors">{vid.title}</p>
                </button>
              ))}
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center gap-2 px-3 py-1 border-t border-f1-border/30">
            {winner && (
              <span className="flex items-center gap-1 text-[9px] text-yellow-400 font-mono">
                <Trophy className="w-2.5 h-2.5" />
                P1 {winner.driver}
              </span>
            )}
            <a
              href={`https://www.youtube.com/results?search_query=F1+${session.year}+${encodeURIComponent(session.circuit)}+race+highlights`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[9px] text-f1-red hover:underline font-mono"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              More on YouTube
            </a>
          </div>
        </>
      )}
    </div>
  );
};

export const YouTubeHighlightsPanel = memo(YouTubeHighlightsPanelInner);
