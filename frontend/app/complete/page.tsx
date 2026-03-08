"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function CompleteContent() {
    const params = useSearchParams();
    const router = useRouter();
    const sessionId = params.get("id") || "demo";
    const [confetti] = useState(() =>
        Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: ["#14b8a6", "#f59e0b", "#22c55e", "#818cf8", "#f472b6"][Math.floor(Math.random() * 5)],
            delay: Math.random() * 1.5,
            size: 8 + Math.random() * 8,
        }))
    );

    useEffect(() => {
        // Speak congratulations
        const u = new SpeechSynthesisUtterance(
            "Great job! You completed the task successfully. You are doing amazing!"
        );
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
    }, []);

    return (
        <main style={styles.main}>
            {/* Confetti */}
            {confetti.map((c) => (
                <div
                    key={c.id}
                    style={{
                        position: "fixed",
                        left: `${c.x}%`,
                        top: "-20px",
                        width: `${c.size}px`,
                        height: `${c.size}px`,
                        background: c.color,
                        borderRadius: "2px",
                        animation: `confetti-drop 2.5s ease-in ${c.delay}s forwards`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            ))}

            <div style={styles.card} className="animate-fade-in-up">
                {/* Checkmark */}
                <div style={styles.checkWrapper}>
                    <div style={styles.checkCircle} className="pulse-green">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ animation: "spin-in 0.6s ease forwards" }}>
                            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                <h1 style={styles.heading}>Great job! 🎉</h1>
                <p style={styles.subtext}>You completed the task successfully!</p>
                <p style={styles.praise}>You&apos;re doing amazing. Keep it up!</p>

                <div style={styles.divider} />

                <div style={styles.actionsGrid}>
                    <button
                        id="new-task-btn"
                        onClick={async () => {
                            try {
                                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                const res = await fetch(`${API_URL}/session/new`);
                                const data = await res.json();
                                router.push(`/session?id=${data.session_id}`);
                            } catch {
                                const demoId = "demo-" + Math.random().toString(36).slice(2, 10);
                                router.push(`/session?id=${demoId}`);
                            }
                        }}
                        style={styles.btnPrimary}
                    >
                        🚀 Start a New Task
                    </button>

                    <button
                        id="home-btn"
                        onClick={() => router.push("/")}
                        style={styles.btnSecondary}
                    >
                        🏠 Go Home
                    </button>
                </div>

                {/* Stats */}
                <div style={styles.statsRow}>
                    <div style={styles.stat}>
                        <div style={styles.statValue}>✅</div>
                        <div style={styles.statLabel}>Task Done</div>
                    </div>
                    <div style={styles.stat}>
                        <div style={styles.statValue}>🔒</div>
                        <div style={styles.statLabel}>Data Cleared</div>
                    </div>
                    <div style={styles.stat}>
                        <div style={styles.statValue}>⭐</div>
                        <div style={styles.statLabel}>You&apos;re a Star</div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function CompletePage() {
    return (
        <Suspense fallback={<div style={{ color: "#fff", padding: "40px", textAlign: "center", fontSize: "22px" }}>Loading...</div>}>
            <CompleteContent />
        </Suspense>
    );
}

const styles: Record<string, React.CSSProperties> = {
    main: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0e1a 0%, #0d1f1a 50%, #0a0e1a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        position: "relative",
        overflow: "hidden",
    },
    card: {
        maxWidth: "480px",
        width: "100%",
        background: "var(--navy-card)",
        border: "1px solid var(--navy-border)",
        borderRadius: "var(--radius-lg)",
        padding: "48px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        position: "relative",
        zIndex: 1,
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    },
    checkWrapper: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    checkCircle: {
        width: "120px",
        height: "120px",
        background: "linear-gradient(135deg, var(--green), #16a34a)",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 32px var(--green-glow)",
    },
    heading: {
        fontSize: "40px",
        fontWeight: 900,
        color: "var(--text-primary)",
        textAlign: "center",
        letterSpacing: "-0.02em",
    },
    subtext: {
        fontSize: "22px",
        color: "var(--text-secondary)",
        textAlign: "center",
    },
    praise: {
        fontSize: "20px",
        color: "var(--teal-light)",
        textAlign: "center",
        fontWeight: 600,
    },
    divider: {
        width: "100%",
        height: "1px",
        background: "var(--navy-border)",
        margin: "4px 0",
    },
    actionsGrid: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    btnPrimary: {
        width: "100%",
        minHeight: "72px",
        background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius)",
        fontSize: "22px",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 4px 20px var(--teal-glow)",
        letterSpacing: "-0.01em",
    },
    btnSecondary: {
        width: "100%",
        minHeight: "64px",
        background: "transparent",
        color: "var(--text-secondary)",
        border: "2px solid var(--navy-border)",
        borderRadius: "var(--radius)",
        fontSize: "20px",
        fontWeight: 600,
        cursor: "pointer",
    },
    statsRow: {
        display: "flex",
        gap: "24px",
        justifyContent: "center",
        marginTop: "8px",
    },
    stat: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
    },
    statValue: {
        fontSize: "28px",
    },
    statLabel: {
        fontSize: "14px",
        color: "var(--text-muted)",
        fontWeight: 500,
    },
};
