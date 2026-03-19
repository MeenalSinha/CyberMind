import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../App";
import { Mail, MessageSquare, Shield, AlertTriangle, CheckCircle, XCircle, ChevronRight, RotateCcw, Phone } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useScoreSound } from "../utils/wow";

const LOCAL_MESSAGES = [
  {
    id: 1, type: "email", label: "Phishing",
    sender: "alerts@sbi-secure-kyc.net", senderName: "SBI Bank Security",
    subject: "URGENT: Your KYC Verification Expires in 24 Hours",
    preview: "Your account will be suspended...",
    body: "Dear Customer,\n\nWe have detected that your KYC (Know Your Customer) verification is incomplete and will EXPIRE within 24 HOURS.\n\nFailure to update will result in IMMEDIATE ACCOUNT SUSPENSION.\n\nClick the link below to update your KYC instantly:\nhttps://sbi-kyc-update-secure.xyz/verify\n\nDo NOT ignore this message.\n\nSBI Bank Security Team",
    redFlags: ["Sender domain is 'sbi-secure-kyc.net' — not the official 'sbi.co.in'", "Excessive urgency: '24 HOURS', 'IMMEDIATE ACCOUNT SUSPENSION'", "Suspicious link: 'sbi-kyc-update-secure.xyz' is not an SBI domain", "Real banks never ask you to verify KYC via email links", "Capitalized scare words to create panic"],
    explanation: "Classic KYC phishing scam. Real SBI only communicates from @sbi.co.in domains.",
    attackerView: "Attacker bought a lookalike domain for Rs 500. Sends bulk emails to purchased list. 0.5% click rate = hundreds of victims. Urgency bypasses rational thinking.",
  },
  {
    id: 2, type: "sms", label: "Smishing",
    sender: "+91-9876543210", senderName: "Unknown Number",
    subject: "SMS from unknown number",
    preview: "Congratulations! You won Rs 50,000...",
    body: "Congratulations! You have won Rs 50,000 in the Paytm Lucky Draw 2024!\n\nTo claim your prize, send your Aadhaar number and UPI PIN to this number or click: http://ptm-win.tk/claim\n\nOffer valid for 2 hours only. Act fast!",
    redFlags: ["No legitimate lottery contacts winners via random SMS", "Asking for Aadhaar number and UPI PIN — critical red flag", "Link uses .tk domain — commonly used for throwaway scam domains", "Time pressure: '2 hours only' prevents careful thinking", "Paytm would never contact you from a personal mobile number"],
    explanation: "Smishing using fake prize announcements. Sharing Aadhaar + UPI PIN gives scammers complete access to your accounts.",
    attackerView: "Bulk SMS costs Rs 0.10 per message. 1 million SMS sent. Only needs 50 victims. Aadhaar + UPI PIN = complete account takeover.",
  },
  {
    id: 3, type: "email", label: "Safe",
    sender: "orders@amazon.in", senderName: "Amazon India",
    subject: "Your order #402-8473902-1234567 has been shipped",
    preview: "Your order is on the way...",
    body: "Hello,\n\nYour order has been shipped and is on its way!\n\nOrder #402-8473902-1234567\nItem: Noise-cancelling Headphones\nEstimated delivery: 2-3 business days\n\nYou can track your order at:\nhttps://www.amazon.in/progress-tracker/package\n\nThank you for shopping with us.\n\nAmazon India",
    redFlags: [],
    explanation: "Legitimate shipping confirmation from Amazon India. Official domain, consistent order number format, and tracking link points to amazon.in.",
    attackerView: "N/A — This message is genuine.",
  },
  {
    id: 4, type: "whatsapp", label: "Phishing",
    sender: "+91-8800XXXXXX", senderName: "HR Dept (Unknown)",
    subject: "WhatsApp job offer",
    preview: "Work from home job opportunity...",
    body: "Good afternoon!\n\nWe are hiring for a simple Work From Home data entry job.\n\nSalary: Rs 25,000 - Rs 45,000/month\nWork: 2-3 hours daily\nNo experience required\n\nTo register, pay a one-time registration fee of Rs 499 via UPI to: scammer@upi\n\nContact HR: @fake_hr_telegram\n\nLimited seats! Apply now.",
    redFlags: ["Legitimate employers never charge registration or training fees", "Unrealistic salary for 2-3 hours of unspecified work", "Contact via Telegram instead of official company channels", "No company name, website, or verifiable identity provided", "UPI payment to an individual, not a company account"],
    explanation: "Job fraud scam. Any job requiring upfront payment is a scam. Legitimate companies pay you — they never charge you to apply.",
    attackerView: "Posts in 50+ WhatsApp job groups. Rs 499 x 200 victims per week = Rs 1 lakh weekly. No job ever delivered.",
  },
  {
    id: 5, type: "sms", label: "Safe",
    sender: "HDFCBK", senderName: "HDFC Bank",
    subject: "Transaction Alert",
    preview: "Rs 1,500 debited from your account...",
    body: "HDFC Bank: Rs 1,500.00 debited from A/c XX9234 on 15-Jan-24 at BigBazaar. Avl bal: Rs 12,450.00. Not you? Call 18002586161.",
    redFlags: [],
    explanation: "Genuine HDFC Bank transaction alert. Comes from registered sender ID 'HDFCBK', shows partial account number, real merchant, and official helpline.",
    attackerView: "N/A — This is a legitimate bank alert.",
  },
  {
    id: 6, type: "email", label: "Phishing",
    sender: "it.support@company-helpdesk.info", senderName: "IT Support Team",
    subject: "Action Required: Reset Your Company Password Now",
    preview: "Your company account password must be reset...",
    body: "Dear Employee,\n\nOur security system has detected that your company account password has NOT been updated in 90 days.\n\nYour account will be LOCKED at midnight tonight.\n\nTo reset your password immediately:\n1. Click here: http://company-helpdesk.info/reset\n2. Enter your current username and password\n3. Set a new password\n\nIT Support Team\nRef: INC-2024-89234",
    redFlags: ["Sender domain 'company-helpdesk.info' is not a legitimate corporate domain", "Asking you to enter your CURRENT password on an external site", "Legitimate IT resets never require your current password", "Fake ticket reference number creates false legitimacy", "Midnight deadline creates artificial urgency"],
    explanation: "Credential harvesting disguised as IT support. The attacker wants your existing password. Real IT departments use internal SSO for resets.",
    attackerView: "Spear phishing using employee lists. Target enters credentials on cloned portal. Attacker accesses internal systems, email, and company data.",
  },
  {
    id: 7, type: "whatsapp", label: "Safe",
    sender: "OTP-SWIGGY", senderName: "Swiggy",
    subject: "OTP Message",
    preview: "Your OTP is 847291...",
    body: "847291 is your Swiggy OTP. DO NOT share this with anyone. Swiggy never calls to ask for OTPs. Valid for 10 minutes.",
    redFlags: [],
    explanation: "Legitimate OTP messages are brief, from registered sender IDs, include a do-not-share warning, and contain no links.",
    attackerView: "N/A — This is a genuine OTP message.",
  },
  {
    id: 8, type: "email", label: "Phishing",
    sender: "income.tax.refund@gov-india.xyz", senderName: "Income Tax Department",
    subject: "Income Tax Refund of Rs 18,500 Pending - Verify Account",
    preview: "You have a pending tax refund...",
    body: "Dear Taxpayer,\n\nOur records show a pending Income Tax Refund of Rs 18,500 for Assessment Year 2023-24.\n\nTo receive your refund, please verify your bank account:\n\nhttps://incometax-refund-gov.xyz/verify\n\nProvide: PAN Card, Aadhaar, Bank Account, IFSC Code\n\nRefund will be credited within 3 working days.\n\nIncome Tax Department of India",
    redFlags: ["Official IT dept uses @incometax.gov.in — not 'gov-india.xyz'", "Government refunds go directly to bank on record — no link needed", "Asking for PAN + Aadhaar + Bank details = identity theft", "The IT department sends refunds automatically", "Suspicious domain 'incometax-refund-gov.xyz'"],
    explanation: "Income tax refund scam — one of the most common frauds in India. The IT Department never sends refund links. Refunds are processed automatically by NSDL.",
    attackerView: "Seasonal campaign during March-September. Victims provide PAN + Aadhaar + bank details. Used for identity fraud and account takeover.",
  },
];

const CLASSIFICATIONS = ["Safe", "Phishing", "Smishing"];

function getCorrectClass(msg) {
  if (msg.label === "Safe")   return "Safe";
  if (msg.type  === "sms")    return "Smishing";
  return "Phishing";
}

function getTypeIcon(type) {
  if (type === "email")    return <Mail size={13} />;
  if (type === "sms")      return <Phone size={13} />;
  return <MessageSquare size={13} />;
}

export default function PhishBuster() {
  const { updateScore, addHistory } = useApp();
  const { playCorrect, playWrong } = useScoreSound();
  const [shakeRow, setShakeRow]   = useState(false);
  const [messages, setMessages]     = useState(LOCAL_MESSAGES);
  const [selectedId, setSelectedId] = useState(LOCAL_MESSAGES[0].id);
  const [answered, setAnswered]     = useState({});   // { [id]: { choice, correct } }
  const [results, setResults]       = useState([]);
  const [finished, setFinished]     = useState(false);

  useEffect(() => {
    api.get("/api/phish/messages")
      .then(res => { if (res.data?.messages?.length) setMessages(res.data.messages); })
      .catch(() => {});
  }, []);

  // Save session when finished — saves via the deepfake session endpoint pattern
  useEffect(() => {
    if (!finished || results.length === 0) return;
    const correctCount = results.filter(r => r.correct).length;
    // POST final session summary to backend (uses query params like deepfake module)
    api.post("/api/deepfake/session", null, {
      params: {
        score:   correctCount * 15,
        correct: correctCount,
        total:   results.length,
      }
    }).catch(() => {});
  }, [finished, results]);

  const selected = messages.find(m => m.id === selectedId);

  const handleClassify = useCallback(async (choice) => {
    if (!selected || answered[selected.id]) return;
    const correct = choice === getCorrectClass(selected);
    const points  = correct ? 15 : 0;

    if (correct) {
      updateScore("phish", points);
      playCorrect();
      toast.success("Correct! +15 pts");
    } else {
      playWrong();
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 500);
      toast.error(`Incorrect. This was: ${getCorrectClass(selected)}`);
    }

    const newResult = { id: selected.id, correct, choice, label: getCorrectClass(selected), subject: selected.subject };

    // FIX: use functional updater for both setAnswered and setResults to avoid stale closure
    setAnswered(prev => {
      const updated = { ...prev, [selected.id]: { choice, correct } };
      // Check completion inside the updater with the fresh state
      const allDone = messages.every(m => updated[m.id]);
      if (allDone) setTimeout(() => setFinished(true), 1200);
      return updated;
    });
    setResults(prev => [...prev, newResult]);
    addHistory({ label: `Phish: ${selected.subject}`, correct, points, module: "phish" });
    api.post("/api/phish/submit", { message_id: selected.id, answer: choice, correct, points }).catch(() => {});
  }, [selected, answered, messages, updateScore, addHistory]);

  const handleRestart = useCallback(() => {
    setAnswered({}); setResults([]); setFinished(false); setSelectedId(messages[0]?.id);
  }, [messages]);

  if (finished) {
    const correctCount = results.filter(r => r.correct).length;
    const pct = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
    return <PhishResultScreen correct={correctCount} total={results.length} pct={pct} results={results} onRestart={handleRestart} />;
  }

  const answeredCount = Object.keys(answered).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
          <Mail size={20} className="text-rose-600" />
        </div>
        <div>
          <h2 className="font-display font-bold text-neutral-900 text-lg">PhishBuster</h2>
          <p className="text-xs text-neutral-400">{answeredCount}/{messages.length} classified</p>
        </div>
        {answeredCount === messages.length && (
          <button onClick={() => setFinished(true)} className="ml-auto btn-primary text-sm px-4 py-2">View Results</button>
        )}
      </div>

      <div className="progress-bar mb-4">
        <div className="progress-fill" style={{ width: `${(answeredCount / messages.length) * 100}%` }} />
      </div>

      {/* Mobile: horizontal message scroller */}
      <div className="sm:hidden mb-3 overflow-x-auto pb-1">
        <div className="flex gap-2 w-max">
          {messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => setSelectedId(msg.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                selectedId === msg.id ? "bg-primary-600 text-white border-primary-600" : "bg-white border-neutral-200 text-neutral-600"
              } ${answered[msg.id] ? (answered[msg.id].correct ? "ring-1 ring-success-400" : "ring-1 ring-danger-400") : ""}`}
            >
              {getTypeIcon(msg.type)}
              {msg.senderName.split(" ")[0]}
              {answered[msg.id] && (
                answered[msg.id].correct
                  ? <CheckCircle size={10} className="text-success-400" />
                  : <XCircle size={10} className="text-danger-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4" style={{ height: "calc(100vh - 260px)", minHeight: "480px" }}>
        {/* Desktop sidebar */}
        <div className="w-72 flex-shrink-0 card overflow-hidden flex-col hidden sm:flex">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Inbox ({messages.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-all ${selectedId === msg.id ? "bg-primary-50" : ""} ${answered[msg.id] ? (answered[msg.id].correct ? "border-l-4 border-l-success-500" : "border-l-4 border-l-danger-500") : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${answered[msg.id] ? (answered[msg.id].correct ? "text-success-500" : "text-danger-500") : "text-neutral-400"}`}>
                    {getTypeIcon(msg.type)}
                  </span>
                  <span className={`text-xs truncate flex-1 ${!answered[msg.id] ? "font-semibold text-neutral-800" : "font-medium text-neutral-600"}`}>{msg.senderName}</span>
                  {!answered[msg.id] && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 animate-pulse" />}
                  {answered[msg.id] && (answered[msg.id].correct
                    ? <CheckCircle size={12} className="text-success-500 flex-shrink-0" />
                    : <XCircle size={12} className="text-danger-500 flex-shrink-0" />)}
                </div>
                <p className={`text-xs truncate ${!answered[msg.id] ? "text-neutral-700 font-medium" : "text-neutral-400"}`}>{msg.subject}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Message detail */}
        <div className="flex-1 card overflow-hidden flex flex-col">
          {selected && (
            <>
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-sm font-semibold flex-shrink-0">
                    {selected.senderName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-neutral-900">{selected.senderName}</p>
                      <span className="badge bg-neutral-100 text-neutral-400 text-xs uppercase">{selected.type}</span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate font-mono">{selected.sender}</p>
                    <p className="text-sm font-medium text-neutral-700 mt-1">{selected.subject}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <pre className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap font-sans">{selected.body}</pre>

                {answered[selectedId] && (
                  <div className="mt-6 animate-slide-up space-y-4">
                    <div className={`flex items-start gap-3 p-4 rounded-xl ${answered[selectedId].correct ? "feedback-correct" : "feedback-wrong"}`}>
                      {answered[selectedId].correct
                        ? <CheckCircle size={18} className="text-success-600 flex-shrink-0 mt-0.5" />
                        : <XCircle size={18} className="text-danger-600 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className={`text-sm font-semibold ${answered[selectedId].correct ? "text-success-700" : "text-danger-700"}`}>
                          {answered[selectedId].correct ? `Correct! This was ${getCorrectClass(selected)}. +15 pts` : `Incorrect. This was ${getCorrectClass(selected)}.`}
                        </p>
                        <p className="text-xs text-neutral-600 mt-1">{selected.explanation}</p>
                      </div>
                    </div>

                    {selected.redFlags.length > 0 && (
                      <div className="bg-warning-50 border border-warning-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-warning-700 mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} /> Red Flags Detected
                        </p>
                        <ul className="space-y-1.5">
                          {selected.redFlags.map((f, i) => (
                            <li key={i} className="text-xs text-warning-700 flex items-start gap-2">
                              <span className="text-warning-500 font-bold mt-0.5">!</span>{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selected.label !== "Safe" && (
                      <div className="bg-neutral-800 text-neutral-200 rounded-xl p-4 text-xs leading-relaxed font-mono">
                        <p className="text-yellow-400 font-bold mb-2">// Attacker Strategy</p>
                        <p className="text-neutral-300">{selected.attackerView}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!answered[selectedId] && (
                <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50">
                  <p className="text-xs font-medium text-neutral-500 mb-3">Classify this message:</p>
                  <div className={`flex gap-2 ${shakeRow ? "shake-row" : ""}`}>
                    {CLASSIFICATIONS.map(cls => (
                      <button
                        key={cls}
                        onClick={() => handleClassify(cls)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${
                          cls === "Safe"     ? "border-success-200 bg-success-50 text-success-700 hover:bg-success-100"
                        : cls === "Phishing" ? "border-danger-200  bg-danger-50  text-danger-700  hover:bg-danger-100"
                        :                      "border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100"
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PhishResultScreen({ correct, total, pct, results, onRestart }) {
  const grade      = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Fair" : "Needs Work";
  const gradeColor = pct >= 80 ? "text-success-600" : pct >= 60 ? "text-primary-600" : pct >= 40 ? "text-warning-600" : "text-danger-600";
  return (
    <div className="p-6 max-w-lg mx-auto animate-fade-in">
      <div className="card p-8 text-center mb-4">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4"><Shield size={28} className="text-rose-600" /></div>
        <h2 className="font-display font-bold text-neutral-900 text-xl mb-1">PhishBuster Complete</h2>
        <p className={`text-4xl font-display font-bold mt-4 mb-1 ${gradeColor}`}>{pct}%</p>
        <p className={`text-sm font-semibold ${gradeColor} mb-4`}>{grade}</p>
        <p className="text-neutral-500 text-sm">{correct} of {total} correct — {correct * 15} points earned</p>
      </div>
      <div className="card p-5 mb-4">
        {results.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-neutral-50 last:border-0">
            {r.correct ? <CheckCircle size={14} className="text-success-500 flex-shrink-0" /> : <XCircle size={14} className="text-danger-500 flex-shrink-0" />}
            <span className="flex-1 text-neutral-600 text-xs truncate">{r.subject}</span>
            <span className="text-xs text-neutral-400">{r.label}</span>
          </div>
        ))}
      </div>
      <div className="card p-5 mb-4 bg-rose-50 border border-rose-100">
        <h3 className="text-sm font-semibold text-rose-800 mb-2">Key Takeaways</h3>
        <ul className="space-y-1.5 text-xs text-rose-700">
          <li>- Always verify sender domain — not just the display name</li>
          <li>- Urgency + external link = major red flag combination</li>
          <li>- Government bodies and banks never ask you to click links to verify accounts</li>
          <li>- Any job requiring upfront payment is a scam</li>
        </ul>
      </div>
      <button onClick={onRestart} className="btn-primary w-full justify-center flex items-center gap-2"><RotateCcw size={15} /> Retry Module</button>
    </div>
  );
}
