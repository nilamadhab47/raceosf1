"use client";

import { useEffect, useRef, useCallback } from "react";
import { useF1Store } from "@/store/f1-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/race";
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;

export function useRaceWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_DELAY);
  const mountedRef = useRef(true);
  const {
    setLeaderboard,
    setPositions,
    setInsightsFromWS,
    setLiveState,
    setWsConnected,
    setFlagMode,
    setRaceControlMessages,
  } = useF1Store();

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = RECONNECT_DELAY;
      setWsConnected(true);
      ws.send(JSON.stringify({ action: "subscribe" }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "race_update":
            setLeaderboard(msg.leaderboard);
            setPositions(msg.positions);
            setInsightsFromWS(msg.insights);
            if (msg.live) setLiveState(msg.live);
            if (msg.flag) setFlagMode(msg.flag);
            if (msg.race_control) setRaceControlMessages(msg.race_control);
            break;

          case "flag_update":
            if (msg.flag) setFlagMode(msg.flag);
            if (msg.race_control) setRaceControlMessages(msg.race_control);
            break;

          case "live_state":
            if (msg.live) setLiveState(msg.live);
            break;

          case "live_stopped":
            setLiveState(msg.live ?? null);
            setFlagMode("green");
            break;

          case "connected":
          case "subscribed":
            if (msg.live) setLiveState(msg.live);
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(
            reconnectDelay.current * 1.5,
            MAX_RECONNECT_DELAY
          );
          connect();
        }, reconnectDelay.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setLeaderboard, setPositions, setInsightsFromWS, setLiveState, setWsConnected, setFlagMode, setRaceControlMessages]);

  const requestLap = useCallback((lap: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "get_lap", lap }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { requestLap, disconnect, reconnect: connect };
}
