"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function startSession() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/session/new`);
      const data = await res.json();
      router.push(`/session?id=${data.session_id}`);
    } catch {
      // fallback: create a dummy session ID for demo
      const demoId = "demo-" + Math.random().toString(36).slice(2, 10);
      router.push(`/session?id=${demoId}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateShareLink() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/session/new`);
      const data = await res.json();
      const url = `${window.location.origin}/session?id=${data.session_id}`;
      setShareLink(url);
    } catch {
      const demoId = "demo-" + Math.random().toString(36).slice(2, 10);
      setShareLink(`${window.location.origin}/session?id=${demoId}`);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main style={styles.main}>
      {/* Background gradient orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>
        {/* Logo / Badge */}
        <div style={styles.badge} className="animate-fade-in-up">
          <span style={styles.badgeDot} />
          AI-Powered Phone Helper
        </div>

        {/* Hero Heading */}
        <h1 style={styles.heading} className="animate-fade-in-up">
          Need help with<br />
          <span style={styles.headingAccent}>your phone?</span>
        </h1>

        <p style={styles.subtext} className="animate-fade-in-up">
          TechBuddy watches your screen and tells you exactly what to tap — one simple step at a time.
        </p>

        {/* Feature pills */}
        <div style={styles.pillsRow} className="animate-fade-in-up">
          {["👁️ Sees your screen", "🎤 Hears your question", "🔊 Talks you through it"].map((t) => (
            <span key={t} style={styles.pill}>{t}</span>
          ))}
        </div>

        {/* Main CTA */}
        <button
          id="start-session-btn"
          onClick={startSession}
          disabled={loading}
          style={{ ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
          className="pulse-ring"
        >
          {loading ? (
            <span style={styles.btnContent}>
              <svg style={styles.spinner} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Starting...
            </span>
          ) : (
            <span style={styles.btnContent}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
                <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
              </svg>
              Start Help Session
            </span>
          )}
        </button>

        {/* Share Link Section */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or send a link to your parent</span>
          <span style={styles.dividerLine} />
        </div>

        {!shareLink ? (
          <button
            id="generate-link-btn"
            onClick={generateShareLink}
            disabled={loading}
            style={styles.btnSecondary}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Generate Help Link
          </button>
        ) : (
          <div style={styles.shareLinkBox} className="animate-fade-in-up">
            <p style={styles.shareLinkLabel}>Share this link with your parent:</p>
            <div style={styles.shareLinkRow}>
              <span style={styles.shareLinkText}>{shareLink}</span>
              <button
                id="copy-link-btn"
                onClick={copyLink}
                style={{ ...styles.copyBtn, ...(copied ? styles.copyBtnSuccess : {}) }}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={styles.howItWorks} className="animate-fade-in-up">
          <h2 style={styles.howTitle}>How it works</h2>
          <div style={styles.stepsRow}>
            {[
              { num: "1", label: "Tap 'Start'", desc: "Open on any phone" },
              { num: "2", label: "Share screen", desc: "AI can see your phone" },
              { num: "3", label: "Ask a question", desc: "Speak or type" },
              { num: "4", label: "Follow steps", desc: "AI guides you" },
            ].map((s) => (
              <div key={s.num} style={styles.step}>
                <div style={styles.stepNum}>{s.num}</div>
                <div style={styles.stepLabel}>{s.label}</div>
                <div style={styles.stepDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={styles.footer}>🔒 Private & secure · Sessions expire in 30 min · No data stored</p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "var(--navy)",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
  },
  orb1: {
    position: "absolute",
    top: "-200px",
    left: "-100px",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    bottom: "-200px",
    right: "-100px",
    width: "500px",
    height: "500px",
    background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  container: {
    maxWidth: "560px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    position: "relative",
    zIndex: 1,
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 20px",
    background: "rgba(20,184,166,0.1)",
    border: "1px solid rgba(20,184,166,0.3)",
    borderRadius: "100px",
    color: "var(--teal-light)",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "0.03em",
  },
  badgeDot: {
    width: "8px",
    height: "8px",
    background: "var(--teal)",
    borderRadius: "50%",
    animation: "pulse-ring 2s infinite",
  },
  heading: {
    fontSize: "clamp(42px, 8vw, 64px)",
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "var(--text-primary)",
  },
  headingAccent: {
    background: "linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 50%, var(--amber) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtext: {
    fontSize: "20px",
    color: "var(--text-secondary)",
    textAlign: "center",
    maxWidth: "440px",
    lineHeight: 1.6,
  },
  pillsRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    padding: "8px 16px",
    background: "var(--navy-card)",
    border: "1px solid var(--navy-border)",
    borderRadius: "100px",
    fontSize: "16px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  btnPrimary: {
    width: "100%",
    minHeight: "72px",
    padding: "0 32px",
    background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontSize: "22px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 24px var(--teal-glow)",
    letterSpacing: "-0.01em",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  btnContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  spinner: {
    width: "24px",
    height: "24px",
    animation: "spin 1s linear infinite",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "var(--navy-border)",
  },
  dividerText: {
    color: "var(--text-muted)",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    width: "100%",
    minHeight: "64px",
    padding: "0 32px",
    background: "transparent",
    color: "var(--teal-light)",
    border: "2px solid rgba(20,184,166,0.4)",
    borderRadius: "var(--radius)",
    fontSize: "18px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    transition: "background 0.2s, border-color 0.2s",
  },
  shareLinkBox: {
    width: "100%",
    padding: "20px",
    background: "var(--navy-card)",
    border: "1px solid var(--navy-border)",
    borderRadius: "var(--radius)",
  },
  shareLinkLabel: {
    fontSize: "16px",
    color: "var(--text-secondary)",
    marginBottom: "12px",
  },
  shareLinkRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  shareLinkText: {
    flex: 1,
    fontSize: "14px",
    color: "var(--teal-light)",
    wordBreak: "break-all",
    fontFamily: "monospace",
  },
  copyBtn: {
    minHeight: "40px",
    padding: "0 20px",
    background: "var(--navy-border)",
    color: "var(--text-primary)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 600,
    transition: "background 0.2s",
    whiteSpace: "nowrap",
  },
  copyBtnSuccess: {
    background: "var(--green)",
    color: "#fff",
  },
  howItWorks: {
    width: "100%",
    padding: "28px",
    background: "var(--navy-card)",
    border: "1px solid var(--navy-border)",
    borderRadius: "var(--radius-lg)",
  },
  howTitle: {
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "20px",
    textAlign: "center",
    color: "var(--text-primary)",
  },
  stepsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  step: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  stepNum: {
    width: "40px",
    height: "40px",
    background: "linear-gradient(135deg, var(--teal), #0d9488)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "18px",
    color: "#fff",
  },
  stepLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  stepDesc: {
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  footer: {
    fontSize: "14px",
    color: "var(--text-muted)",
    textAlign: "center",
  },
};
