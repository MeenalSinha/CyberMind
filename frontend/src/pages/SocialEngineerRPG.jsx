import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../App";
import { Users, CheckCircle, XCircle, ChevronRight, RotateCcw, AlertTriangle, Info, Eye, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useScoreSound, ThreatMoment, ScoreFloat } from "../utils/wow";

// Local fallback data — mirrors backend exactly, used if API is unreachable
const LOCAL_SCENARIOS = [
  {
    id: "fake_it_support",
    title: "Fake IT Support Attack",
    description: "You receive a call from someone claiming to be from your company's IT department.",
    context: "It's Monday morning. You're at your work desk. Your phone rings.",
    difficulty: "Medium",
    maxScore: 100,
    steps: [
      {
        id: 1, name: "Rajesh Kumar (IT Dept)",
        message: "Hello, this is Rajesh from IT support. We've detected unusual login activity on your company account from a location in Bangalore. Are you currently in Bangalore?",
        choices: [
          { id: "a", text: "No, I'm in Delhi. What's going on?", score: 0, label: "vulnerable", consequence: "You confirmed your location — useful information for the attacker." },
          { id: "b", text: "Can you verify your employee ID and department first?", score: 25, label: "cautious", consequence: "Good instinct. You asked for verification before sharing anything." },
          { id: "c", text: "I'll hang up and call IT directly through the official number.", score: 35, label: "secure", consequence: "Excellent. Never trust inbound calls claiming to be IT." },
        ],
      },
      {
        id: 2, name: "Rajesh Kumar (IT Dept)",
        message: "Our system shows your account is at risk. To secure it immediately, I need you to open your email and click a link I'm sending you right now.",
        choices: [
          { id: "a", text: "Ok, I see it — should I click it?", score: 0, label: "vulnerable", consequence: "Never click unsolicited links from inbound callers." },
          { id: "b", text: "I'm not clicking any links without checking with my manager first.", score: 20, label: "cautious", consequence: "Good pause. Checking with your manager is a solid step." },
          { id: "c", text: "Legitimate IT tools are installed internally. I won't click external links.", score: 30, label: "secure", consequence: "Real IT departments don't send security tools via email links." },
        ],
      },
      {
        id: 3, name: "Rajesh Kumar (IT Dept)",
        message: "This is urgent. We only have a 15-minute window before your account is permanently locked. I'll need your current password to transfer your data to a secure account.",
        choices: [
          { id: "a", text: "Alright, it's Company@2024.", score: -20, label: "critical_fail", consequence: "Critical mistake. No IT team ever needs your password." },
          { id: "b", text: "I'm not comfortable sharing my password.", score: 20, label: "cautious", consequence: "Correct instinct. But you should also report this call immediately." },
          { id: "c", text: "This is a scam. No IT team ever asks for passwords. I'm reporting this call.", score: 35, label: "secure", consequence: "Excellent. Identifying and reporting is the ideal response." },
        ],
      },
      {
        id: 4, name: "Rajesh Kumar (IT Dept)",
        message: "Fine. But at minimum I need you to install this remote access tool so I can fix the issue without your password. It'll only take 2 minutes.",
        choices: [
          { id: "a", text: "Ok, I'll install it. What's the link?", score: -20, label: "critical_fail", consequence: "Remote access tools give attackers full control of your machine." },
          { id: "b", text: "I need to get written approval from my manager before installing anything.", score: 20, label: "cautious", consequence: "Good protocol. Manager approval creates a paper trail." },
          { id: "c", text: "I'm ending this call. I'll email security@company.com to report this incident.", score: 35, label: "secure", consequence: "Ending suspicious calls and reporting to the security team is exactly right." },
        ],
      },
    ],
    attackerPlaybook: [
      "Step 1: Pretexting — Claim authority (IT support)",
      "Step 2: Create urgency — 'Account will be locked'",
      "Step 3: Build rapport — Ask simple yes/no questions first",
      "Step 4: Escalate — Location > Click link > Password > Remote access",
      "Step 5: Isolate target — 'Don't tell your manager yet'",
      "Defense: Hang up. Call IT directly. Report the call.",
    ],
  },
  {
    id: "upi_fraud_call",
    title: "UPI Fraud — Fake Bank Agent",
    description: "A caller claims to be from your bank and says your UPI account has been blocked.",
    context: "You're at home on a Sunday afternoon. Your phone rings from an unknown number.",
    difficulty: "Easy",
    maxScore: 90,
    steps: [
      {
        id: 1, name: "Agent Vikram (HDFC Bank)",
        message: "Namaste, I'm calling from HDFC Bank fraud department. Your UPI ID has been flagged for suspicious transactions. To protect your account, I need to verify your identity. Can you confirm your registered mobile number?",
        choices: [
          { id: "a", text: "Sure, it's 9876543210.", score: 0, label: "vulnerable", consequence: "You confirmed your number — the attacker now has one piece of your identity." },
          { id: "b", text: "How do I know you're actually from HDFC Bank?", score: 25, label: "cautious", consequence: "Good question. Always challenge callers claiming to be from your bank." },
          { id: "c", text: "I'll hang up and call HDFC's official number 1800-202-6161 myself.", score: 35, label: "secure", consequence: "Perfect. Real banks never ask you to verify via inbound calls." },
        ],
      },
      {
        id: 2, name: "Agent Vikram (HDFC Bank)",
        message: "To reverse the suspicious transaction of Rs 15,000, I need your UPI PIN to authenticate the reversal process from our end.",
        choices: [
          { id: "a", text: "Ok, my UPI PIN is 4821.", score: -30, label: "critical_fail", consequence: "Critical! You just gave away your UPI PIN. The attacker can now drain your account completely." },
          { id: "b", text: "I don't think banks need my PIN to reverse transactions.", score: 20, label: "cautious", consequence: "Correct instinct! Banks process reversals on their end — they never need your PIN." },
          { id: "c", text: "No bank ever needs your UPI PIN. This is a scam. I'm blocking this number.", score: 35, label: "secure", consequence: "Exactly right. Your UPI PIN is like your ATM PIN — share it with nobody." },
        ],
      },
      {
        id: 3, name: "Agent Vikram (HDFC Bank)",
        message: "I understand your concern. Let me send you an OTP on your registered number. Please share it immediately so we can block the fraudulent transaction before it's too late.",
        choices: [
          { id: "a", text: "Ok, the OTP I received is 724816.", score: -30, label: "critical_fail", consequence: "Never share OTPs. OTPs authorize transactions — you just authorized the fraud yourself." },
          { id: "b", text: "Wait — if you're from the bank, why do you need an OTP from me?", score: 20, label: "cautious", consequence: "Smart question. Banks generate OTPs to authenticate customers, not to receive them back." },
          { id: "c", text: "OTPs are never shared with anyone. Hanging up now and reporting to cybercrime.gov.in.", score: 35, label: "secure", consequence: "Perfect. Report to the National Cyber Crime Portal (cybercrime.gov.in) or call 1930." },
        ],
      },
    ],
    attackerPlaybook: [
      "Step 1: Spoof or fake a bank caller ID",
      "Step 2: Create fear — 'Your account has suspicious activity'",
      "Step 3: Ask for mobile number — builds false trust",
      "Step 4: Request UPI PIN under guise of 'reversal authentication'",
      "Step 5: Request OTP — each OTP authorizes a transaction",
      "Defense: Hang up. Call bank directly. Never share PIN or OTP.",
    ],
  },
  {
    id: "romance_scam",
    title: "Romance / Investment Scam",
    description: "Someone you met online asks you to invest in a 'guaranteed return' trading platform.",
    context: "You've been chatting online for 3 weeks with someone named 'Priya'. Today she mentions an investment opportunity.",
    difficulty: "Hard",
    maxScore: 110,
    steps: [
      {
        id: 1, name: "Priya (Online Contact)",
        message: "Hey! I wanted to share something amazing. My cousin works at a crypto trading firm. I invested Rs 10,000 last month and already made Rs 45,000! The app shows live profits. You should try it — I can help you set it up.",
        choices: [
          { id: "a", text: "That sounds incredible! Send me the app link right away.", score: 0, label: "vulnerable", consequence: "High returns with no risk are the #1 sign of investment fraud." },
          { id: "b", text: "That's a huge return. What's the name of the firm? I'll research it first.", score: 25, label: "cautious", consequence: "Good step. Always verify investment platforms independently." },
          { id: "c", text: "Returns like that in a month are impossible without extreme risk. I won't invest based on social media recommendations.", score: 35, label: "secure", consequence: "Correct. Legitimate investments don't promise 300-400% returns in a month." },
        ],
      },
      {
        id: 2, name: "Priya (Online Contact)",
        message: "I understand you're careful. Let me show you — just send Rs 5,000 to my UPI: priya.invest@okaxis. You'll see the profit in 48 hours. You can withdraw anytime.",
        choices: [
          { id: "a", text: "Ok, I'll send Rs 5,000 to see how it works.", score: -20, label: "critical_fail", consequence: "The 'trial investment' is the hook. The app shows fake profits. When you invest more, you'll lose everything." },
          { id: "b", text: "Why would I send money to your personal UPI? Real investment firms have official accounts.", score: 25, label: "cautious", consequence: "Exactly right. SEBI-registered investment firms never accept money through personal UPI IDs." },
          { id: "c", text: "Sending money to a personal UPI for 'investment' is a textbook scam. I'm ending this conversation.", score: 35, label: "secure", consequence: "Perfect. Block and report to cybercrime.gov.in. Real investments go through SEBI-registered platforms only." },
        ],
      },
      {
        id: 3, name: "Priya (Online Contact)",
        message: "I can't believe you'd doubt me after all we've talked about. I've never asked you for anything before. This is real — my whole family uses this app. Please, just try it for me.",
        choices: [
          { id: "a", text: "You're right, I'm sorry. I trust you. I'll send Rs 10,000.", score: -20, label: "critical_fail", consequence: "This is the emotional manipulation phase. Scammers exploit trust built over weeks." },
          { id: "b", text: "I care about our friendship but I don't mix money and personal relationships.", score: 20, label: "cautious", consequence: "Good boundary. But consider — this pattern matches romance scam tactics exactly." },
          { id: "c", text: "Guilt-tripping me about money is a manipulation tactic. I'm done. I'm reporting this profile.", score: 35, label: "secure", consequence: "Brave and correct. Romance scammers spend weeks building emotional dependency before the financial ask." },
        ],
      },
    ],
    attackerPlaybook: [
      "Step 1: Build emotional connection over 2-4 weeks on social apps",
      "Step 2: Introduce 'incredible investment opportunity' via trusted contact",
      "Step 3: Show fake profit screenshots to build credibility",
      "Step 4: Offer 'trial investment' — app shows fake gains",
      "Step 5: Emotional pressure when victim hesitates",
      "Step 6: Victim invests more — withdrawal is always 'blocked'",
      "Defense: Never invest via personal UPI. Use only SEBI-registered platforms.",
    ],
  },
];

const LABEL_STYLES = {
  vulnerable:    "bg-danger-50  text-danger-700  border border-danger-200",
  cautious:      "bg-warning-50 text-warning-700 border border-warning-200",
  secure:        "bg-success-50 text-success-700 border border-success-200",
  critical_fail: "bg-neutral-800 text-white",
};

const DIFFICULTY_COLORS = {
  Easy:   "bg-success-50 text-success-700 border border-success-200",
  Medium: "bg-warning-50 text-warning-700 border border-warning-200",
  Hard:   "bg-danger-50  text-danger-700  border border-danger-200",
};

export default function SocialEngineerRPG() {
  const { updateScore, addHistory } = useApp();
  const { playCorrect, playWrong, playCritical } = useScoreSound();
  const [floatPts, setFloatPts]       = useState(0);
  const [floatVisible, setFloatVisible] = useState(false);

  // Scenario list fetched from API
  const [scenarios, setScenarios]         = useState(LOCAL_SCENARIOS);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(null); // full scenario object
  const [phase, setPhase]                 = useState("pick");   // pick | intro | play | result
  const [stepIdx, setStepIdx]             = useState(0);
  const [chatHistory, setChatHistory]     = useState([]);
  const [chosen, setChosen]               = useState(null);
  const [totalScore, setTotalScore]       = useState(0);
  const [choices, setChoices]             = useState([]);
  const [showPlaybook, setShowPlaybook]   = useState(false);
  const [isTyping, setIsTyping]           = useState(false);
  const chatRef = useRef(null);

  // Fetch scenario list from backend
  useEffect(() => {
    api.get("/api/social/scenarios")
      .then(res => {
        if (res.data?.scenarios?.length) {
          // Scenarios list only has metadata — we keep local full data as fallback
          // but use backend ordering if available
          setScenarios(LOCAL_SCENARIOS);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingScenarios(false));
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatHistory, chosen]);

  // Save session when result phase reached
  useEffect(() => {
    if (phase !== "result" || choices.length === 0 || !selectedScenario) return;
    api.post("/api/social/save-session", {
      scenario_id: selectedScenario.id,
      total_score: totalScore,
      max_score:   selectedScenario.maxScore,
      choices:     choices.map(c => ({ score: c.choice.score, label: c.choice.label })),
    }).catch(() => {});
  }, [phase, choices, totalScore, selectedScenario]);

  const pickScenario = useCallback((scenario) => {
    setSelectedScenario(scenario);
    setPhase("intro");
    setStepIdx(0);
    setChatHistory([]);
    setChosen(null);
    setTotalScore(0);
    setChoices([]);
    setShowPlaybook(false);
  }, []);

  const startScenario = useCallback(() => {
    if (!selectedScenario) return;
    setPhase("play");
    setChatHistory([
      { type: "system",   message: selectedScenario.context },
      { type: "attacker", name: selectedScenario.steps[0].name, message: selectedScenario.steps[0].message },
    ]);
  }, [selectedScenario]);

  const handleChoice = useCallback((choice) => {
    if (chosen || !selectedScenario) return;
    const step   = selectedScenario.steps[stepIdx];
    const points = Math.max(0, choice.score);
    setChosen(choice);
    setTotalScore(prev => prev + points);
    setChoices(prev => [...prev, { stepId: step.id, choice, step }]);
    setChatHistory(prev => [...prev,
      { type: "user",     message: choice.text },
      { type: "feedback", label: choice.label, consequence: choice.consequence, score: choice.score },
    ]);
    if (choice.label === "critical_fail") {
      playCritical();
    } else if (points > 0) {
      updateScore("social", points);
      playCorrect();
      setFloatPts(points); setFloatVisible(true);
      setTimeout(() => setFloatVisible(false), 950);
    } else {
      playWrong();
    }
    if (points > 0)            toast.success(`+${points} pts`);
    else if (choice.score < 0) toast.error("Dangerous choice!");
    else                       toast("Neutral response", { icon: "—" });
    addHistory({ label: `Social RPG: ${step.message.slice(0, 40)}...`, correct: choice.score > 10, points, module: "social" });
    api.post("/api/social/submit-decision", {
      scenario_id: selectedScenario.id, step_id: step.id, choice_id: choice.id, score: choice.score,
    }).catch(() => {});
  }, [chosen, stepIdx, selectedScenario, updateScore, addHistory]);

  const handleNext = useCallback(() => {
    if (!selectedScenario) return;
    const nextIdx = stepIdx + 1;
    if (nextIdx >= selectedScenario.steps.length) { setPhase("result"); return; }
    const nextStep = selectedScenario.steps[nextIdx];
    // Typing indicator for 900ms before message appears
    setIsTyping(true);
    setStepIdx(nextIdx);
    setChosen(null);
    setTimeout(() => {
      setIsTyping(false);
      setChatHistory(prev => [...prev, { type: "attacker", name: nextStep.name, message: nextStep.message }]);
    }, 900);
  }, [stepIdx, selectedScenario]);

  const handleRestart = useCallback(() => {
    setPhase("pick");
    setSelectedScenario(null);
    setStepIdx(0); setChatHistory([]); setChosen(null);
    setTotalScore(0); setChoices([]); setShowPlaybook(false);
  }, []);

  // ── Scenario Picker ───────────────────────────────────────────────────────
  if (phase === "pick") {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-neutral-900 text-lg">SocialEngineer RPG</h2>
            <p className="text-xs text-neutral-400">Choose a scenario to begin</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => pickScenario(scenario)}
              className="card p-5 text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[scenario.difficulty] || "bg-neutral-100 text-neutral-500"}`}>
                  {scenario.difficulty}
                </span>
                <span className="text-xs text-neutral-400">{scenario.maxScore} pts max</span>
              </div>
              <h3 className="font-display font-semibold text-neutral-900 text-sm mb-2 group-hover:text-emerald-700 transition-colors">
                {scenario.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed mb-4">{scenario.description}</p>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 group-hover:gap-2 transition-all">
                Start <ChevronRight size={13} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (phase === "intro" && selectedScenario) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setPhase("pick")} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-all">
            <RotateCcw size={16} />
          </button>
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-neutral-900 text-lg">{selectedScenario.title}</h2>
            <p className="text-xs text-neutral-400">{selectedScenario.difficulty} — {selectedScenario.maxScore} pts max</p>
          </div>
        </div>
        <div className="card p-6 mb-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
            <p className="text-sm text-emerald-700">{selectedScenario.description}</p>
          </div>
          <div className="space-y-3 text-sm text-neutral-600">
            <div className="flex items-start gap-2"><Info size={15} className="text-primary-500 flex-shrink-0 mt-0.5" /><span>You will interact with an attacker through a simulated conversation.</span></div>
            <div className="flex items-start gap-2"><Info size={15} className="text-primary-500 flex-shrink-0 mt-0.5" /><span>Choose your responses carefully — each decision affects your security score.</span></div>
            <div className="flex items-start gap-2"><AlertTriangle size={15} className="text-warning-500 flex-shrink-0 mt-0.5" /><span>Some choices can cost you points. Think before you respond.</span></div>
          </div>
        </div>
        <div className="card p-5 mb-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Scoring Guide</p>
          <div className="space-y-2">
            {[["Secure response", "35 pts", "bg-success-50 text-success-600"],
              ["Cautious response", "20 pts", "bg-warning-50 text-warning-600"],
              ["Neutral / hesitant", "0 pts", "bg-neutral-100 text-neutral-500"],
              ["Dangerous response", "-20 pts", "bg-danger-50 text-danger-600"]].map(([l, p, c]) => (
              <div key={l} className={`flex items-center justify-between px-3 py-2 rounded-lg ${c}`}>
                <span className="text-xs font-medium">{l}</span>
                <span className="text-xs font-bold">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={startScenario} className="btn-primary w-full justify-center flex items-center gap-2">
          Begin Scenario <ChevronRight size={15} />
        </button>
      </div>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (phase === "result" && selectedScenario) {
    const pct        = Math.round((totalScore / selectedScenario.maxScore) * 100);
    const grade      = pct >= 80 ? "Security Expert" : pct >= 60 ? "Cautious User" : pct >= 40 ? "Vulnerable" : "High Risk";
    const gradeColor = pct >= 80 ? "text-success-600" : pct >= 60 ? "text-primary-600" : pct >= 40 ? "text-warning-600" : "text-danger-600";
    return (
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="card p-8 text-center mb-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><Users size={28} className="text-emerald-600" /></div>
          <h2 className="font-display font-bold text-neutral-900 text-xl mb-1">Scenario Complete</h2>
          <p className={`text-4xl font-display font-bold mt-4 mb-1 ${gradeColor}`}>{totalScore} pts</p>
          <p className={`text-sm font-semibold ${gradeColor} mb-4`}>{grade}</p>
          <p className="text-neutral-500 text-sm">Max possible: {selectedScenario.maxScore} points ({pct}% achieved)</p>
        </div>

        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Your Decisions</h3>
          {choices.map((c, i) => (
            <div key={i} className="border-b border-neutral-50 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
              <p className="text-xs text-neutral-400 mb-1">Step {i + 1}: {c.step.message.slice(0, 65)}...</p>
              <div className={`px-3 py-2 rounded-lg text-xs font-medium ${LABEL_STYLES[c.choice.label]}`}>
                {c.choice.text}
                <span className="ml-2 font-bold">{c.choice.score > 0 ? `+${c.choice.score}` : c.choice.score} pts</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{c.choice.consequence}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 mb-4">
          <button onClick={() => setShowPlaybook(s => !s)} className="w-full text-left flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Eye size={15} className="text-primary-500" />
            {showPlaybook ? "Hide" : "Reveal"} Attacker Playbook
          </button>
          {showPlaybook && (
            <div className="mt-4 bg-neutral-800 text-neutral-200 rounded-xl p-5 text-xs leading-relaxed font-mono space-y-1.5 animate-slide-up">
              <p className="text-yellow-400 font-bold">// ATTACKER PLAYBOOK</p>
              {selectedScenario.attackerPlaybook.map((step, i) => (
                <p key={i} className={step.startsWith("Defense") ? "text-emerald-400 pt-1" : ""}>{step}</p>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 mb-5 bg-emerald-50 border border-emerald-100">
          <h3 className="text-sm font-semibold text-emerald-800 mb-2">Key Lessons</h3>
          <ul className="space-y-1.5 text-xs text-emerald-700">
            <li>- Always verify the caller's identity independently before sharing anything</li>
            <li>- Urgency is a manipulation tactic — slow down and verify</li>
            <li>- Never share OTPs, UPI PINs, or passwords with anyone</li>
            <li>- Report suspicious calls: cybercrime.gov.in or call 1930</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button onClick={() => pickScenario(selectedScenario)} className="btn-secondary flex-1 justify-center flex items-center gap-2">
            <RotateCcw size={15} /> Replay
          </button>
          <button onClick={handleRestart} className="btn-primary flex-1 justify-center flex items-center gap-2">
            <RefreshCw size={15} /> Try Another
          </button>
        </div>
      </div>
    );
  }

  // ── Play screen ───────────────────────────────────────────────────────────
  if (phase !== "play" || !selectedScenario) return null;
  const currentStep = selectedScenario.steps[stepIdx];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-fade-in flex flex-col" style={{ height: "calc(100vh - 120px)", minHeight: "560px" }}>
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Users size={20} className="text-emerald-600" /></div>
        <div>
          <h2 className="font-display font-bold text-neutral-900 text-base">{selectedScenario.title}</h2>
          <p className="text-xs text-neutral-400">Step {stepIdx + 1} of {selectedScenario.steps.length}</p>
        </div>
        <div className="ml-auto text-sm font-semibold text-primary-600">{totalScore} pts</div>
      </div>

      <div className="progress-bar mb-4 flex-shrink-0">
        <div className="progress-fill" style={{ width: `${(stepIdx / selectedScenario.steps.length) * 100}%` }} />
      </div>

      <div ref={chatRef} className="card flex-1 overflow-y-auto p-4 space-y-3 mb-4" style={{ minHeight: 0 }}>
        {chatHistory.map((msg, i) => (
          <div key={i}>
            {msg.type === "system" && (
              <div className="text-center"><span className="text-xs bg-neutral-100 text-neutral-500 px-3 py-1 rounded-full">{msg.message}</span></div>
            )}
            {msg.type === "attacker" && (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-700 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{msg.name?.charAt(0)}</div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">{msg.name}</p>
                  <div className="chat-bubble-in">{msg.message}</div>
                </div>
              </div>
            )}
            {msg.type === "user" && (
              <div className="flex justify-end"><div className="chat-bubble-out">{msg.message}</div></div>
            )}
            {msg.type === "feedback" && (
              <div className="mx-auto max-w-xs text-center">
                <div className={`px-3 py-2 rounded-xl text-xs ${LABEL_STYLES[msg.label]}`}>
                  {msg.label === "secure" ? "Secure response" : msg.label === "cautious" ? "Cautious response" : msg.label === "critical_fail" ? "Critical security failure" : "Vulnerable response"}
                  {msg.score !== 0 && <span className="font-bold ml-1">{msg.score > 0 ? `+${msg.score}` : `${msg.score}`} pts</span>}
                </div>
                <p className="text-xs text-neutral-500 mt-1 text-left px-1">{msg.consequence}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Attacker typing indicator */}
      {isTyping && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-neutral-700 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">A</div>
          <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      <div className="flex-shrink-0">
        {!chosen ? (
          <ThreatMoment active={currentStep && currentStep.choices.some(c => c.label === "critical_fail")}>
          <div className="space-y-2 relative">
            <p className="text-xs font-medium text-neutral-500 mb-1">Choose your response:</p>
            <ScoreFloat points={floatPts} visible={floatVisible} />
            {currentStep.choices.map((choice, i) => (
              <button key={choice.id} onClick={() => handleChoice(choice)}
                className="w-full text-left p-3.5 rounded-xl border-2 border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-all text-sm text-neutral-700 active:scale-95">
                <span className="font-semibold text-primary-600 mr-2">{String.fromCharCode(65 + i)}.</span>{choice.text}
              </button>
            ))}
          </div>
          </ThreatMoment>
          ) : (
          <button onClick={handleNext} className="btn-primary w-full justify-center flex items-center gap-2">
            {stepIdx + 1 >= selectedScenario.steps.length ? "See Final Results" : "Continue Story"}
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
