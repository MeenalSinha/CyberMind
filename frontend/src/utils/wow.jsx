/**
 * wow.js — All "WOW factor" utilities
 *
 * 1. useScoreSound()    — Web Audio API tones for correct/wrong answers (no external file needed)
 * 2. useConfetti()      — Pure CSS confetti burst on badge/level-up events
 * 3. AnimatedScore      — Number that counts up from prev value to next
 * 4. ScoreFloat         — "+15" chip that floats upward and fades out
 * 5. ThreatMoment       — Pulsing red border wrapper for critical RPG steps
 */
import React, { useEffect, useRef, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// 1. useScoreSound — synthesised tones, zero external files
// ─────────────────────────────────────────────────────────────────────────────
export function useScoreSound() {
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    // Resume if suspended (autoplay policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback((freq, type, duration, vol = 0.18, delay = 0) => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    } catch { /* audio not available — silent fail */ }
  }, [getCtx]);

  /** Ascending two-tone chime — correct answer */
  const playCorrect = useCallback(() => {
    playTone(523, "sine", 0.18, 0.18, 0);      // C5
    playTone(659, "sine", 0.22, 0.16, 0.12);   // E5
    playTone(784, "sine", 0.28, 0.14, 0.24);   // G5
  }, [playTone]);

  /** Low descending thud — wrong answer */
  const playWrong = useCallback(() => {
    playTone(220, "sawtooth", 0.12, 0.15, 0);  // A3
    playTone(180, "sawtooth", 0.15, 0.12, 0.1); // ~F#3
  }, [playTone]);

  /** Dramatic rising sting — critical_fail (password/OTP shared) */
  const playCritical = useCallback(() => {
    playTone(300, "sawtooth", 0.08, 0.2, 0);
    playTone(250, "sawtooth", 0.10, 0.18, 0.08);
    playTone(200, "sawtooth", 0.12, 0.25, 0.18);
    // low rumble
    playTone(80,  "sine",     0.3,  0.1,  0.1);
  }, [playTone]);

  /** Fanfare — badge or level-up earned */
  const playFanfare = useCallback(() => {
    const notes = [
      [523, 0],    // C5
      [659, 0.12], // E5
      [784, 0.24], // G5
      [1047,0.36], // C6
    ];
    notes.forEach(([f, d]) => playTone(f, "sine", 0.25, 0.15, d));
  }, [playTone]);

  return { playCorrect, playWrong, playCritical, playFanfare };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. useConfetti — CSS-only burst, no canvas, no library
// ─────────────────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#f97316",
];

export function Confetti({ active, onDone }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;
    const ps = Array.from({ length: 48 }, (_, i) => ({
      id:       i,
      left:     `${Math.random() * 100}%`,
      color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      duration: `${0.9 + Math.random() * 1.2}s`,
      delay:    `${Math.random() * 0.5}s`,
      size:     `${6 + Math.random() * 8}px`,
      rotate:   Math.random() > 0.5 ? "rotate(45deg)" : "rotate(0deg)",
    }));
    setPieces(ps);
    const t = setTimeout(() => { setPieces([]); onDone?.(); }, 2200);
    return () => clearTimeout(t);
  }, [active, onDone]);

  if (!pieces.length) return null;
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left:             p.left,
            background:       p.color,
            width:            p.size,
            height:           p.size,
            transform:        p.rotate,
            animationDuration: p.duration,
            animationDelay:   p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AnimatedScore — counts up from oldVal to newVal over ~600ms
// ─────────────────────────────────────────────────────────────────────────────
export function AnimatedScore({ value, className = "" }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef  = useRef(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to   = value;
    prevRef.current = value;
    if (from === to) return;

    const duration = 600;
    const start    = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);

  return <span className={`stat-number ${className}`}>{displayed}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ScoreFloat — the "+15" chip that pops up and fades
// ─────────────────────────────────────────────────────────────────────────────
export function ScoreFloat({ points, visible, wrong = false }) {
  if (!visible || points === 0) return null;
  return (
    <div
      className={`score-float ${wrong ? "score-float-wrong" : ""}`}
      style={{ top: "-4px", right: "8px" }}
    >
      {wrong ? points : `+${points}`}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ThreatMoment — pulsing red-ring wrapper for high-stakes RPG steps
// ─────────────────────────────────────────────────────────────────────────────
export function ThreatMoment({ active, children }) {
  return (
    <div className={`rounded-xl transition-all duration-300 ${active ? "threat-ring" : ""}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BadgeToast — full-screen badge earned moment
// ─────────────────────────────────────────────────────────────────────────────
const BADGE_META = {
  deepfake_spotter: { label: "Deepfake Spotter", color: "from-blue-500 to-indigo-600",   emoji: "👁" },
  phish_proof:      { label: "Phish-Proof",      color: "from-rose-500 to-pink-600",     emoji: "🛡" },
  human_firewall:   { label: "Human Firewall",   color: "from-emerald-500 to-teal-600",  emoji: "🔥" },
  cyber_guardian:   { label: "Cyber Guardian",   color: "from-amber-500 to-orange-500",  emoji: "⚡" },
};

export function BadgeToast({ badgeId, onDone }) {
  const [visible, setVisible] = useState(true);
  const meta = BADGE_META[badgeId] || { label: badgeId, color: "from-primary-500 to-teal-500", emoji: "★" };

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" />
      {/* Badge card */}
      <div className="relative animate-badge-pop">
        <div className={`bg-gradient-to-br ${meta.color} rounded-3xl px-10 py-8 text-center shadow-2xl`}>
          <div className="text-5xl mb-3">{meta.emoji}</div>
          <p className="text-white/80 text-xs font-medium uppercase tracking-widest mb-1">Badge Earned</p>
          <p className="text-white font-display font-bold text-2xl">{meta.label}</p>
        </div>
      </div>
    </div>
  );
}
