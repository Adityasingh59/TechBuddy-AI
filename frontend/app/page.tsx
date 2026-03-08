"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PRESET_TASKS = [
  { emoji: "💸", label: "Send Money", task: "send money on Venmo or payment app" },
  { emoji: "💬", label: "Send a Message", task: "send a WhatsApp message to someone" },
  { emoji: "📞", label: "Make a Call", task: "call someone on my phone" },
  { emoji: "📧", label: "Send an Email", task: "send an email" },
  { emoji: "🗺️", label: "Get Directions", task: "get directions on Google Maps" },
  { emoji: "🚗", label: "Book an Uber", task: "book an Uber ride" },
  { emoji: "📸", label: "Take a Photo", task: "take a photo" },
  { emoji: "▶️", label: "Watch YouTube", task: "watch a video on YouTube" },
  { emoji: "📱", label: "Instagram Post", task: "post a photo on Instagram" },
  { emoji: "📶", label: "Connect to WiFi", task: "connect to WiFi" },
  { emoji: "⚙️", label: "Change Settings", task: "change a setting on my phone" },
];

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customTask, setCustomTask] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveTask = selectedPreset ?? customTask;

  async function startSession(taskOverride?: string) {
    const task = taskOverride ?? effectiveTask;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      const taskParam = encodeURIComponent(task);
      router.push(`/session?id=${data.session_id}&task=${taskParam}`);
    } catch {
      const demoId = "demo-" + Math.random().toString(36).slice(2, 10);
      router.push(`/session?id=${demoId}&task=${encodeURIComponent(task)}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateShareLink() {
    const task = effectiveTask;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      const taskParam = encodeURIComponent(task);
      const url = `${window.location.origin}/session?id=${data.session_id}&task=${taskParam}`;
      setShareLink(url);
    } catch {
      const demoId = "demo-" + Math.random().toString(36).slice(2, 10);
      setShareLink(`${window.location.origin}/session?id=${demoId}&task=${encodeURIComponent(task)}`);
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
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>
        {/* Badge */}
        <div style={styles.badge} className="animate-fade-in-up">
          <span style={styles.badgeDot} />
          AI-Powered Phone Helper
        </div>

        {/* Heading */}
        <h1 style={styles.heading} className="animate-fade-in-up">
          Need help with<br />
          <span style={styles.headingAccent}>your phone?</span>
        </h1>

        <p style={styles.subtext} className="animate-fade-in-up">
          Tell TechBuddy what you want to do. It watches your screen and guides you — one simple step at a time.
        </p>

        {/* ── Task Selection ── */}
        <div style={styles.taskCard} className="animate-fade-in-up">
          <h2 style={styles.taskTitle}>What do you want to do?</h2>

          {/* Preset grid */}
          <div style={styles.presetGrid}>
            {PRESET_TASKS.map((pt) => (
              <button
                key={pt.task}
                onClick={() => {
                  setSelectedPreset(pt.task);
                  setCustomTask("");
                }}
                style={{
                  ...styles.presetBtn,
                  ...(selectedPreset === pt.task ? styles.presetBtnActive : {}),
                }}
              >
                <span style={styles.presetEmoji}>{pt.emoji}</span>
                <span style={styles.presetLabel}>{pt.label}</span>
              </button>
            ))}
          </div>

          {/* Custom task input */}
          <div style={styles.orDivider}>
            <span style={styles.orLine} />
            <span style={styles.orText}>or describe your own task</span>
            <span style={styles.orLine} />
          </div>

          <input
            id="custom-task-input"
            type="text"
            placeholder="e.g. 'Order food on DoorDash' or 'Reset my password'"
            value={customTask}
            onChange={(e) => { setCustomTask(e.target.value); setSelectedPreset(null); }}
            style={styles.taskInput}
          />

          {/* Current task display */}
          {effectiveTask && (
            <div style={styles.selectedTaskBadge}>
              <span>🎯</span>
              <span style={{ fontWeight: 600 }}>Task: </span>
              <span>{effectiveTask}</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          id="start-session-btn"
          onClick={() => startSession()}
          disabled={loading}
          style={{ ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
          className={!loading ? "pulse-ring" : ""}
        >
          {loading ? (
            <span style={styles.btnContent}>
              <svg style={{ width: 24, height: 24, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
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
              {effectiveTask ? `Start: ${effectiveTask.slice(0, 28)}${effectiveTask.length > 28 ? "…" : ""}` : "Start Help Session"}
            </span>
          )}
        </button>

        {/* Share link */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or send a link to your parent</span>
          <span style={styles.dividerLine} />
        </div>

        {!shareLink ? (
          <button id="generate-link-btn" onClick={generateShareLink} disabled={loading} style={styles.btnSecondary}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Generate Help Link
          </button>
        ) : (
          <div style={styles.shareLinkBox} className="animate-fade-in-up">
            <p style={styles.shareLinkLabel}>Share this link — task is pre-loaded for them:</p>
            <div style={styles.shareLinkRow}>
              <span style={styles.shareLinkText}>{shareLink}</span>
              <button id="copy-link-btn" onClick={copyLink} style={{ ...styles.copyBtn, ...(copied ? styles.copyBtnSuccess : {}) }}>
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
              { num: "1", label: "Pick a task", desc: "Choose from presets or type your own" },
              { num: "2", label: "Share screen", desc: "AI can see your phone" },
              { num: "3", label: "Ask or tap mic", desc: "Speak or type" },
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
  main: { minHeight: "100vh", background: "var(--navy)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" },
  orb1: { position: "absolute", top: "-200px", left: "-100px", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  orb2: { position: "absolute", bottom: "-200px", right: "-100px", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  container: { maxWidth: "620px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", position: "relative", zIndex: 1 },
  badge: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "100px", color: "var(--teal-light)", fontSize: "14px", fontWeight: 600 },
  badgeDot: { width: "8px", height: "8px", background: "var(--teal)", borderRadius: "50%", animation: "pulse-ring 2s infinite" },
  heading: { fontSize: "clamp(40px, 8vw, 60px)", fontWeight: 900, textAlign: "center", lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)" },
  headingAccent: { background: "linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 50%, var(--amber) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  subtext: { fontSize: "19px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "480px", lineHeight: 1.6 },
  taskCard: { width: "100%", padding: "24px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "16px" },
  taskTitle: { fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", textAlign: "center" },
  presetGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" },
  presetBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "12px 8px", background: "var(--navy)", border: "1px solid var(--navy-border)", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s", minHeight: "70px", justifyContent: "center" },
  presetBtnActive: { background: "rgba(20,184,166,0.15)", border: "2px solid var(--teal)", boxShadow: "0 0 12px var(--teal-glow)" },
  presetEmoji: { fontSize: "24px" },
  presetLabel: { fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.2 },
  orDivider: { display: "flex", alignItems: "center", gap: "10px" },
  orLine: { flex: 1, height: "1px", background: "var(--navy-border)" },
  orText: { fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" },
  taskInput: { width: "100%", height: "52px", background: "var(--navy)", border: "1px solid var(--navy-border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "17px", padding: "0 16px", outline: "none" },
  selectedTaskBadge: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "10px", color: "var(--teal-light)", fontSize: "15px" },
  btnPrimary: { width: "100%", minHeight: "72px", padding: "0 32px", background: "linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "20px", fontWeight: 700, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 4px 24px var(--teal-glow)", letterSpacing: "-0.01em" },
  btnDisabled: { opacity: 0.7, cursor: "not-allowed" },
  btnContent: { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" },
  divider: { display: "flex", alignItems: "center", gap: "12px", width: "100%" },
  dividerLine: { flex: 1, height: "1px", background: "var(--navy-border)" },
  dividerText: { color: "var(--text-muted)", fontSize: "14px", whiteSpace: "nowrap" },
  btnSecondary: { width: "100%", minHeight: "64px", padding: "0 32px", background: "transparent", color: "var(--teal-light)", border: "2px solid rgba(20,184,166,0.4)", borderRadius: "var(--radius)", fontSize: "18px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" },
  shareLinkBox: { width: "100%", padding: "20px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius)" },
  shareLinkLabel: { fontSize: "15px", color: "var(--text-secondary)", marginBottom: "12px" },
  shareLinkRow: { display: "flex", gap: "10px", alignItems: "center" },
  shareLinkText: { flex: 1, fontSize: "13px", color: "var(--teal-light)", wordBreak: "break-all", fontFamily: "monospace" },
  copyBtn: { minHeight: "40px", padding: "0 20px", background: "var(--navy-border)", color: "var(--text-primary)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "15px", fontWeight: 600, whiteSpace: "nowrap" },
  copyBtnSuccess: { background: "var(--green)", color: "#fff" },
  howItWorks: { width: "100%", padding: "24px", background: "var(--navy-card)", border: "1px solid var(--navy-border)", borderRadius: "var(--radius-lg)" },
  howTitle: { fontSize: "18px", fontWeight: 700, marginBottom: "18px", textAlign: "center", color: "var(--text-primary)" },
  stepsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" },
  step: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" },
  stepNum: { width: "36px", height: "36px", background: "linear-gradient(135deg, var(--teal), #0d9488)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "16px", color: "#fff" },
  stepLabel: { fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" },
  stepDesc: { fontSize: "12px", color: "var(--text-muted)" },
  footer: { fontSize: "14px", color: "var(--text-muted)", textAlign: "center" },
};
