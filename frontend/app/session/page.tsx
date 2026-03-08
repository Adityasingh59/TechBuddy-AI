"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

interface HighlightElement {
    label: string;
    type: string;
    position_hint: string;
}

interface AIResponse {
    spoken_instruction: string;
    highlight_element: HighlightElement | null;
    step_number: number;
    confidence: number;
    is_complete: boolean;
    session_id: string;
}

function SessionContent() {
    const params = useSearchParams();
    const router = useRouter();
    const sessionId = params.get("id") || "demo";

    const [status, setStatus] = useState<"idle" | "sharing" | "listening" | "thinking" | "speaking">("idle");
    const [transcript, setTranscript] = useState("");
    const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
    const [stepHistory, setStepHistory] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ── Screen sharing ──────────────────────────────────────────────
    const startScreenShare = useCallback(async () => {
        try {
            const stream = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (opts: object) => Promise<MediaStream> })
                .getDisplayMedia({ video: { frameRate: 5 }, audio: false });
            setScreenStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
            setStatus("sharing");

            stream.getVideoTracks()[0].addEventListener("ended", () => {
                setScreenStream(null);
                setStatus("idle");
            });
        } catch {
            setError("Screen sharing was cancelled or is not supported. You can still use voice input in demo mode.");
            setStatus("sharing"); // allow demo anyway
        }
    }, []);

    // ── WebSocket connection ────────────────────────────────────────
    useEffect(() => {
        const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
        wsRef.current = ws;

        ws.onmessage = async (event) => {
            try {
                const data: AIResponse = JSON.parse(event.data);
                setAiResponse(data);
                setStepHistory((h) => [...h, data.spoken_instruction]);
                setStatus("speaking");

                // TTS
                await speakInstruction(data.spoken_instruction);

                if (data.is_complete) {
                    setTimeout(() => router.push(`/complete?id=${sessionId}`), 1500);
                } else {
                    setStatus("sharing");
                }
            } catch {
                setStatus("sharing");
            }
        };

        ws.onerror = () => {
            setError("AI connection lost. Retrying with REST API fallback...");
        };

        return () => ws.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // ── Screenshot capture ──────────────────────────────────────────
    const captureScreenshot = useCallback((): string | null => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || !screenStream) return null;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.7);
    }, [screenStream]);

    // ── Send query ──────────────────────────────────────────────────
    const sendQuery = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setStatus("thinking");
        const screenshot = captureScreenshot();

        // Try WebSocket first
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ query, screenshot }));
        } else {
            // Fallback to REST
            try {
                const res = await fetch(`${API_URL}/analyze`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_id: sessionId, query, screenshot }),
                });
                const data: AIResponse = await res.json();
                setAiResponse(data);
                setStepHistory((h) => [...h, data.spoken_instruction]);
                setStatus("speaking");
                await speakInstruction(data.spoken_instruction);
                if (data.is_complete) {
                    setTimeout(() => router.push(`/complete?id=${sessionId}`), 1500);
                } else {
                    setStatus("sharing");
                }
            } catch (e) {
                setError("Could not reach AI. Check your connection.");
                setStatus("sharing");
            }
        }
    }, [captureScreenshot, sessionId, router]);

    // ── Voice input ─────────────────────────────────────────────────
    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Voice input not supported in this browser. Type your question below.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognitionRef.current = recognition;

        recognition.onstart = () => setStatus("listening");

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const result = Array.from(event.results)
                .map((r: SpeechRecognitionResult) => r[0].transcript)
                .join("");
            setTranscript(result);
        };

        recognition.onend = () => {
            if (transcript) sendQuery(transcript);
        };

        recognition.start();
    }, [transcript, sendQuery]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    // ── TTS ─────────────────────────────────────────────────────────
    async function speakInstruction(text: string) {
        try {
            const res = await fetch(`${API_URL}/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            // If demo mode (JSON response), use Web Speech API
            if (res.headers.get("content-type")?.includes("application/json")) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.85;
                utterance.pitch = 1;
                window.speechSynthesis.speak(utterance);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();
        } catch {
            // Fallback Web Speech API
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
    }

    // ── Highlight position style ────────────────────────────────────
    function highlightStyle(hint: string): React.CSSProperties {
        const base: React.CSSProperties = {
            position: "absolute",
            padding: "8px 20px",
            background: "rgba(34,197,94,0.15)",
            border: "3px solid var(--green)",
            borderRadius: "12px",
            color: "#fff",
            fontWeight: 700,
            fontSize: "16px",
            animation: "pulse-green 1.5s infinite",
            pointerEvents: "none",
            whiteSpace: "nowrap",
        };
        if (hint.includes("bottom")) base.bottom = "16%";
        else if (hint.includes("top")) base.top = "16%";
        else base.top = "50%";
        if (hint.includes("right")) base.right = "8%";
        else if (hint.includes("left")) base.left = "8%";
        else { base.left = "50%"; base.transform = "translateX(-50%)"; }
        return base;
    }

    // Status label
    const statusLabel = {
        idle: "Tap 'Share Screen' to begin",
        sharing: "AI is watching your screen...",
        listening: "🎤 Listening...",
        thinking: "🤔 AI is thinking...",
        speaking: "🔊 AI is speaking...",
    }[status];

    return (
        <main style={styles.main}>
            <div style={styles.orb} />

            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <button onClick={() => router.push("/")} style={styles.backBtn}>← Back</button>
                    <div style={styles.sessionBadge}>
                        <div style={{ ...styles.statusDot, background: status === "idle" ? "#64748b" : status === "thinking" ? "#f59e0b" : "#22c55e" }} />
                        {statusLabel}
                    </div>
                    <div style={styles.sessionId}>#{sessionId.slice(0, 8)}</div>
                </div>

                {/* Main content area */}
                <div style={styles.contentGrid}>
                    {/* Screen Preview */}
                    <div style={styles.screenBox}>
                        <div style={styles.screenLabel}>📱 Screen Preview</div>
                        <div style={styles.screenPreview}>
                            <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
                            <canvas ref={canvasRef} style={{ display: "none" }} />

                            {/* Highlight overlay */}
                            {aiResponse?.highlight_element && (
                                <div style={highlightStyle(aiResponse.highlight_element.position_hint)}>
                                    👆 {aiResponse.highlight_element.label}
                                </div>
                            )}

                            {/* No-share placeholder */}
                            {!screenStream && status !== "sharing" && (
                                <div style={styles.noScreen}>
                                    <div style={styles.phoneIcon}>📱</div>
                                    <p style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "18px" }}>
                                        No screen shared yet
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Share/Stop screen button */}
                        {!screenStream ? (
                            <button id="share-screen-btn" onClick={startScreenShare} style={styles.shareScreenBtn}>
                                🖥️ Share My Screen
                            </button>
                        ) : (
                            <button onClick={() => { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); setStatus("idle"); }} style={styles.stopBtn}>
                                ⏹ Stop Sharing
                            </button>
                        )}
                    </div>

                    {/* AI Panel */}
                    <div style={styles.aiPanel}>
                        {/* Progress */}
                        {aiResponse && (
                            <div style={styles.progressBox} className="animate-fade-in-up">
                                <div style={styles.progressLabel}>
                                    Step {aiResponse.step_number} · {Math.round(aiResponse.confidence * 100)}% confidence
                                </div>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressFill, width: `${Math.min(aiResponse.step_number * 20, 100)}%` }} />
                                </div>
                            </div>
                        )}

                        {/* AI Instruction */}
                        <div style={styles.instructionBox} className={aiResponse ? "animate-fade-in-up" : ""}>
                            {aiResponse ? (
                                <>
                                    <div style={styles.instructionIcon}>🤖</div>
                                    <p style={styles.instructionText}>{aiResponse.spoken_instruction}</p>
                                </>
                            ) : (
                                <>
                                    <div style={styles.instructionIcon} className="float-anim">🤖</div>
                                    <p style={styles.instructionPlaceholder}>
                                        {status === "thinking" ? "Analyzing your screen..." : "Ask me anything about your phone!"}
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Voice transcript */}
                        {transcript && (
                            <div style={styles.transcriptBox} className="animate-fade-in-up">
                                <span style={styles.transcriptLabel}>You said:</span>
                                <span style={styles.transcriptText}>{transcript}</span>
                            </div>
                        )}

                        {/* Mic Button */}
                        <div style={styles.micArea}>
                            <button
                                id="mic-btn"
                                onMouseDown={startListening}
                                onMouseUp={stopListening}
                                onTouchStart={startListening}
                                onTouchEnd={stopListening}
                                disabled={status === "thinking"}
                                style={{
                                    ...styles.micBtn,
                                    ...(status === "listening" ? styles.micBtnActive : {}),
                                    ...(status === "thinking" ? styles.micBtnDisabled : {}),
                                }}
                                className={status === "listening" ? "pulse-ring" : ""}
                            >
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                                    {status === "thinking" ? (
                                        <circle cx="12" cy="12" r="10" opacity="0.3" />
                                    ) : (
                                        <>
                                            <rect x="9" y="2" width="6" height="12" rx="3" />
                                            <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                        </>
                                    )}
                                </svg>
                            </button>
                            <p style={styles.micHint}>
                                {status === "listening" ? "Release to send" : status === "thinking" ? "Thinking..." : "Hold to speak"}
                            </p>
                        </div>

                        {/* Type query fallback */}
                        <div style={styles.typeRow}>
                            <input
                                id="query-input"
                                type="text"
                                placeholder="Or type your question here..."
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") sendQuery(transcript); }}
                                style={styles.queryInput}
                            />
                            <button
                                id="send-btn"
                                onClick={() => sendQuery(transcript)}
                                disabled={!transcript || status === "thinking"}
                                style={styles.sendBtn}
                            >
                                Send
                            </button>
                        </div>

                        {/* Step history */}
                        {stepHistory.length > 0 && (
                            <div style={styles.historyBox}>
                                <p style={styles.historyLabel}>Completed steps:</p>
                                {stepHistory.slice(-4).map((s, i) => (
                                    <div key={i} style={styles.historyItem}>
                                        <span style={styles.historyCheck}>✓</span> {s}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div style={styles.errorBox} className="animate-fade-in-up">
                                ⚠️ {error}
                                <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function SessionPage() {
    return (
        <Suspense fallback={<div style={{ color: "#fff", padding: "40px", textAlign: "center", fontSize: "22px" }}>Loading session...</div>}>
            <SessionContent />
        </Suspense>
    );
}

const styles: Record<string, React.CSSProperties> = {
    main: { minHeight: "100vh", background: "var(--navy)", position: "relative", overflow: "hidden" },
    orb: { position: "fixed", top: "-100px", right: "-100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
    container: { maxWidth: "1200px", margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "20px" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
    backBtn: { minHeight: "44px", padding: "0 16px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px", fontWeight: 500 },
    sessionBadge: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "100px", color: "var(--text-primary)", fontSize: "18px", fontWeight: 600 },
    statusDot: { width: "10px", height: "10px", borderRadius: "50%", transition: "background 0.3s" },
    sessionId: { fontSize: "14px", color: "var(--text-muted)", fontFamily: "monospace" },
    contentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
    screenBox: { display: "flex", flexDirection: "column", gap: "12px" },
    screenLabel: { fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)" },
    screenPreview: { width: "100%", aspectRatio: "9/16", maxHeight: "520px", background: "var(--navy-card)", border: "2px solid var(--navy-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
    video: { width: "100%", height: "100%", objectFit: "contain" },
    noScreen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
    phoneIcon: { fontSize: "64px" },
    shareScreenBtn: { width: "100%", minHeight: "64px", background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px var(--teal-glow)" },
    stopBtn: { width: "100%", minHeight: "64px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "2px solid rgba(239,68,68,0.4)", borderRadius: "var(--radius)", fontSize: "20px", fontWeight: 700, cursor: "pointer" },
    aiPanel: { display: "flex", flexDirection: "column", gap: "16px" },
    progressBox: { padding: "16px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)" },
    progressLabel: { fontSize: "16px", color: "var(--text-secondary)", marginBottom: "10px" },
    progressTrack: { height: "8px", background: "var(--navy-border)", borderRadius: "4px", overflow: "hidden" },
    progressFill: { height: "100%", background: "linear-gradient(90deg, var(--teal), var(--teal-light))", borderRadius: "4px", transition: "width 0.5s ease" },
    instructionBox: { padding: "28px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", minHeight: "160px", justifyContent: "center" },
    instructionIcon: { fontSize: "48px" },
    instructionText: { fontSize: "24px", fontWeight: 700, textAlign: "center", color: "var(--text-primary)", lineHeight: 1.4 },
    instructionPlaceholder: { fontSize: "20px", color: "var(--text-muted)", textAlign: "center" },
    transcriptBox: { padding: "16px 20px", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "var(--radius)", display: "flex", gap: "12px", alignItems: "flex-start" },
    transcriptLabel: { fontSize: "16px", color: "var(--teal)", fontWeight: 600, whiteSpace: "nowrap" },
    transcriptText: { fontSize: "18px", color: "var(--text-primary)" },
    micArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
    micBtn: { width: "96px", height: "96px", borderRadius: "50%", background: "linear-gradient(135deg, var(--teal), #0d9488)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "transform 0.15s", boxShadow: "0 4px 20px var(--teal-glow)" },
    micBtnActive: { background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.4)", transform: "scale(1.1)" },
    micBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
    micHint: { fontSize: "16px", color: "var(--text-muted)" },
    typeRow: { display: "flex", gap: "10px" },
    queryInput: { flex: 1, height: "56px", background: "var(--navy-card)", border: "2px solid var(--navy-border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "18px", padding: "0 16px", outline: "none" },
    sendBtn: { minHeight: "56px", padding: "0 24px", background: "var(--teal)", color: "#fff", border: "none", borderRadius: "12px", fontSize: "18px", fontWeight: 700, cursor: "pointer" },
    historyBox: { padding: "16px 20px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: "8px" },
    historyLabel: { fontSize: "16px", color: "var(--text-muted)", marginBottom: "4px" },
    historyItem: { fontSize: "16px", color: "var(--text-secondary)", display: "flex", gap: "8px", alignItems: "flex-start" },
    historyCheck: { color: "var(--green)", fontWeight: 700, flexShrink: 0 },
    errorBox: { padding: "16px 20px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)", color: "var(--amber)", fontSize: "16px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" },
    errorClose: { background: "none", border: "none", color: "var(--amber)", cursor: "pointer", fontSize: "20px", padding: "0 4px" },
};
