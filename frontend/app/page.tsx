"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const EXAMPLE_TASKS = [
  "Send money on Venmo",
  "Book an Uber",
  "Order food on DoorDash",
  "Post a photo on Instagram",
  "Set up WhatsApp",
  "Connect to WiFi",
  "Turn on accessibility mode",
  "Find a contact and call them",
];

export default function LandingPage() {
  const router = useRouter();
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function createSession(taskText: string): Promise<string> {
    try {
      const res = await fetch(`${API_URL}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskText }),
      });
      const data = await res.json();
      return data.session_id;
    } catch {
      return "demo-" + Math.random().toString(36).slice(2, 10);
    }
  }

  async function startSession() {
    setLoading(true);
    const sessionId = await createSession(task);
    const taskParam = encodeURIComponent(task);
    router.push(`/session?id=${sessionId}&task=${taskParam}`);
  }

  async function generateShareLink() {
    setLoading(true);
    const sessionId = await createSession(task);
    const taskParam = encodeURIComponent(task);
    setShareLink(`${window.location.origin}/session?id=${sessionId}&task=${taskParam}`);
    setLoading(false);
  }

  function copyLink() {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function useExample(example: string) {
    setTask(example);
    inputRef.current?.focus();
  }

  return (
    <main style={styles.main}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>

        {/* Badge */}
        <div style={styles.badge}>
          <span style={styles.badgeDot} />
          AI-Powered Phone Helper
        </div>

        {/* Heading */}
        <h1 style={styles.heading}>
          Need help with<br />
          <span style={styles.headingGradient}>your phone?</span>
        </h1>

        <p style={styles.subtext}>
          Tell TechBuddy what you want to do. It watches your screen and guides you — one step at a time, for any task.
        </p>

        {/* ── Task input ── */}
        <div style={styles.card}>
          <label style={styles.label} htmlFor="task-input">
            What do you need help with?
          </label>
          <input
            id="task-input"
            ref={inputRef}
            type="text"
            autoFocus
            placeholder="Describe anything… e.g. 'Set up Face ID' or 'Find my photos'"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) startSession(); }}
            style={styles.input}
          />

          {/* Example tags */}
          <div style={styles.examplesRow}>
            {EXAMPLE_TASKS.map((ex) => (
              <button
                key={ex}
                onClick={() => useExample(ex)}
                style={styles.exampleTag}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          id="start-session-btn"
          onClick={startSession}
          disabled={loading}
          style={{ ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
          className={!loading ? "pulse-ring" : ""}
        >
          {loading ? (
            <span style={styles.btnRow}>
              <svg style={{ width: 24, height: 24, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Starting session...
            </span>
          ) : (
            <span style={styles.btnRow}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" opacity="0.18" />
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
              Start Help Session
            </span>
          )}
        </button>

        {/* Divider */}
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
            Generate Share Link
          </button>
        ) : (
          <div style={styles.shareBox}>
            <p style={styles.shareLabel}>Share this link — task is pre-loaded:</p>
            <div style={styles.shareRow}>
              <span style={styles.shareUrl}>{shareLink}</span>
              <button
                id="copy-link-btn"
                onClick={copyLink}
                style={{ ...styles.copyBtn, ...(copied ? styles.copyBtnDone : {}) }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={styles.howCard}>
          <h2 style={styles.howTitle}>How it works</h2>
          <div style={styles.stepsRow}>
            {[
              { n: "1", title: "Describe your task", desc: "Type anything in plain English" },
              { n: "2", title: "Share your screen", desc: "AI sees exactly what's on your phone" },
              { n: "3", title: "AI analyzes the screen", desc: "Identifies every button & element" },
              { n: "4", title: "Follow one step at a time", desc: "Clear, spoken guidance" },
            ].map((s) => (
              <div key={s.n} style={styles.step}>
                <div style={styles.stepNum}>{s.n}</div>
                <div style={styles.stepTitle}>{s.title}</div>
                <div style={styles.stepDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={styles.footer}>🔒 Private &amp; secure · Sessions expire in 30 min · No data stored</p>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--navy)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" },
  orb1: { position: "fixed", top: "-200px", left: "-100px", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  orb2: { position: "fixed", bottom: "-150px", right: "-80px", width: "450px", height: "450px", background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  container: { maxWidth: "580px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", position: "relative", zIndex: 1 },
  badge: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "100px", color: "var(--teal-light)", fontSize: "14px", fontWeight: 600 },
  badgeDot: { width: "8px", height: "8px", background: "var(--teal)", borderRadius: "50%", animation: "pulse-ring 2s infinite" },
  heading: { fontSize: "clamp(38px, 8vw, 58px)", fontWeight: 900, textAlign: "center", lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: 0 },
  headingGradient: { background: "linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 50%, var(--amber) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  subtext: { fontSize: "18px", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6, maxWidth: "460px", margin: 0 },
  card: { width: "100%", padding: "22px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "14px" },
  label: { fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" },
  input: { width: "100%", height: "58px", background: "var(--navy)", border: "2px solid var(--navy-border)", borderRadius: "14px", color: "var(--text-primary)", fontSize: "18px", padding: "0 18px", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" },
  examplesRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
  exampleTag: { padding: "7px 14px", background: "var(--navy)", border: "1px solid var(--navy-border)", borderRadius: "100px", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", transition: "all 0.15s" },
  btnPrimary: { width: "100%", minHeight: "68px", background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 24px var(--teal-glow)", letterSpacing: "-0.01em" },
  btnDisabled: { opacity: 0.65, cursor: "not-allowed" },
  btnRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" },
  divider: { display: "flex", alignItems: "center", gap: "12px", width: "100%" },
  dividerLine: { flex: 1, height: "1px", background: "var(--navy-border)" },
  dividerText: { color: "var(--text-muted)", fontSize: "13px", whiteSpace: "nowrap" },
  btnSecondary: { width: "100%", minHeight: "58px", background: "transparent", color: "var(--teal-light)", border: "2px solid rgba(20,184,166,0.35)", borderRadius: "var(--radius)", fontSize: "17px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" },
  shareBox: { width: "100%", padding: "18px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)" },
  shareLabel: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "10px" },
  shareRow: { display: "flex", gap: "10px", alignItems: "center" },
  shareUrl: { flex: 1, fontSize: "12px", color: "var(--teal-light)", wordBreak: "break-all", fontFamily: "monospace" },
  copyBtn: { padding: "8px 18px", background: "var(--navy-border)", color: "var(--text-primary)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap" },
  copyBtnDone: { background: "var(--green)", color: "#fff" },
  howCard: { width: "100%", padding: "22px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)" },
  howTitle: { fontSize: "17px", fontWeight: 700, textAlign: "center", color: "var(--text-primary)", marginBottom: "16px" },
  stepsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" },
  step: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "6px" },
  stepNum: { width: "34px", height: "34px", background: "linear-gradient(135deg, var(--teal), #0d9488)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "15px", color: "#fff" },
  stepTitle: { fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" },
  stepDesc: { fontSize: "11px", color: "var(--text-muted)" },
  footer: { fontSize: "13px", color: "var(--text-muted)", textAlign: "center" },
};
