import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useApp } from "../App";
import { Eye, Mail, Users, Award, TrendingUp, Clock, ChevronRight, Shield, Lock, Zap, BarChart2, CheckCircle2 } from "lucide-react";
import { AnimatedScore } from "../utils/wow";

const modules = [
  {
    id: "deepfake", to: "/deepfake", icon: Eye,
    title: "Deepfake Detective",
    description: "Identify AI-generated images, audio, and video used in scams.",
    bg: "bg-blue-50", border: "border-blue-100", iconColor: "text-blue-600", scoreKey: "deepfake",
  },
  {
    id: "phish", to: "/phishbuster", icon: Mail,
    title: "PhishBuster",
    description: "Classify phishing emails, SMS scams, and WhatsApp fraud.",
    bg: "bg-rose-50", border: "border-rose-100", iconColor: "text-rose-600", scoreKey: "phish",
  },
  {
    id: "social", to: "/social-rpg", icon: Users,
    title: "SocialEngineer RPG",
    description: "Story-based simulations. Your decisions determine if the attacker wins.",
    bg: "bg-emerald-50", border: "border-emerald-100", iconColor: "text-emerald-600", scoreKey: "social",
  },
];

const badgeData = [
  { id: "deepfake_spotter", label: "Deepfake Spotter", desc: "Score 50+ in Deepfake Detective", icon: Eye, color: "text-blue-600 bg-blue-50 border-blue-100" },
  { id: "phish_proof", label: "Phish-Proof", desc: "Score 50+ in PhishBuster", icon: Lock, color: "text-rose-600 bg-rose-50 border-rose-100" },
  { id: "human_firewall", label: "Human Firewall", desc: "Score 50+ in Social RPG", icon: Shield, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { id: "cyber_guardian", label: "Cyber Guardian", desc: "Score 200+ total", icon: Zap, color: "text-amber-600 bg-amber-50 border-amber-100" },
];

export default function Dashboard() {
  const { user, setUser, scores, badges, sessionHistory } = useApp();
  const navigate  = useNavigate();
  const level     = getLevelInfo(scores.total);

  // Progress data from backend (session history per module)
  const [progressData, setProgressData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("cybermind_token");
    if (!user || user.guest || !token) return;
    api.get("/api/user/me")
      .then(res => {
        if (res.data?.scores) {
          const serverTotal = res.data.scores.total || 0;
          const localTotal  = scores.total || 0;
          if (serverTotal > localTotal) {
            // Only update known score/badge fields — don't spread unknown server fields onto user
            setUser({
              ...user,
              scores: res.data.scores,
              badges: res.data.badges || [],
            }, token);
          }
        }
      })
      .catch(() => {});

    api.get("/api/user/progress")
      .then(res => { if (res.data) setProgressData(res.data); })
      .catch(() => {});
  }, []); // intentional: run once on mount — scores/user in closure are the initial values we want

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-display font-bold text-neutral-900">
          Welcome back, {user?.name?.split(" ")[0]}
        </h2>
        <p className="text-neutral-500 text-sm mt-0.5">Continue your cybersecurity training journey.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Score" value={scores.total} icon={TrendingUp} color="text-primary-600 bg-primary-50" />
        <StatCard label="Deepfake" value={scores.deepfake} icon={Eye} color="text-blue-600 bg-blue-50" />
        <StatCard label="PhishBuster" value={scores.phish} icon={Mail} color="text-rose-600 bg-rose-50" />
        <StatCard label="Social RPG" value={scores.social} icon={Users} color="text-emerald-600 bg-emerald-50" />
      </div>

      {/* Level progress */}
      <div className="card p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-neutral-700">Level: </span>
            <span className="text-sm font-bold text-primary-600">{level.label}</span>
          </div>
          <span className="text-xs text-neutral-400">{scores.total} / {level.max} pts</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${level.pct}%` }} /></div>
        <p className="text-xs text-neutral-400 mt-2">{level.next}</p>
      </div>

      {/* Module cards */}
      <h3 className="text-base font-display font-semibold text-neutral-800 mb-4">Training Modules</h3>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {modules.map((m, idx) => (
          <div key={m.id} onClick={() => navigate(m.to)}
            className={`module-card group ${m.bg} border ${m.border} animate-fade-in`}
            style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}>
            <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 ${m.iconColor}`}>
              <m.icon size={20} />
            </div>
            <h4 className="font-display font-semibold text-neutral-900 mb-1.5 text-sm">{m.title}</h4>
            <p className="text-xs text-neutral-500 leading-relaxed mb-4">{m.description}</p>

            {/* Module score bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Score</span>
                <span className="font-semibold text-neutral-700">{scores[m.scoreKey]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/70">
                <div className="h-full rounded-full bg-current transition-all duration-700"
                  style={{ width: `${Math.min((scores[m.scoreKey] / 120) * 100, 100)}%`, opacity: 0.6 }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                {scores[m.scoreKey] >= 50
                  ? <span className="flex items-center gap-1 text-success-600 font-semibold"><CheckCircle2 size={12} />Badge earned</span>
                  : `${50 - scores[m.scoreKey]} pts to badge`}
              </span>
              <div className={`flex items-center gap-1 text-xs font-medium ${m.iconColor} group-hover:gap-2 transition-all`}>
                {scores[m.scoreKey] > 0 ? "Continue" : "Start"} <ChevronRight size={13} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress trend + badges row */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {/* Improvement trend */}
        <div>
          <h3 className="text-base font-display font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-primary-400" /> Improvement Trend
          </h3>
          {progressData?.sessions_by_module ? (
            <div className="card p-5 space-y-4">
              {["deepfake", "phish", "social"].map(mod => {
                const sessions = progressData.sessions_by_module[mod] || [];
                const latest   = sessions[sessions.length - 1];
                const prev     = sessions[sessions.length - 2];
                const trend    = latest && prev ? latest.score - prev.score : null;
                const modLabel = { deepfake: "Deepfake", phish: "PhishBuster", social: "Social RPG" }[mod];
                const color    = { deepfake: "bg-blue-400", phish: "bg-rose-400", social: "bg-emerald-400" }[mod];
                return (
                  <div key={mod}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-600">{modLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                        {trend !== null && (
                          <span className={`text-xs font-semibold ${trend >= 0 ? "text-success-600" : "text-danger-600"}`}>
                            {trend >= 0 ? "+" : ""}{trend}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end gap-1 h-8">
                      {sessions.length === 0 ? (
                        <div className="text-xs text-neutral-300 italic">No sessions yet</div>
                      ) : (
                        sessions.slice(-8).map((s, i) => {
                          const maxScore = Math.max(...sessions.slice(-8).map(x => x.score), 1);
                          const barH = Math.max((s.score / maxScore) * 28, 4);
                          return (
                            <div key={i} title={`Score: ${s.score}`}
                              className={`rounded-sm ${color} opacity-70 flex-1 transition-all`}
                              style={{ height: `${barH}px` }} />
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
              {progressData.total_sessions === 0 && (
                <p className="text-xs text-neutral-400 text-center pt-2">Complete modules to see your progress trend here.</p>
              )}
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              {["Deepfake", "PhishBuster", "Social RPG"].map(label => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-600">{label}</span>
                    <span className="text-xs text-neutral-300 italic">No data yet</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100" />
                </div>
              ))}
              <p className="text-xs text-neutral-400 text-center pt-1">Complete modules to track your improvement.</p>
            </div>
          )}
        </div>

        {/* Badges */}
        <div>
          <h3 className="text-base font-display font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Award size={16} className="text-amber-500" /> Skill Badges
          </h3>
          <div className="space-y-3">
            {badgeData.map(b => (
              <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${badges.includes(b.id) ? b.color : "bg-neutral-50 border-neutral-100 text-neutral-400"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${badges.includes(b.id) ? "bg-white shadow-sm" : "bg-neutral-100"}`}>
                  <b.icon size={15} className={badges.includes(b.id) ? "" : "text-neutral-300"} />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${badges.includes(b.id) ? "" : "text-neutral-400"}`}>{b.label}</p>
                  <p className="text-xs text-neutral-400">{b.desc}</p>
                </div>
                {badges.includes(b.id) && <div className="ml-auto text-xs font-bold text-amber-500">Earned</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-base font-display font-semibold text-neutral-800 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-neutral-400" /> Recent Activity
        </h3>
        {sessionHistory.length === 0 ? (
          <div className="card p-6 text-center text-neutral-400 text-sm">
            Complete a module to see your activity here.
          </div>
        ) : (
          <div className="space-y-2">
            {sessionHistory.slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.correct ? "bg-success-500" : "bg-danger-500"}`} />
                <span className="text-neutral-600 flex-1 truncate">{h.label}</span>
                <span className={`text-xs font-semibold ${h.correct ? "text-success-600" : "text-danger-600"}`}>
                  {h.correct ? `+${h.points}` : "0"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, highlight }) {
  return (
    <div className={`card p-4 hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 ${highlight ? "ring-2 ring-primary-200" : ""}`}>
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon size={15} />
      </div>
      <p className="text-xl font-display font-bold text-neutral-900">
        <AnimatedScore value={value} />
      </p>
      <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}

function getLevelInfo(total) {
  if (total < 100) return { label: "Recruit",    max: 100, pct: total,                   next: `${100 - total} pts to Analyst` };
  if (total < 300) return { label: "Analyst",    max: 300, pct: ((total-100)/200)*100,   next: `${300 - total} pts to Specialist` };
  if (total < 600) return { label: "Specialist", max: 600, pct: ((total-300)/300)*100,   next: `${600 - total} pts to Guardian` };
  return             { label: "Guardian",   max: 600, pct: 100,                      next: "Maximum level reached" };
}
