# FIX #12: Guard division by zero in save_session
# FIX #13: Move HTTPException import to top level
# FIX #4:  Protected endpoints use optional auth to log user_id when available
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List

from database import get_db, DecisionLog, GameSession
from auth_utils import get_current_user_optional

router = APIRouter()

SCENARIOS = [
    {
        "id": "fake_it_support",
        "title": "Fake IT Support Attack",
        "description": "You receive a call from someone claiming to be from your company's IT department.",
        "context": "It's Monday morning. You're at your work desk. Your phone rings.",
        "difficulty": "Medium",
        "maxScore": 100,
        "steps": [
            {
                "id": 1,
                "speaker": "attacker",
                "name": "Rajesh Kumar (IT Dept)",
                "message": "Hello, this is Rajesh from IT support. We've detected unusual login activity on your company account from a location in Bangalore. Are you currently in Bangalore?",
                "choices": [
                    {"id": "a", "text": "No, I'm in Delhi. What's going on?", "score": 0, "label": "vulnerable",
                     "consequence": "You've confirmed your location — useful info for the attacker."},
                    {"id": "b", "text": "Can you verify your employee ID and department first?", "score": 25, "label": "cautious",
                     "consequence": "Good instinct! You asked for verification before sharing anything."},
                    {"id": "c", "text": "I'll hang up and call IT directly through the official number.", "score": 35, "label": "secure",
                     "consequence": "Excellent! Never trust inbound calls claiming to be IT."},
                ],
            },
            {
                "id": 2,
                "speaker": "attacker",
                "name": "Rajesh Kumar (IT Dept)",
                "message": "Our system shows your account is at risk. To secure it immediately, I need you to open your email and click a link I'm sending you right now. It'll run a security scan.",
                "choices": [
                    {"id": "a", "text": "Ok, I see it — should I click it?", "score": 0, "label": "vulnerable",
                     "consequence": "Never click unsolicited links from inbound callers."},
                    {"id": "b", "text": "I'm not clicking any links without checking with my manager first.", "score": 20, "label": "cautious",
                     "consequence": "Good pause! Checking with your manager is a solid step."},
                    {"id": "c", "text": "Legitimate IT tools are installed internally. I won't click external links.", "score": 30, "label": "secure",
                     "consequence": "Real IT departments don't send security tools via email links during phone calls."},
                ],
            },
            {
                "id": 3,
                "speaker": "attacker",
                "name": "Rajesh Kumar (IT Dept)",
                "message": "This is urgent. We only have a 15-minute window before your account is permanently locked. I'll need your current password to transfer your data to a secure account.",
                "choices": [
                    {"id": "a", "text": "Alright, it's Company@2024.", "score": -20, "label": "critical_fail",
                     "consequence": "Critical mistake! No IT team ever needs your password."},
                    {"id": "b", "text": "I'm not comfortable sharing my password.", "score": 20, "label": "cautious",
                     "consequence": "Correct. But you should also report this call immediately."},
                    {"id": "c", "text": "This is a scam. No IT team ever asks for passwords. I'm reporting this call.", "score": 35, "label": "secure",
                     "consequence": "Excellent! Identifying and reporting is the ideal response."},
                ],
            },
            {
                "id": 4,
                "speaker": "attacker",
                "name": "Rajesh Kumar (IT Dept)",
                "message": "Fine. But at minimum I need you to install this remote access tool so I can fix the issue without your password. It'll only take 2 minutes.",
                "choices": [
                    {"id": "a", "text": "Ok, I'll install it. What's the link?", "score": -20, "label": "critical_fail",
                     "consequence": "Remote access tools give attackers full control of your machine."},
                    {"id": "b", "text": "I need to get written approval from my manager before installing anything.", "score": 20, "label": "cautious",
                     "consequence": "Good protocol. Manager approval creates a paper trail and breaks the attacker's momentum."},
                    {"id": "c", "text": "I'm ending this call. I'll email security@company.com to report this incident.", "score": 35, "label": "secure",
                     "consequence": "Ending suspicious calls and reporting to the security team is exactly right."},
                ],
            },
        ],
        "attackerPlaybook": [
            "Step 1: Pretexting — Claim authority (IT support)",
            "Step 2: Create urgency — 'Account will be locked'",
            "Step 3: Build rapport — Ask simple yes/no questions first",
            "Step 4: Escalate requests — Location > Click link > Password > Remote access",
            "Step 5: Isolate target — 'Don't tell your manager yet'",
            "Defense: Hang up. Call IT directly. Report the call.",
        ],
    },
    {
        "id": "upi_fraud_call",
        "title": "UPI Fraud — Fake Bank Agent",
        "description": "A caller claims to be from your bank and says your UPI account has been blocked.",
        "context": "You're at home on a Sunday afternoon. Your phone rings from an unknown number.",
        "difficulty": "Easy",
        "maxScore": 90,
        "steps": [
            {
                "id": 1,
                "speaker": "attacker",
                "name": "Agent Vikram (HDFC Bank)",
                "message": "Namaste, I'm calling from HDFC Bank fraud department. Your UPI ID has been flagged for suspicious transactions. To protect your account, I need to verify your identity. Can you confirm your registered mobile number?",
                "choices": [
                    {"id": "a", "text": "Sure, it's 9876543210.", "score": 0, "label": "vulnerable",
                     "consequence": "You confirmed your number — the attacker now has one piece of your identity."},
                    {"id": "b", "text": "How do I know you're actually from HDFC Bank?", "score": 25, "label": "cautious",
                     "consequence": "Good question. Always challenge callers claiming to be from your bank."},
                    {"id": "c", "text": "I'll hang up and call HDFC's official number 1800-202-6161 myself.", "score": 35, "label": "secure",
                     "consequence": "Perfect. Real banks never ask you to verify via inbound calls. Always call back on the official number."},
                ],
            },
            {
                "id": 2,
                "speaker": "attacker",
                "name": "Agent Vikram (HDFC Bank)",
                "message": "Thank you. To reverse the suspicious transaction of Rs 15,000, I need your UPI PIN to authenticate the reversal process from our end.",
                "choices": [
                    {"id": "a", "text": "Ok, my UPI PIN is 4821.", "score": -30, "label": "critical_fail",
                     "consequence": "Critical! You just gave away your UPI PIN. The attacker can now drain your account completely."},
                    {"id": "b", "text": "I don't think banks need my PIN to reverse transactions.", "score": 20, "label": "cautious",
                     "consequence": "Correct instinct! Banks process reversals on their end — they never need your PIN."},
                    {"id": "c", "text": "No bank ever needs your UPI PIN. This is a scam. I'm blocking this number.", "score": 35, "label": "secure",
                     "consequence": "Exactly right. Your UPI PIN is like your ATM PIN — share it with nobody, not even bank staff."},
                ],
            },
            {
                "id": 3,
                "speaker": "attacker",
                "name": "Agent Vikram (HDFC Bank)",
                "message": "Sir/Ma'am, I understand your concern. Let me send you an OTP on your registered number. Please share it immediately so we can block the fraudulent transaction before it's too late.",
                "choices": [
                    {"id": "a", "text": "Ok, the OTP I received is 724816.", "score": -30, "label": "critical_fail",
                     "consequence": "Never share OTPs. OTPs authorize transactions — you just authorized the fraud yourself."},
                    {"id": "b", "text": "Wait — if you're from the bank, why do you need an OTP from me?", "score": 20, "label": "cautious",
                     "consequence": "Smart question. Banks generate OTPs to authenticate customers, not to receive them back."},
                    {"id": "c", "text": "OTPs are never shared with anyone. Hanging up now and reporting this number to cybercrime.gov.in.", "score": 35, "label": "secure",
                     "consequence": "Perfect. Report the number to the National Cyber Crime Portal (cybercrime.gov.in) or call 1930."},
                ],
            },
        ],
        "attackerPlaybook": [
            "Step 1: Spoof or fake a bank caller ID",
            "Step 2: Create fear — 'Your account has suspicious activity'",
            "Step 3: Ask for identity confirmation (mobile number) — builds false trust",
            "Step 4: Request UPI PIN under guise of 'reversal authentication'",
            "Step 5: Request OTP — each OTP authorizes a transaction they initiate",
            "Defense: Hang up. Call bank directly. Never share PIN or OTP.",
        ],
    },
    {
        "id": "romance_scam",
        "title": "Romance / Investment Scam",
        "description": "Someone you met on a social app asks you to invest in a 'guaranteed return' trading platform.",
        "context": "You've been chatting online for 3 weeks with someone named 'Priya'. Today she mentions an investment opportunity.",
        "difficulty": "Hard",
        "maxScore": 110,
        "steps": [
            {
                "id": 1,
                "speaker": "attacker",
                "name": "Priya (Online Contact)",
                "message": "Hey! I wanted to share something amazing with you. My cousin works at a crypto trading firm. I invested Rs 10,000 last month and already made Rs 45,000! The app shows live profits. You should try it — I can help you set it up.",
                "choices": [
                    {"id": "a", "text": "That sounds incredible! Send me the app link right away.", "score": 0, "label": "vulnerable",
                     "consequence": "High returns with no risk are the #1 sign of investment fraud. The 'app' will show fake profits to lure you in."},
                    {"id": "b", "text": "That's a huge return. What's the name of the firm? I'll research it first.", "score": 25, "label": "cautious",
                     "consequence": "Good step. Always verify investment platforms independently before putting in any money."},
                    {"id": "c", "text": "Returns like that in a month are impossible without extreme risk. I won't invest based on social media recommendations.", "score": 35, "label": "secure",
                     "consequence": "Correct. Legitimate investments don't promise 300-400% returns. If it sounds too good, it's a scam."},
                ],
            },
            {
                "id": 2,
                "speaker": "attacker",
                "name": "Priya (Online Contact)",
                "message": "I understand you're careful. Let me show you — I'll invest Rs 5,000 of your money and you'll see the profit in 48 hours. Just send me the money on UPI: priya.invest@okaxis. You can withdraw anytime.",
                "choices": [
                    {"id": "a", "text": "Ok, I'll send Rs 5,000 to see how it works.", "score": -20, "label": "critical_fail",
                     "consequence": "The 'trial investment' is the hook. The app will show fake profits. When you invest more, you'll lose everything."},
                    {"id": "b", "text": "Why would I send money to your personal UPI? Real investment firms have official accounts.", "score": 25, "label": "cautious",
                     "consequence": "Exactly right. SEBI-registered investment firms never accept money through personal UPI IDs."},
                    {"id": "c", "text": "Sending money to a personal UPI for 'investment' is a textbook scam. I'm ending this conversation and reporting you.", "score": 35, "label": "secure",
                     "consequence": "Perfect. Block and report to cybercrime.gov.in. Real investments go through SEBI-registered platforms only."},
                ],
            },
            {
                "id": 3,
                "speaker": "attacker",
                "name": "Priya (Online Contact)",
                "message": "I can't believe you'd doubt me after all we've talked about. I've never asked you for anything before. This is a real opportunity — my whole family uses this app. Please, just try it for me.",
                "choices": [
                    {"id": "a", "text": "You're right, I'm sorry. I trust you. I'll send Rs 10,000.", "score": -20, "label": "critical_fail",
                     "consequence": "This is the 'emotional manipulation' phase. Scammers exploit trust built over weeks. The relationship itself is fake."},
                    {"id": "b", "text": "I care about our friendship but I don't mix money and personal relationships.", "score": 20, "label": "cautious",
                     "consequence": "Good boundary. But consider — this pattern matches romance scam tactics exactly. Review the relationship critically."},
                    {"id": "c", "text": "Guilt-tripping me about money is a manipulation tactic. I'm done. I'm reporting this profile.", "score": 35, "label": "secure",
                     "consequence": "Brave and correct. Romance scammers spend weeks building emotional dependency before the financial ask. Your instincts were right."},
                ],
            },
        ],
        "attackerPlaybook": [
            "Step 1: Build emotional connection over 2-4 weeks on social apps",
            "Step 2: Introduce 'incredible investment opportunity' via trusted contact",
            "Step 3: Show fake profit screenshots to build credibility",
            "Step 4: Offer 'trial investment' — app shows fake gains",
            "Step 5: Emotional pressure when victim hesitates",
            "Step 6: Victim invests more — withdrawal is always 'blocked' until more fees paid",
            "Defense: Never invest based on social connections. Use only SEBI-registered platforms.",
        ],
    },
]


class SubmitDecision(BaseModel):
    scenario_id: str
    step_id: int = Field(..., ge=1, le=100)
    choice_id: str = Field(..., max_length=10)
    score: int = Field(..., ge=-100, le=100)


class SaveSession(BaseModel):
    scenario_id: str = Field(..., max_length=100)
    total_score: int = Field(..., ge=-500, le=500)
    max_score: int = Field(..., ge=1, le=10000)   # FIX #12: ge=1 prevents division by zero
    choices: List[dict]


@router.get("/scenarios")
async def get_scenarios():
    return {
        "scenarios": [
            {
                "id":          s["id"],
                "title":       s["title"],
                "description": s["description"],
                "difficulty":  s["difficulty"],
                "maxScore":    s["maxScore"],
            }
            for s in SCENARIOS
        ]
    }


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str):
    # FIX #13: HTTPException now imported at module top level
    scenario = next((s for s in SCENARIOS if s["id"] == scenario_id), None)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.post("/submit-decision")
async def submit_decision(
    req: SubmitDecision,
    token_data: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_data["sub"]) if token_data else None
    log = DecisionLog(
        user_id=user_id,
        module="social",
        item_id=req.step_id,
        answer=req.choice_id,
        correct=req.score > 10,
        points=max(0, req.score),
    )
    db.add(log)
    await db.commit()
    return {"status": "logged"}


@router.post("/save-session")
async def save_session(
    req: SaveSession,
    token_data: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_data["sub"]) if token_data else None
    session = GameSession(
        user_id=user_id,
        module="social",
        score=req.total_score,
        correct=sum(1 for c in req.choices if c.get("score", 0) > 10),
        total=len(req.choices),
    )
    db.add(session)
    await db.commit()
    # FIX #12: max_score is guaranteed >= 1 by Field(ge=1)
    pct = round((req.total_score / req.max_score) * 100)
    return {"status": "saved", "score": req.total_score, "pct": pct}
