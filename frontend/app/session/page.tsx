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
    confidence: float;
    is_complete: boolean;
    session_id: string;
}

type float = number;
type Status = "idle" | "sharing" | "listening" | "thinking" | "speaking" | "waiting";

const STATUS_LABELS: Record<Status, string> = {
    idle: "Tap 'Share Screen' to begin",
    sharing: "AI is watching your screen...",
    listening: "🎤 Listening...",
    thinking: "🤔 AI is thinking...",
    speaking: "🔊 AI is speaking...",
    waiting: "✅ Ready for next step",
};

function SessionContent() {
    const params = useSearchParams();
    const router = useRouter();
    const sessionId = params.get("id") || "demo";
    const task = decodeURIComponent(params.get("task") || "");

    const [status, setStatus] = useState<Status>("idle");
    const [transcript, setTranscript] = useState("");
    const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
    const [stepHistory, setStepHistory] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [autoCapture, setAutoCapture] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const autoCaptureRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Screen sharing ──────────────────────────────────────────────
    const startScreenShare = useCallback(async () => {
        try {
            const stream = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (o: object) => Promise<MediaStream> })
                .getDisplayMedia({ video: { frameRate: 5 }, audio: false });
            setScreenStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
            setStatus("sharing");
            stream.getVideoTracks()[0].addEventListener("ended", () => {
                setScreenStream(null);
                setAutoCapture(false);
                setStatus("idle");
            });
        } catch {
            setError("Screen sharing cancelled. Demo mode active — type your question below.");
            setStatus("sharing");
        }
    }, []);

    // ── WebSocket ───────────────────────────────────────────────────
    useEffect(() => {
        const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
        wsRef.current = ws;
        ws.onmessage = async (event) => {
            try {
                const data: AIResponse = JSON.parse(event.data);
                handleAIResponse(data);
            } catch { setStatus("waiting"); }
        };
        ws.onerror = () => setError("WebSocket unavailable — using REST API.");
        return () => ws.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // ── Screenshot ──────────────────────────────────────────────────
    const captureScreenshot = useCallback((): string | null => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || !screenStream) return null;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.75);
    }, [screenStream]);

    // ── Handle AI response ──────────────────────────────────────────
    const handleAIResponse = useCallback(async (data: AIResponse) => {
        setAiResponse(data);
        setStepHistory((h) => [...h, data.spoken_instruction]);
        setStatus("speaking");
        await speakInstruction(data.spoken_instruction);
        if (data.is_complete) {
            setTimeout(() => router.push(`/complete?id=${sessionId}`), 1800);
        } else {
            setStatus("waiting");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, router]);

    // ── Send query ──────────────────────────────────────────────────
    const sendQuery = useCallback(async (query: string, auto = false) => {
        if (!query.trim() && !auto) return;
        const effectiveQuery = query || (task ? `Guide me through: ${task}` : "What should I do next?");
        setStatus("thinking");
        const screenshot = captureScreenshot();

        const payload = { session_id: sessionId, query: effectiveQuery, screenshot };

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        } else {
            try {
                const res = await fetch(`${API_URL}/analyze`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data: AIResponse = await res.json();
                handleAIResponse(data);
            } catch {
                setError("Could not reach AI. Check your connection.");
                setStatus("sharing");
            }
        }
        setTranscript("");
    }, [captureScreenshot, sessionId, task, handleAIResponse]);

    // ── Auto-capture every 10s ──────────────────────────────────────
    useEffect(() => {
        if (autoCapture && screenStream) {
            autoCaptureRef.current = setInterval(() => {
                if (status === "waiting" || status === "sharing") {
                    sendQuery("", true);
                }
            }, 10000);
        } else {
            if (autoCaptureRef.current) clearInterval(autoCaptureRef.current);
        }
        return () => { if (autoCaptureRef.current) clearInterval(autoCaptureRef.current); };
    }, [autoCapture, screenStream, status, sendQuery]);

    // ── Start task automatically when screen shared + task set ─────
    useEffect(() => {
        if (screenStream && task && !aiResponse) {
            setTimeout(() => sendQuery(`Help me: ${task}`, true), 1500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenStream]);

    // ── Voice input ─────────────────────────────────────────────────
    const startListening = useCallback(() => {
        const SR = window.SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
        if (!SR) { setError("Voice not supported. Use the text box below."); return; }
        const recognition = new SR();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognitionRef.current = recognition;
        recognition.onstart = () => setStatus("listening");
        recognition.onresult = (e: SpeechRecognitionEvent) => {
            const t = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join("");
            setTranscript(t);
        };
        recognition.onend = () => { if (transcript) sendQuery(transcript); };
        recognition.start();
    }, [transcript, sendQuery]);

    const stopListening = useCallback(() => recognitionRef.current?.stop(), []);

    // ── TTS ─────────────────────────────────────────────────────────
    async function speakInstruction(text: string) {
        try {
            const res = await fetch(`${API_URL}/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (res.headers.get("content-type")?.includes("application/json")) {
                fallbackTTS(text); return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            new Audio(url).play();
        } catch { fallbackTTS(text); }
    }

    function fallbackTTS(text: string) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
    }

    // ── Highlight position ──────────────────────────────────────────
    function highlightStyle(hint: string): React.CSSProperties {
        const base: React.CSSProperties = {
            position: "absolute",
            padding: "8px 18px",
            background: "rgba(34,197,94,0.18)",
            border: "3px solid var(--green)",
            borderRadius: "12px",
            color: "#fff",
            fontWeight: 700,
            fontSize: "15px",
            animation: "pulse-green 1.5s infinite",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
        };
        if (hint.includes("bottom")) base.bottom = "14%";
        else if (hint.includes("top")) base.top = "14%";
        else { base.top = "50%"; base.transform = "translateY(-50%)"; }
        if (hint.includes("right")) base.right = "6%";
        else if (hint.includes("left")) base.left = "6%";
        else { base.left = "50%"; base.transform = (base.transform || "") + " translateX(-50%)"; }
        return base;
    }

    return (
        <main style={styles.main}>
            <div style={styles.orb} />

            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <button onClick={() => router.push("/")} style={styles.backBtn}>← Back</button>
                    <div style={styles.headerCenter}>
                        <div style={{ ...styles.statusDot, background: status === "idle" ? "#64748b" : status === "thinking" ? "#f59e0b" : status === "speaking" ? "#818cf8" : "#22c55e" }} />
                        <span style={styles.statusText}>{STATUS_LABELS[status]}</span>
                    </div>
                    <div style={styles.sessionId}>#{sessionId.slice(0, 8)}</div>
                </div>

                {/* Task banner */}
                {task && (
                    <div style={styles.taskBanner} className="animate-fade-in-up">
                        <span style={styles.taskBannerIcon}>🎯</span>
                        <span style={styles.taskBannerText}><strong>Goal:</strong> {task}</span>
                    </div>
                )}

                {/* Main grid */}
                <div style={styles.contentGrid}>
                    {/* Screen side */}
                    <div style={styles.screenBox}>
                        <div style={styles.sectionLabel}>📱 Screen Preview</div>
                        <div style={styles.screenPreview}>
                            <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
                            <canvas ref={canvasRef} style={{ display: "none" }} />

                            {/* Highlight overlay */}
                            {aiResponse?.highlight_element && (
                                <div style={highlightStyle(aiResponse.highlight_element.position_hint)}>
                                    👆 {aiResponse.highlight_element.label}
                                </div>
                            )}

                            {!screenStream && (
                                <div style={styles.noScreen}>
                                    <div style={{ fontSize: "64px" }}>📱</div>
                                    <p style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "18px", textAlign: "center" }}>
                                        Share your screen so<br />TechBuddy can see it
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Share / Stop */}
                        {!screenStream ? (
                            <button id="share-screen-btn" onClick={startScreenShare} style={styles.shareScreenBtn}>
                                🖥️ Share My Screen
                            </button>
                        ) : (
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button onClick={() => { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); setAutoCapture(false); setStatus("idle"); }} style={styles.stopBtn}>
                                    ⏹ Stop Sharing
                                </button>
                                {/* Auto-capture toggle */}
                                <button
                                    onClick={() => setAutoCapture(a => !a)}
                                    style={{ ...styles.autoBtn, ...(autoCapture ? styles.autoBtnActive : {}) }}
                                    title="Auto-analyze screen every 10 seconds"
                                >
                                    {autoCapture ? "⏸ Auto" : "▶ Auto"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* AI side */}
                    <div style={styles.aiPanel}>
                        {/* Progress */}
                        {aiResponse && (
                            <div style={styles.progressBox} className="animate-fade-in-up">
                                <div style={styles.progressLabel}>
                                    Step {aiResponse.step_number} &nbsp;·&nbsp; {Math.round(aiResponse.confidence * 100)}% confident
                                </div>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressFill, width: `${Math.min(aiResponse.step_number * 18, 100)}%` }} />
                                </div>
                            </div>
                        )}

                        {/* AI Instruction */}
                        <div style={styles.instructionBox} className={aiResponse ? "animate-fade-in-up" : ""}>
                            {status === "thinking" ? (
                                <div style={styles.thinkingBox}>
                                    <div style={styles.thinkDot} />
                                    <div style={{ ...styles.thinkDot, animationDelay: "0.2s" }} />
                                    <div style={{ ...styles.thinkDot, animationDelay: "0.4s" }} />
                                </div>
                            ) : aiResponse ? (
                                <>
                                    <div style={styles.instructionIcon}>🤖</div>
                                    <p style={styles.instructionText}>{aiResponse.spoken_instruction}</p>
                                </>
                            ) : (
                                <>
                                    <div style={styles.instructionIcon} className="float-anim">🤖</div>
                                    <p style={styles.instructionPlaceholder}>
                                        {task ? `Ready to help you: ${task}` : "Ask me anything about your phone!"}
                                    </p>
                                </>
                            )}
                        </div>

                        {/* ── Next Step button (primary action after AI speaks) ── */}
                        {status === "waiting" && aiResponse && !aiResponse.is_complete && (
                            <button
                                id="next-step-btn"
                                onClick={() => sendQuery("I did it. What should I do next?")}
                                style={styles.nextStepBtn}
                                className="animate-fade-in-up pulse-green"
                            >
                                ✅ I did it — Next Step
                            </button>
                        )}

                        {/* Transcript */}
                        {transcript && (
                            <div style={styles.transcriptBox} className="animate-fade-in-up">
                                <span style={styles.transcriptLabel}>You said:</span>
                                <span style={styles.transcriptText}>{transcript}</span>
                            </div>
                        )}

                        {/* Mic */}
                        <div style={styles.micArea}>
                            <button
                                id="mic-btn"
                                onMouseDown={startListening}
                                onMouseUp={stopListening}
                                onTouchStart={startListening}
                                onTouchEnd={stopListening}
                                disabled={status === "thinking" || status === "speaking"}
                                style={{
                                    ...styles.micBtn,
                                    ...(status === "listening" ? styles.micBtnActive : {}),
                                    ...(status === "thinking" || status === "speaking" ? styles.micBtnDisabled : {}),
                                }}
                                className={status === "listening" ? "pulse-ring" : ""}
                            >
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="9" y="2" width="6" height="12" rx="3" />
                                    <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                </svg>
                            </button>
                            <p style={styles.micHint}>
                                {status === "listening" ? "Release to send" : status === "thinking" ? "Thinking..." : "Hold to speak"}
                            </p>
                        </div>

                        {/* Type query */}
                        <div style={styles.typeRow}>
                            <input
                                id="query-input"
                                type="text"
                                placeholder={task ? `Ask about: ${task}...` : "Or type your question here..."}
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && transcript) sendQuery(transcript); }}
                                style={styles.queryInput}
                            />
                            <button
                                id="send-btn"
                                onClick={() => sendQuery(transcript)}
                                disabled={!transcript || status === "thinking"}
                                style={{ ...styles.sendBtn, ...(!transcript || status === "thinking" ? { opacity: 0.5 } : {}) }}
                            >
                                Send
                            </button>
                        </div>

                        {/* Restart task */}
                        {task && (
                            <button
                                onClick={() => sendQuery(`Start from the beginning: ${task}`)}
                                style={styles.restartBtn}
                            >
                                🔄 Restart Task
                            </button>
                        )}

                        {/* History */}
                        {stepHistory.length > 0 && (
                            <div style={styles.historyBox}>
                                <p style={styles.historyLabel}>Steps completed ({stepHistory.length}):</p>
                                {stepHistory.slice(-5).map((s, i) => (
                                    <div key={i} style={styles.historyItem}>
                                        <span style={styles.historyCheck}>✓</span>
                                        <span>{s}</span>
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

            {/* Thinking animation */}
            <style>{`
        @keyframes think { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>
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
    container: { maxWidth: "1200px", margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
    backBtn: { minHeight: "44px", padding: "0 16px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "10px", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px", fontWeight: 500 },
    headerCenter: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "100px" },
    statusDot: { width: "10px", height: "10px", borderRadius: "50%", transition: "background 0.3s" },
    statusText: { fontSize: "17px", fontWeight: 600, color: "var(--text-primary)" },
    sessionId: { fontSize: "13px", color: "var(--text-muted)", fontFamily: "monospace" },
    taskBanner: { padding: "12px 20px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: "10px" },
    taskBannerIcon: { fontSize: "20px" },
    taskBannerText: { fontSize: "18px", color: "var(--teal-light)" },
    contentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" },
    screenBox: { display: "flex", flexDirection: "column", gap: "10px" },
    sectionLabel: { fontSize: "17px", fontWeight: 600, color: "var(--text-secondary)" },
    screenPreview: { width: "100%", aspectRatio: "9/16", maxHeight: "500px", background: "var(--navy-card)", border: "2px solid var(--navy-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
    video: { width: "100%", height: "100%", objectFit: "contain" },
    noScreen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px" },
    shareScreenBtn: { width: "100%", minHeight: "64px", background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px var(--teal-glow)" },
    stopBtn: { flex: 1, minHeight: "64px", background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "2px solid rgba(239,68,68,0.35)", borderRadius: "var(--radius)", fontSize: "18px", fontWeight: 700, cursor: "pointer" },
    autoBtn: { minHeight: "64px", padding: "0 18px", background: "var(--navy-card)", color: "var(--text-secondary)", border: "2px solid var(--navy-border)", borderRadius: "var(--radius)", fontSize: "16px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    autoBtnActive: { background: "rgba(20,184,166,0.15)", color: "var(--teal-light)", border: "2px solid var(--teal)" },
    aiPanel: { display: "flex", flexDirection: "column", gap: "14px" },
    progressBox: { padding: "14px 18px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)" },
    progressLabel: { fontSize: "15px", color: "var(--text-secondary)", marginBottom: "8px" },
    progressTrack: { height: "6px", background: "var(--navy-border)", borderRadius: "3px", overflow: "hidden" },
    progressFill: { height: "100%", background: "linear-gradient(90deg, var(--teal), var(--teal-light))", borderRadius: "3px", transition: "width 0.5s ease" },
    instructionBox: { padding: "24px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", minHeight: "150px", justifyContent: "center" },
    instructionIcon: { fontSize: "44px" },
    instructionText: { fontSize: "22px", fontWeight: 700, textAlign: "center", color: "var(--text-primary)", lineHeight: 1.4 },
    instructionPlaceholder: { fontSize: "19px", color: "var(--text-muted)", textAlign: "center", fontStyle: "italic" },
    thinkingBox: { display: "flex", gap: "10px", alignItems: "center", justifyContent: "center", height: "60px" },
    thinkDot: { width: "14px", height: "14px", background: "var(--teal)", borderRadius: "50%", animation: "think 1.2s ease-in-out infinite" },
    nextStepBtn: { width: "100%", minHeight: "68px", background: "linear-gradient(135deg, var(--green), #16a34a)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "22px", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px var(--green-glow)", letterSpacing: "-0.01em" },
    transcriptBox: { padding: "14px 18px", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: "var(--radius)", display: "flex", gap: "10px", alignItems: "flex-start" },
    transcriptLabel: { fontSize: "15px", color: "var(--teal)", fontWeight: 600, whiteSpace: "nowrap" },
    transcriptText: { fontSize: "17px", color: "var(--text-primary)" },
    micArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" },
    micBtn: { width: "88px", height: "88px", borderRadius: "50%", background: "linear-gradient(135deg, var(--teal), #0d9488)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 20px var(--teal-glow)", transition: "transform 0.15s" },
    micBtnActive: { background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.4)", transform: "scale(1.1)" },
    micBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
    micHint: { fontSize: "15px", color: "var(--text-muted)" },
    typeRow: { display: "flex", gap: "10px" },
    queryInput: { flex: 1, height: "52px", background: "var(--navy-card)", border: "2px solid var(--navy-border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "17px", padding: "0 14px", outline: "none" },
    sendBtn: { minHeight: "52px", padding: "0 22px", background: "var(--teal)", color: "#fff", border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: 700, cursor: "pointer" },
    restartBtn: { width: "100%", minHeight: "48px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--navy-border)", borderRadius: "12px", fontSize: "16px", cursor: "pointer", fontWeight: 500 },
    historyBox: { padding: "14px 18px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: "7px" },
    historyLabel: { fontSize: "15px", color: "var(--text-muted)", marginBottom: "4px" },
    historyItem: { fontSize: "15px", color: "var(--text-secondary)", display: "flex", gap: "8px", alignItems: "flex-start" },
    historyCheck: { color: "var(--green)", fontWeight: 700, flexShrink: 0 },
    errorBox: { padding: "14px 18px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)", color: "var(--amber)", fontSize: "15px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" },
    errorClose: { background: "none", border: "none", color: "var(--amber)", cursor: "pointer", fontSize: "20px" },
};
