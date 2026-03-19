import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../App";
import { Shield, Eye, EyeOff, AlertCircle, Lock, Zap } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";

// Animated feature bullets shown alongside the form
const FEATURES = [
  { icon: Eye,    label: "Deepfake Detective",  desc: "10 real-vs-AI media samples" },
  { icon: Lock,   label: "PhishBuster Inbox",   desc: "8 India-specific scam messages" },
  { icon: Zap,    label: "SocialEngineer RPG",  desc: "3 branching attack scenarios" },
];

export default function Login() {
  const { setUser } = useApp();
  const navigate    = useNavigate();
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mounted, setMounted] = useState(false);

  // Trigger entrance animation after mount
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  const handleGuest = () => {
    setUser(
      { name: "Guest User", email: "guest@cybermind.app", guest: true, id: "guest_" + Date.now() },
      null
    );
    toast.success("Welcome, Guest! Training begins.");
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    if (mode === "signup" && form.name.trim().length < 2) { setError("Name must be at least 2 characters."); return; }
    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body     = mode === "signup"
        ? { name: form.name.trim(), email: form.email, password: form.password }
        : { email: form.email, password: form.password };
      const { data } = await api.post(endpoint, body);
      setUser(data.user, data.token);
      toast.success(mode === "signup" ? "Account created! Welcome." : "Welcome back!");
      navigate("/");
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        (err.code === "ERR_NETWORK" ? "Cannot connect to the server. Check your connection." : "Authentication failed. Please try again.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-4xl grid lg:grid-cols-2 gap-10 items-center transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>

        {/* ── Left panel: brand + features ─────────────────────── */}
        <div className="hidden lg:block">
          {/* Animated shield logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              {/* Pulse rings */}
              <div className="absolute inset-0 rounded-2xl bg-primary-400 animate-pulse-ring opacity-30" />
              <div className="absolute inset-0 rounded-2xl bg-primary-300 animate-pulse-ring opacity-20" style={{ animationDelay: "0.5s" }} />
              <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                <Shield size={28} className="text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-neutral-900">CyberMind</h1>
              <p className="text-sm text-neutral-500">Human Defense Simulator</p>
            </div>
          </div>

          <h2 className="text-3xl font-display font-bold text-neutral-900 leading-tight mb-3">
            Train to defend.<br />
            <span className="text-primary-600">Before it's real.</span>
          </h2>
          <p className="text-neutral-500 mb-8 leading-relaxed">
            Interactive simulations that teach you to spot deepfakes, phishing attacks, and social engineering — India-specific scenarios, real behavioral feedback.
          </p>

          {/* Feature list with staggered entrance */}
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-100 shadow-card"
                style={{
                  animation: `slideUp 0.4s ease-out ${i * 100 + 200}ms both`,
                }}
              >
                <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <f.icon size={17} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{f.label}</p>
                  <p className="text-xs text-neutral-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: auth form ───────────────────────────── */}
        <div>
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="relative mb-3">
              <div className="absolute inset-0 rounded-2xl bg-primary-400 animate-pulse-ring opacity-30" />
              <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                <Shield size={28} className="text-white" />
              </div>
            </div>
            <h1 className="text-xl font-display font-bold text-neutral-900">CyberMind</h1>
            <p className="text-neutral-500 text-xs">The Human Defense Simulator</p>
          </div>

          <div className="card p-8">
            {/* Mode tabs */}
            <div className="flex bg-neutral-100 rounded-xl p-1 mb-6">
              {["login", "signup"].map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-danger-50 border border-danger-200 rounded-xl mb-4 text-sm text-danger-700 animate-slide-down">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="animate-slide-down">
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name</label>
                  <input type="text" className="input-field" placeholder="Rahul Sharma"
                    value={form.name} autoComplete="name"
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                <input type="email" className="input-field" placeholder="you@example.com"
                  value={form.email} autoComplete="email"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="input-field pr-10"
                    placeholder={mode === "signup" ? "Min 8 chars, 1 letter + 1 number" : "Your password"}
                    value={form.password}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    aria-label={showPwd ? "Hide password" : "Show password"}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                {loading
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Please wait...</span>
                  : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-neutral-400">or</span></div>
            </div>

            <button onClick={handleGuest} className="btn-secondary w-full justify-center">
              Continue as Guest
            </button>
          </div>

          <p className="text-center text-xs text-neutral-400 mt-4">Train smarter. Defend better.</p>
        </div>
      </div>
    </div>
  );
}
