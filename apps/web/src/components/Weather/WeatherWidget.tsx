"use client";

import { useEffect, useState, memo } from "react";
import { api } from "@/lib/api";
import { useF1Store } from "@/store/f1-store";
import type { WeatherData } from "@/lib/types";

const WeatherWidgetInner = () => {
  const session = useF1Store((s) => s.session);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!session) return;
    api.getWeather().then((data) => {
      if (data.length > 0) setWeather(data[data.length - 1]);
    }).catch(() => {});
  }, [session]);

  if (!weather) return null;

  const isRain = weather.rainfall;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border bg-f1-surface/50 border-f1-border-solid">
      {/* Weather icon */}
      <span className="text-sm" title={isRain ? "Rain" : "Dry"}>
        {isRain ? "🌧️" : "☀️"}
      </span>

      {/* Temperature */}
      <div className="flex flex-col items-center">
        <span className="text-[13px] font-mono uppercase text-f1-text-muted">Air</span>
        <span className="text-[13px] font-mono font-bold tabular-nums text-f1-text">
          {weather.air_temp != null ? `${weather.air_temp.toFixed(0)}°` : "—"}
        </span>
      </div>

      <div className="w-px h-5 bg-f1-border-solid" />

      <div className="flex flex-col items-center">
        <span className="text-[13px] font-mono uppercase text-f1-text-muted">Track</span>
        <span className="text-[13px] font-mono font-bold tabular-nums text-f1-amber">
          {weather.track_temp != null ? `${weather.track_temp.toFixed(0)}°` : "—"}
        </span>
      </div>

      <div className="w-px h-5 bg-f1-border-solid" />

      {/* Wind */}
      <div className="flex flex-col items-center">
        <span className="text-[13px] font-mono uppercase text-f1-text-muted">Wind</span>
        <div className="flex items-center gap-1">
          <span className="text-[13px] font-mono font-bold tabular-nums text-f1-text">
            {weather.wind_speed != null ? `${weather.wind_speed.toFixed(0)}` : "—"}
          </span>
          <span className="text-[7px] font-mono text-f1-text-muted">km/h</span>
          {weather.wind_direction != null && (
            <span
              className="text-[13px] text-f1-text-dim inline-block"
              style={{ transform: `rotate(${weather.wind_direction}deg)` }}
            >
              ↑
            </span>
          )}
        </div>
      </div>

      {/* Humidity */}
      <div className="w-px h-5 bg-f1-border-solid" />
      <div className="flex flex-col items-center">
        <span className="text-[13px] font-mono uppercase text-f1-text-muted">Hum</span>
        <span className="text-[13px] font-mono font-bold tabular-nums text-f1-text-dim">
          {weather.humidity != null ? `${weather.humidity.toFixed(0)}%` : "—"}
        </span>
      </div>

      {/* Rain badge */}
      {isRain && (
        <span className="text-[13px] px-1.5 py-0.5 rounded border font-display font-black tracking-wider bg-f1-amber/15 text-f1-amber border-f1-amber/30 animate-pulse">
          WET
        </span>
      )}
    </div>
  );
};

export const WeatherWidget = memo(WeatherWidgetInner);
