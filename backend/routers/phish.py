# FIX #15: Removed unused 're' import
# FIX #4/#8: Optional auth on submit endpoints
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
import random

from database import get_db, DecisionLog
from auth_utils import get_current_user_optional

router = APIRouter()

PHISH_MESSAGES = [
    {
        "id": 1, "type": "email", "label": "Phishing",
        "sender": "alerts@sbi-secure-kyc.net", "senderName": "SBI Bank Security",
        "subject": "URGENT: Your KYC Verification Expires in 24 Hours",
        "preview": "Your account will be suspended...",
        "body": "Dear Customer,\n\nWe have detected that your KYC (Know Your Customer) verification is incomplete and will EXPIRE within 24 HOURS.\n\nFailure to update will result in IMMEDIATE ACCOUNT SUSPENSION.\n\nClick the link below to update your KYC instantly:\nhttps://sbi-kyc-update-secure.xyz/verify\n\nDo NOT ignore this message.\n\nSBI Bank Security Team",
        "redFlags": [
            "Sender domain is 'sbi-secure-kyc.net' — not the official 'sbi.co.in'",
            "Excessive urgency: '24 HOURS', 'IMMEDIATE ACCOUNT SUSPENSION'",
            "Suspicious link: 'sbi-kyc-update-secure.xyz' is not an SBI domain",
            "Real banks never ask you to verify KYC via email links",
            "Capitalized scare words to create panic",
        ],
        "explanation": "Classic KYC phishing scam targeting Indian bank customers. Real SBI only communicates from @sbi.co.in domains.",
        "attackerView": "Attacker bought a lookalike domain for Rs 500. Sends bulk emails to a purchased list. 0.5% click rate = hundreds of victims. Uses urgency to bypass rational thinking.",
    },
    {
        "id": 2, "type": "sms", "label": "Smishing",
        "sender": "+91-9876543210", "senderName": "Unknown",
        "subject": "SMS from unknown number",
        "preview": "Congratulations! You won Rs 50,000...",
        "body": "Congratulations! You have won Rs 50,000 in the Paytm Lucky Draw 2024!\n\nTo claim your prize, send your Aadhaar number and UPI PIN to this number or click: http://ptm-win.tk/claim\n\nOffer valid for 2 hours only. Act fast!",
        "redFlags": [
            "No legitimate lottery contacts winners via random SMS",
            "Asking for Aadhaar number and UPI PIN — a critical red flag",
            "Link uses .tk domain — commonly used for throwaway scam domains",
            "Time pressure: '2 hours only' prevents careful thinking",
            "Paytm would never contact you from a personal mobile number",
        ],
        "explanation": "Smishing using fake prize announcements. Sharing Aadhaar + UPI PIN gives scammers complete access to financial accounts.",
        "attackerView": "Bulk SMS costs Rs 0.10 per message. 1 million SMS sent. Only needs 50 people. Aadhaar + UPI PIN = complete account takeover.",
    },
    {
        "id": 3, "type": "email", "label": "Safe",
        "sender": "orders@amazon.in", "senderName": "Amazon India",
        "subject": "Your order #402-8473902-1234567 has been shipped",
        "preview": "Your order is on the way...",
        "body": "Hello,\n\nYour order has been shipped and is on its way!\n\nOrder #402-8473902-1234567\nItem: Noise-cancelling Headphones\nEstimated delivery: 2-3 business days\n\nYou can track your order at:\nhttps://www.amazon.in/progress-tracker/package\n\nThank you for shopping with us.\n\nAmazon India",
        "redFlags": [],
        "explanation": "Legitimate shipping confirmation from Amazon India. Official domain, consistent order number format, and tracking link goes to amazon.in.",
        "attackerView": "N/A — This message is genuine.",
    },
    {
        "id": 4, "type": "whatsapp", "label": "Phishing",
        "sender": "+91-8800XXXXXX", "senderName": "HR Dept (Unknown)",
        "subject": "WhatsApp message",
        "preview": "Work from home job opportunity...",
        "body": "Good afternoon!\n\nWe are hiring for a simple Work From Home data entry job.\n\nSalary: Rs 25,000 - Rs 45,000/month\nWork: 2-3 hours daily\nNo experience required\n\nTo register, pay a one-time registration fee of Rs 499 via UPI to: scammer@upi\n\nContact HR: @fake_hr_telegram\n\nLimited seats! Apply now.",
        "redFlags": [
            "Legitimate employers never charge registration or training fees",
            "Unrealistic salary for 2-3 hours of unspecified work",
            "Contact via Telegram instead of official company channels",
            "No company name, website, or verifiable identity provided",
            "UPI payment to an individual, not a company account",
        ],
        "explanation": "Job fraud scam targeting job seekers. Any job requiring upfront payment is a scam.",
        "attackerView": "Posts in 50+ WhatsApp job groups. Rs 499 x 200 victims per week = Rs 1 lakh weekly. No product or job ever delivered.",
    },
    {
        "id": 5, "type": "sms", "label": "Safe",
        "sender": "HDFCBK", "senderName": "HDFC Bank",
        "subject": "Transaction Alert",
        "preview": "Rs 1,500 debited from your account...",
        "body": "HDFC Bank: Rs 1,500.00 debited from A/c XX9234 on 15-Jan-24 at BigBazaar. Avl bal: Rs 12,450.00. Not you? Call 18002586161.",
        "redFlags": [],
        "explanation": "Genuine HDFC Bank transaction alert. Comes from registered sender ID 'HDFCBK', shows partial account number, real merchant, and official helpline 1800-258-6161.",
        "attackerView": "N/A — This is a legitimate bank alert.",
    },
    {
        "id": 6, "type": "email", "label": "Phishing",
        "sender": "it.support@company-helpdesk.info", "senderName": "IT Support Team",
        "subject": "Action Required: Reset Your Company Password Now",
        "preview": "Your company account password must be reset...",
        "body": "Dear Employee,\n\nOur security system has detected that your company account password has NOT been updated in 90 days.\n\nYour account will be LOCKED at midnight tonight.\n\nTo reset your password immediately:\n1. Click here: http://company-helpdesk.info/reset\n2. Enter your current username and password\n3. Set a new password\n\nIT Support Team\nRef: INC-2024-89234",
        "redFlags": [
            "Sender domain 'company-helpdesk.info' is not a legitimate corporate domain",
            "Asking you to enter your CURRENT password on an external site",
            "Legitimate IT resets never require your current password",
            "Fake ticket reference number creates false legitimacy",
            "Midnight deadline creates artificial urgency",
        ],
        "explanation": "Credential harvesting attack disguised as IT support. The attacker wants your existing password. Real IT departments use internal SSO for resets.",
        "attackerView": "Spear phishing using employee lists. Target enters credentials on cloned portal. Attacker gains access to internal systems, email, and company data.",
    },
    {
        "id": 7, "type": "whatsapp", "label": "Safe",
        "sender": "OTP-SWIGGY", "senderName": "Swiggy",
        "subject": "OTP Message",
        "preview": "Your OTP is 847291...",
        "body": "847291 is your Swiggy OTP. DO NOT share this with anyone. Swiggy never calls to ask for OTPs. Valid for 10 minutes.",
        "redFlags": [],
        "explanation": "Legitimate OTP messages are brief, come from registered sender IDs, include a warning not to share, and contain no links.",
        "attackerView": "N/A — This is a genuine OTP message.",
    },
    {
        "id": 8, "type": "email", "label": "Phishing",
        "sender": "income.tax.refund@gov-india.xyz", "senderName": "Income Tax Department",
        "subject": "Income Tax Refund of Rs 18,500 Pending - Verify Account",
        "preview": "You have a pending tax refund...",
        "body": "Dear Taxpayer,\n\nOur records show a pending Income Tax Refund of Rs 18,500 for Assessment Year 2023-24.\n\nTo receive your refund, please verify your bank account:\n\nhttps://incometax-refund-gov.xyz/verify\n\nProvide: PAN Card, Aadhaar, Bank Account, IFSC Code\n\nRefund will be credited within 3 working days.\n\nIncome Tax Department of India",
        "redFlags": [
            "Official IT dept uses @incometax.gov.in — not 'gov-india.xyz'",
            "Government refunds go directly to bank on record — no verification link needed",
            "Asking for PAN + Aadhaar + Bank details = identity theft",
            "The IT department sends refunds automatically — no taxpayer action required",
            "Suspicious domain 'incometax-refund-gov.xyz'",
        ],
        "explanation": "Income tax refund scam — one of the most common frauds in India. The IT Department never sends refund links. Refunds are processed automatically by NSDL.",
        "attackerView": "Seasonal campaign during March–September (tax season). Victims provide PAN + Aadhaar + bank details. Used for identity fraud and full account takeover.",
    },
]


class SubmitAnswer(BaseModel):
    message_id: int = Field(..., ge=1)
    answer: str = Field(..., pattern="^(Safe|Phishing|Smishing)$")
    correct: bool
    points: int = Field(..., ge=0, le=50)


@router.get("/messages")
async def get_messages():
    messages = PHISH_MESSAGES.copy()
    random.shuffle(messages)
    return {"messages": messages}


@router.post("/submit")
async def submit_answer(
    req: SubmitAnswer,
    token_data: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_data["sub"]) if token_data else None
    log = DecisionLog(
        user_id=user_id,
        module="phish",
        item_id=req.message_id,
        answer=req.answer,
        correct=req.correct,
        points=req.points,
    )
    db.add(log)
    await db.commit()
    return {"status": "logged", "correct": req.correct, "points": req.points}


@router.get("/generate")
async def generate_message(category: str = Query("kyc", pattern="^(kyc|upi|prize)$")):
    """Generate a dynamic phishing message from templates."""
    templates = {
        "kyc": {
            "subject": "URGENT: KYC Update Required",
            "body": "Dear {bank} Customer,\n\nYour KYC verification expires in {hours} hours. Update now at: {fake_url}\n\nIgnore at your own risk.\n\n{bank} Customer Care",
            "vars": {
                "bank":     ["SBI", "HDFC", "ICICI", "Axis"],
                "hours":    ["24", "12", "48"],
                "fake_url": ["sbi-kyc.xyz", "hdfc-update.net", "icici-secure.in"],
            },
        },
        "upi": {
            "subject": "UPI Account Blocked - Action Required",
            "body": "Your UPI ID has been temporarily blocked due to suspicious activity. Verify at {fake_url} to restore access.",
            "vars": {
                "fake_url": ["upi-verify.tk", "npci-helpdesk.xyz", "bhim-secure.net"],
            },
        },
        "prize": {
            "subject": "You have won Rs {amount}!",
            "body": "Congratulations! Your mobile number won Rs {amount} in the {brand} Lucky Draw.\n\nClaim within {hours} hours: {fake_url}",
            "vars": {
                "amount":   ["50,000", "1,00,000", "25,000"],
                "brand":    ["Paytm", "PhonePe", "Google Pay"],
                "hours":    ["2", "6", "12"],
                "fake_url": ["ptm-win.tk", "gpay-prize.xyz"],
            },
        },
    }

    template = templates.get(category, templates["kyc"])
    body = template["body"]
    subject = template["subject"]
    for key, options in template.get("vars", {}).items():
        body    = body.replace("{" + key + "}", random.choice(options))
        subject = subject.replace("{" + key + "}", random.choice(options))

    return {"subject": subject, "body": body, "label": "Phishing", "category": category}
