import React, {
  createContext, useContext, useState, useEffect, useCallback,
  Component
} from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login             from "./pages/Login";
import Dashboard         from "./pages/Dashboard";
import DeepfakeDetective from "./pages/DeepfakeDetective";
import PhishBuster       from "./pages/PhishBuster";
import SocialEngineerRPG from "./pages/SocialEngineerRPG";
import NotFound          from "./pages/NotFound";
import Layout            from "./components/Layout";
import api               from "./utils/api";
import { BadgeToast, Confetti, useScoreSound } from "./utils/wow";

export const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

const BADGE_THRESHOLDS = {
  deepfake_spotter: { field: "deepfake", min: 50  },
  phish_proof:      { field: "phish",    min: 50  },
  human_firewall:   { field: "social",   min: 50  },
  cyber_guardian:   { field: "total",    min: 200 },
};

function computeBadges(scores) {
  return Object.entries(BADGE_THRESHOLDS)
    .filter(([, { field, min }]) => (scores[field] || 0) >= min)
    .map(([id]) => id);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Error Boundary ────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-14 h-14 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-danger-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="font-display font-bold text-neutral-900 text-lg mb-2">Something went wrong</h2>
          <p className="text-sm text-neutral-500 mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
          <button className="btn-primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const { playFanfare } = useScoreSound();

  // WOW state
  const [newBadge, setNewBadge]         = useState(null);   // badge ID being celebrated
  const [showConfetti, setShowConfetti] = useState(false);

  const [user, setUserState] = useState(() => {
    const token    = localStorage.getItem("cybermind_token");
    const userData = safeJSON("cybermind_user", null);
    if (userData && !userData.guest && token && isTokenExpired(token)) {
      ["cybermind_token","cybermind_user","cybermind_scores","cybermind_badges","cybermind_history"]
        .forEach(k => localStorage.removeItem(k));
      return null;
    }
    return userData;
  });

  const [scores, setScores]         = useState(() => safeJSON("cybermind_scores", { deepfake: 0, phish: 0, social: 0, total: 0 }));
  const [badges, setBadgesState]    = useState(() => safeJSON("cybermind_badges", []));
  const [sessionHistory, setHist]   = useState(() => safeJSON("cybermind_history", []));

  useEffect(() => {
    if (user) localStorage.setItem("cybermind_user", JSON.stringify(user));
    else { localStorage.removeItem("cybermind_user"); localStorage.removeItem("cybermind_token"); }
  }, [user]);
  useEffect(() => { localStorage.setItem("cybermind_scores",  JSON.stringify(scores)); }, [scores]);
  useEffect(() => { localStorage.setItem("cybermind_badges",  JSON.stringify(badges)); }, [badges]);
  useEffect(() => { localStorage.setItem("cybermind_history", JSON.stringify(sessionHistory)); }, [sessionHistory]);

  // Badge setter that also triggers WOW moment
  const setBadges = useCallback((newBadges) => {
    setBadgesState(prev => {
      const added = newBadges.filter(b => !prev.includes(b));
      if (added.length > 0) {
        // Show the first newly-earned badge with fanfare
        setTimeout(() => {
          setNewBadge(added[0]);
          setShowConfetti(true);
          playFanfare();
        }, 600); // slight delay so score animation lands first
      }
      return newBadges;
    });
  }, [playFanfare]);

  const setUser = useCallback((userData, token) => {
    setUserState(userData);
    if (token) {
      localStorage.setItem("cybermind_token", token);
      if (userData && !userData.guest && userData.scores) {
        setScores(userData.scores);
        setBadgesState(userData.badges || []);
      }
    }
  }, []);

  const updateScore = useCallback((module, points) => {
    setScores(prev => {
      const updated = {
        ...prev,
        [module]: (prev[module] || 0) + points,
        total:    (prev.total   || 0) + points,
      };
      // Use the WOW-aware setBadges
      setBadges(computeBadges(updated));

      const currentUser = safeJSON("cybermind_user", null);
      const token       = localStorage.getItem("cybermind_token");
      if (currentUser && !currentUser.guest && token) {
        api.post("/api/user/update-score", { module, points, attempt_id: uid() }).catch(() => {});
      }
      return updated;
    });
  }, [setBadges]);

  const addHistory = useCallback((entry) => {
    setHist(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    setScores({ deepfake: 0, phish: 0, social: 0, total: 0 });
    setBadgesState([]);
    setHist([]);
    ["cybermind_token","cybermind_user","cybermind_scores",
     "cybermind_badges","cybermind_history"].forEach(k => localStorage.removeItem(k));
  }, []);

  const resetProgress = useCallback(() => {
    const empty = { deepfake: 0, phish: 0, social: 0, total: 0 };
    setScores(empty);
    setBadgesState([]);
    setHist([]);
    localStorage.setItem("cybermind_scores",  JSON.stringify(empty));
    localStorage.setItem("cybermind_badges",  JSON.stringify([]));
    localStorage.setItem("cybermind_history", JSON.stringify([]));
  }, []);

  return (
    <AppContext.Provider value={{
      user, setUser, scores, badges, sessionHistory,
      updateScore, addHistory, logout, resetProgress,
    }}>
      <BrowserRouter>
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: "'DM Sans', sans-serif", fontSize: "14px", borderRadius: "12px" },
            success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />

        {/* WOW: Badge earned moment */}
        {newBadge && (
          <BadgeToast
            badgeId={newBadge}
            onDone={() => setNewBadge(null)}
          />
        )}

        {/* WOW: Confetti burst */}
        <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />

        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
            <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/deepfake"    element={<DeepfakeDetective />} />
              <Route path="/phishbuster" element={<PhishBuster />} />
              <Route path="/social-rpg"  element={<SocialEngineerRPG />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
