"use client";

import { useState, useRef, useEffect } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import type { ChatMessage } from "@/store/f1-store";
import { api } from "@/lib/api";
import { MessageSquare, Send, X, Bot, User, Loader2 } from "lucide-react";

export function AIChatInput() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { chatMessages, addChatMessage, clearChat } = useF1Store();
  const { currentLap } = useTimeline();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { reply } = await api.chatWithAI(
        question,
        history,
        currentLap > 0 ? currentLap : undefined
      );

      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      });
    } catch {
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Failed to reach AI. Check that the backend is running and ANTHROPIC_API_KEY is set.",
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-24 z-50 w-12 h-12 rounded-full bg-f1-red flex items-center justify-center shadow-glow-red hover:scale-110 transition-transform"
        title="Ask AI"
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-24 z-50 w-96 max-h-[500px] flex flex-col rounded-[6px] border border-f1-red/30 bg-f1-surface shadow-2xl shadow-f1-red/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-f1-red/20 bg-f1-surface-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-f1-red" />
          <span className="text-[13px] font-display font-bold uppercase tracking-wider text-f1-text">
            Race Engineer AI
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1 rounded hover:bg-f1-border/50 text-f1-text-dim text-[13px]"
            title="Clear chat"
          >
            Clear
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-f1-border/50 text-f1-text-dim"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[350px]">
        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-f1-red/40 mx-auto mb-2" />
            <p className="text-[13px] text-f1-text-dim">
              Ask me anything about the race
            </p>
            <div className="mt-3 space-y-1">
              {[
                "Who should pit next?",
                "Is VER at risk of undercut?",
                "Compare tyre strategies",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="block w-full text-left text-[13px] px-3 py-1.5 rounded-md bg-f1-border/20 text-f1-text-muted hover:bg-f1-border/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <Bot className="w-4 h-4 text-f1-purple flex-shrink-0 mt-0.5" />
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-f1-red/20 text-f1-text border border-f1-red/30"
                  : "bg-f1-surface-2 text-f1-text border border-f1-border"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <User className="w-4 h-4 text-f1-text-dim flex-shrink-0 mt-0.5" />
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center">
            <Bot className="w-4 h-4 text-f1-red flex-shrink-0" />
            <div className="px-3 py-2 rounded-lg bg-f1-surface-2 border border-f1-border">
              <Loader2 className="w-3 h-3 text-f1-red animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-f1-red/20 p-2 bg-f1-surface-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the race..."
            className="flex-1 bg-f1-surface-2 border border-f1-border rounded-[6px] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-f1-red/50 focus:ring-1 focus:ring-f1-red/30"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-[6px] bg-f1-red text-white disabled:opacity-30 hover:bg-f1-red/80 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
