import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../App";
import {
  Shield, Eye, Mail, Users, LayoutDashboard, LogOut,
  Menu, X, Award, ChevronRight
} from "lucide-react";
import { AnimatedScore } from "../utils/wow";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/deepfake", icon: Eye, label: "Deepfake Detective" },
  { to: "/phishbuster", icon: Mail, label: "PhishBuster" },
  { to: "/social-rpg", icon: Users, label: "SocialEngineer RPG" },
];

export default function Layout() {
  const { user, scores, badges, logout } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const levelInfo = getLevelInfo(scores.total);

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-neutral-200 z-30 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-neutral-100">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-neutral-900 text-base leading-tight">CyberMind</h1>
            <p className="text-xs text-neutral-400 font-sans">Defense Simulator</p>
          </div>
          <button className="ml-auto lg:hidden text-neutral-400" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* User card */}
        <div className="mx-4 mt-4 p-4 bg-gradient-to-br from-primary-50 to-teal-50 rounded-xl border border-primary-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800 truncate max-w-[120px]">{user?.name}</p>
              <p className="text-xs text-primary-600 font-medium">{levelInfo.label}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-neutral-500">
              <span><AnimatedScore value={scores.total} /> pts</span>
              <span>{levelInfo.next}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: mounted ? `${levelInfo.pct}%` : "0%" }} />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm border-l-2 border-white/50"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`
              }
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award size={12} /> Badges
            </p>
            <div className="flex flex-wrap gap-1.5">
              {badges.map(b => (
                <span key={b} className="badge bg-warning-50 text-warning-600 border border-warning-100">
                  {badgeLabel(b)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-4 pb-5">
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-all">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-200 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary-600" />
            <span className="font-display font-semibold text-neutral-900 text-sm">CyberMind</span>
          </div>
          <div className="ml-auto text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
{scores.total} pts
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function getLevelInfo(total) {
  if (total < 100) return { label: "Recruit", next: "100 pts", pct: (total / 100) * 100 };
  if (total < 300) return { label: "Analyst", next: "300 pts", pct: ((total - 100) / 200) * 100 };
  if (total < 600) return { label: "Specialist", next: "600 pts", pct: ((total - 300) / 300) * 100 };
  return { label: "Guardian", next: "Max Level", pct: 100 };
}

function badgeLabel(b) {
  const map = {
    deepfake_spotter: "Deepfake Spotter",
    phish_proof: "Phish-Proof",
    human_firewall: "Human Firewall",
    cyber_guardian: "Cyber Guardian",
  };
  return map[b] || b;
}
