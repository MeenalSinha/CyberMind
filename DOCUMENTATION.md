# CyberMind: The Human Defense Simulator
## Complete Project Documentation

> **A gamified, full-stack web application that trains users to detect and respond to AI deepfakes, phishing attacks, and social engineering — through interactive simulation, not passive reading.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [System Design & Data Flow](#3-system-design--data-flow)
4. [Folder Structure](#4-folder-structure)
5. [Feature List](#5-feature-list)
6. [Module Deep Dive](#6-module-deep-dive)
7. [Tech Stack](#7-tech-stack)
8. [API Reference](#8-api-reference)
9. [Database Schema](#9-database-schema)
10. [Security Model](#10-security-model)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Scoring & Progression System](#12-scoring--progression-system)
13. [Quick Start Guide](#13-quick-start-guide)

---

## 1. Project Overview

### What is CyberMind?

CyberMind is a browser-based cybersecurity training platform built for the modern threat landscape. Unlike traditional security awareness programs that rely on videos and quizzes, CyberMind uses **behavioral simulation** — placing users inside realistic attack scenarios and measuring how they respond.

### The Problem It Solves

| Traditional Training | CyberMind Approach |
|---------------------|-------------------|
| Watch a video, answer MCQ | Live interactive simulations |
| Generic global scenarios | India-specific scams (UPI, KYC, Aadhaar) |
| Pass/fail quiz | Scored decisions with behavioral feedback |
| One-time training | Persistent progress, badges, levels |
| No attacker perspective | "Attacker View" reveals the scam playbook |

### Target Users

- Corporate employees in India (security awareness training)
- College students learning cybersecurity
- General public targeted by UPI and WhatsApp scams
- Security teams running internal phishing simulations

### Key Differentiators

- **Learning by doing**: Every module is a simulation, never passive content
- **India-first**: All scenarios are localised — SBI KYC scams, HDFC UPI fraud, IT department vishing, income tax refund scams, romance investment fraud
- **Attacker Perspective**: After every decision, users can reveal exactly how the attacker planned the scam
- **Feedback loop**: Score, mistakes, red flags, and a learning summary after each module

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │   Dashboard   │  │ Module Pages │  │  Login / Auth UI     │ │
│   │  (Progress +  │  │  Deepfake /  │  │  Sign In / Sign Up / │ │
│   │   Badges)     │  │  Phish / RPG │  │  Guest Mode          │ │
│   └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│          │                  │                      │             │
│   ┌──────┴──────────────────┴──────────────────────┴──────────┐ │
│   │              React App (SPA)                               │ │
│   │  AppContext (scores, badges, history, user)                │ │
│   │  Axios API client with auth interceptor + retry            │ │
│   │  React Router v6 — protected routes                       │ │
│   └────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────│────────────────────────────────────┘
                             │ HTTPS / REST
┌────────────────────────────┼────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
│                                                                 │
│   ┌────────────────────────┴───────────────────────────────┐    │
│   │                    FastAPI App                          │    │
│   │  CORS Middleware  │  Rate Limiting  │  JWT Auth         │    │
│   │  Global Error Handler  │  Request Validation           │    │
│   └──┬────────┬──────────┬────────────┬────────────────────┘    │
│      │        │          │            │                          │
│  /auth   /deepfake   /phish      /social      /user             │
│   Router  Router     Router      Router       Router            │
└──────┬────────┬──────────┬────────────┬────────────┬────────────┘
       │        │          │            │            │
┌──────┴────────┴──────────┴────────────┴────────────┴────────────┐
│                      SERVICE LAYER                               │
│                                                                  │
│  Auth Utils    Game Data     Game Data     Scenario Data         │
│  (JWT+bcrypt)  (10 samples)  (8 messages)  (3 scenarios)         │
│                + generate    + classify                          │
└────────────────────────────────────────────────────────────────┬─┘
                                                                 │
┌────────────────────────────────────────────────────────────────┴─┐
│                      DATA LAYER                                   │
│                                                                   │
│   SQLite (dev)  /  PostgreSQL (prod, via asyncpg)                 │
│                                                                   │
│   ┌──────────┐   ┌───────────────┐   ┌──────────────────┐        │
│   │  users   │   │ game_sessions │   │  decision_logs   │        │
│   │ (scores, │   │ (per-module   │   │ (every answer,   │        │
│   │  badges) │   │  history)     │   │  idempotent key) │        │
│   └──────────┘   └───────────────┘   └──────────────────┘        │
│                                                                   │
│   Alembic migration system (schema versioned)                     │
└───────────────────────────────────────────────────────────────────┘
```

### Architecture Pattern

The system follows a **Layered Monolith** architecture — the correct choice for this scope:

| Layer | Responsibility |
|-------|---------------|
| **Presentation** | React SPA — routing, state, UI components |
| **API Gateway** | FastAPI — CORS, auth middleware, rate limiting, request validation |
| **Router** | Per-feature routers — auth, deepfake, phish, social, user |
| **Service** | Business logic — scoring, badge computation, idempotency |
| **Data** | SQLAlchemy async ORM — User, GameSession, DecisionLog |
| **Config** | Pydantic Settings — all env vars validated at startup |

### Component Interaction Map

```
Browser
  │
  ├── GET /  → React SPA loads
  │             │
  │             ├── AppContext initialises
  │             │     ├── Reads localStorage (scores, badges, token)
  │             │     ├── Validates JWT expiry (atob decode)
  │             │     └── Clears stale auth if expired
  │             │
  │             └── React Router → protected routes
  │
  ├── POST /api/auth/login
  │     └── JWT returned → stored in localStorage
  │           └── All subsequent requests carry Bearer token
  │
  ├── GET /api/deepfake/samples → shuffled sample array
  │     └── User answers → POST /api/deepfake/submit (logged to DB)
  │           └── Correct → POST /api/user/update-score (idempotent)
  │
  ├── GET /api/phish/messages → shuffled inbox
  │     └── User classifies → POST /api/phish/submit
  │
  ├── GET /api/social/scenarios → scenario list
  │     └── User picks → local full scenario data used
  │           └── Each choice → POST /api/social/submit-decision
  │                 └── Finish → POST /api/social/save-session
  │
  └── GET /api/user/progress → session history per module
        └── Dashboard renders improvement sparkbars
```

---

## 3. System Design & Data Flow

### Authentication Flow

```
User submits login form
        │
        ▼
POST /api/auth/login
  ├── Pydantic validates EmailStr + password length
  ├── SELECT user WHERE email = req.email.lower()
  ├── verify_password(req.password, user.hashed_password)  ← timing-safe
  │     └── Uses bcrypt CryptContext (passlib)
  ├── create_access_token({"sub": user.id, "email": user.email})
  │     └── HS256 JWT, 7-day expiry, signed with SECRET_KEY
  └── Returns { token, user: { id, name, email, scores, badges } }
          │
          ▼
Frontend: localStorage.setItem("cybermind_token", token)
          │
          ▼
All API calls: Authorization: Bearer <token>
          │
          ▼
Startup (next session): isTokenExpired(token)
  ├── atob(token.split(".")[1]) → decode payload
  ├── payload.exp * 1000 < Date.now()
  └── Expired → clear localStorage, redirect to /login
```

### Score Update Flow (Idempotency)

```
User answers correctly in a module
        │
        ▼
Frontend: updateScore("deepfake", 15)
  ├── Optimistic update to React state (instant UI response)
  ├── Computes new badges from updated scores
  └── POST /api/user/update-score
        { module: "deepfake", points: 15, attempt_id: "a1b2c-xyz9" }
              │
              ▼
        Backend:
          ├── Verify JWT → extract user_id
          ├── SELECT DecisionLog WHERE answer = "attempt:a1b2c-xyz9"
          │     └── EXISTS → return { status: "duplicate" }  ← no double credit
          │     └── NOT EXISTS:
          │           ├── UPDATE users SET score_deepfake += 15
          │           ├── Recompute badges server-side
          │           ├── INSERT DecisionLog (idempotency record)
          │           └── COMMIT
          └── Return { status: "updated", scores, badges }
```

### Module Data Flow

```
                    ┌────────────────────────────────────┐
                    │         DEEPFAKE DETECTIVE          │
                    │                                     │
  GET /samples ──▶  │  10 samples (image/audio/video)    │
  (shuffled)        │  Real or AI-Generated labels        │
                    │  Clues + explanation per sample      │
                    │                                     │
  User answers ──▶  │  Immediate feedback panel           │
                    │  Detection clues revealed           │
                    │  Attacker perspective toggle        │
                    └─────────────┬───────────────────────┘
                                  │
                    POST /deepfake/submit (correct, points)
                    POST /user/update-score (if correct)

                    ┌────────────────────────────────────┐
                    │          PHISHBUSTER                │
                    │                                     │
  GET /messages ─▶  │  8 messages (email/SMS/WhatsApp)   │
  (shuffled)        │  Safe / Phishing / Smishing labels  │
                    │  Red flags per message               │
                    │                                     │
  User classifies ▶ │  Inbox-style dual-pane UI          │
                    │  Red flags revealed after answer    │
                    │  Attacker strategy (dark terminal)  │
                    └─────────────┬───────────────────────┘
                                  │
                    POST /phish/submit (answer, correct)

                    ┌────────────────────────────────────┐
                    │        SOCIALENGINEER RPG           │
                    │                                     │
  GET /scenarios ─▶ │  3 scenario cards with difficulty  │
  (list)            │  User picks a scenario              │
                    │                                     │
  Play phase:       │  WhatsApp-style chat interface      │
                    │  3-choice responses per step        │
                    │  Score feedback after each choice   │
                    │                                     │
  Result phase:     │  Full decision breakdown            │
                    │  Attacker playbook reveal           │
                    └─────────────┬───────────────────────┘
                                  │
                    POST /social/submit-decision (per step)
                    POST /social/save-session (on finish)
```

---

## 4. Folder Structure

```
cybermind/
│
├── Makefile                          # One-command dev/test/deploy
├── docker-compose.yml                # Full stack: backend + frontend
├── .env.example                      # Root env template
├── .gitignore
├── README.md
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI: test + build + docker on push
│
├── backend/                          # FastAPI Python backend
│   │
│   ├── main.py                       # App factory: CORS, middleware, routers, health
│   ├── config.py                     # Pydantic-settings: all env vars validated at startup
│   ├── database.py                   # SQLAlchemy async engine, ORM models, session factory
│   ├── auth_utils.py                 # JWT encode/decode, bcrypt, auth dependencies
│   ├── limiter.py                    # Shared SlowAPI rate-limiter instance
│   │
│   ├── routers/                      # One file per domain
│   │   ├── __init__.py
│   │   ├── auth.py                   # POST /signup, POST /login (rate-limited)
│   │   ├── deepfake.py               # GET /samples, POST /submit, POST /session
│   │   ├── phish.py                  # GET /messages, POST /submit, GET /generate
│   │   ├── social.py                 # GET /scenarios, GET /scenarios/{id},
│   │   │                             #   POST /submit-decision, POST /save-session
│   │   └── user.py                   # GET /leaderboard, GET /me, POST /update-score,
│   │                                 #   GET /progress, GET /{id}/profile
│   │
│   ├── migrations/                   # Alembic migration system
│   │   ├── env.py                    # Async migration environment
│   │   ├── script.py.mako            # Migration template
│   │   └── versions/
│   │       └── 0001_initial_schema.py # Initial tables + indexes
│   │
│   ├── tests/                        # Full test suite (45 tests)
│   │   ├── conftest.py               # In-memory SQLite fixtures, ASGI test client
│   │   ├── test_auth.py              # 14 tests: signup, login, validation, timing
│   │   ├── test_game_modules.py      # 14 tests: deepfake, phish, social endpoints
│   │   ├── test_user.py              # 13 tests: scoring, idempotency, badges, leaderboard
│   │   └── test_health.py            # 4 tests: root, health, 404, CORS
│   │
│   ├── alembic.ini                   # Migration config
│   ├── pytest.ini                    # asyncio_mode = auto
│   ├── requirements.txt              # All dependencies pinned
│   ├── Procfile                      # Render/Railway: uvicorn --workers 2 --loop uvloop
│   ├── Dockerfile                    # Non-root user, HEALTHCHECK, multi-stage build
│   ├── .dockerignore
│   ├── .env                          # Local dev env (git-ignored)
│   └── .env.example                  # Env template with documentation
│
└── frontend/                         # React 18 SPA
    │
    ├── src/
    │   │
    │   ├── App.jsx                   # Root: BrowserRouter, AppContext, ErrorBoundary,
    │   │                             #   token expiry check, score sync, uid() idempotency
    │   ├── index.js                  # React DOM render
    │   ├── index.css                 # Tailwind + custom component classes
    │   │
    │   ├── components/
    │   │   └── Layout.jsx            # Sidebar nav, level bar, badge display,
    │   │                             #   mobile topbar + hamburger
    │   │
    │   ├── pages/
    │   │   ├── Login.jsx             # Sign in / Sign up / Guest mode
    │   │   ├── Dashboard.jsx         # Score cards, progress trend chart, badges,
    │   │   │                         #   module cards, recent activity feed
    │   │   ├── DeepfakeDetective.jsx # 10 samples, image/audio/video rendering,
    │   │   │                         #   attacker view, result + learning summary
    │   │   ├── PhishBuster.jsx       # Dual-pane inbox, mobile scroller, red flags,
    │   │   │                         #   attacker strategy, 3-button classify
    │   │   ├── SocialEngineerRPG.jsx # Scenario picker, WhatsApp chat UI,
    │   │   │                         #   branching choices, playbook reveal
    │   │   └── NotFound.jsx          # 404 page
    │   │
    │   └── utils/
    │       └── api.js                # Axios: auth interceptor, 401 handler, retry with backoff
    │
    ├── public/
    │   ├── index.html                # OG meta tags, Twitter card, Google Fonts
    │   └── robots.txt
    │
    ├── tailwind.config.js            # Extended palette: primary, teal, danger, success,
    │                                 #   warning, neutral; custom shadows, animations, fonts
    ├── postcss.config.js
    ├── package.json                  # Dependencies, proxy to :8000, homepage: "/"
    ├── vercel.json                   # SPA rewrites, security headers, env config
    ├── Dockerfile                    # Multi-stage: Node build → nginx serve
    ├── nginx.conf                    # Security headers, CSP, gzip, SPA routing, API proxy
    ├── .dockerignore
    ├── .env                          # REACT_APP_API_URL (empty = use proxy)
    └── .env.example
```

---

## 5. Feature List

### Global Features

| Feature | Description | Status |
|---------|-------------|--------|
| User authentication | Email/password signup & login with JWT | Implemented |
| Guest mode | Full access without account creation | Implemented |
| Persistent scores | Scores synced to backend; localStorage fallback | Implemented |
| Level progression | Recruit → Analyst → Specialist → Guardian | Implemented |
| Skill badges | 4 badges earned by reaching score thresholds | Implemented |
| Dashboard | Score cards, module progress, badge display | Implemented |
| Improvement trend | Per-module sparkbar chart from session history | Implemented |
| Recent activity | Timestamped feed of last 8 decisions | Implemented |
| Token expiry handling | Expired JWT detected on startup, auto-logout | Implemented |
| Error recovery | React ErrorBoundary with "Return to Dashboard" | Implemented |
| Mobile responsive | Full sidebar collapse, mobile scrollers | Implemented |
| 404 page | Proper not-found page with navigation | Implemented |

### Module 1 — Deepfake Detective

| Feature | Description | Status |
|---------|-------------|--------|
| 10 sample dataset | 5 AI-Generated + 5 Real across 3 media types | Implemented |
| Image detection | GAN portrait, dating profile, business exec | Implemented |
| Audio detection | AI bank voicemail, voice-cloned family scam, real customer recording | Implemented |
| Video detection | Deepfake political video with lip-sync analysis | Implemented |
| Real/AI-Generated buttons | Instant binary classification | Implemented |
| Immediate feedback | Correct/incorrect verdict with explanation | Implemented |
| Detection clues panel | Specific technical indicators per sample | Implemented |
| Attacker perspective | Toggle reveals how the deepfake was created | Implemented |
| Result screen | Breakdown by sample + key learning summary | Implemented |
| API-first | Fetches from `/api/deepfake/samples` (shuffled); local fallback | Implemented |
| Session logging | Saves completion to DB for progress tracking | Implemented |

### Module 2 — PhishBuster

| Feature | Description | Status |
|---------|-------------|--------|
| 8-message inbox | Email, SMS, WhatsApp simulated messages | Implemented |
| India-specific scams | SBI KYC, Paytm prize, HDFC alert, income tax refund, job fraud | Implemented |
| 3-class classification | Safe / Phishing / Smishing per message | Implemented |
| Dual-pane inbox UI | Sidebar list + full message view (desktop) | Implemented |
| Mobile message scroller | Horizontal scrollable pill buttons on mobile | Implemented |
| Red flags panel | Specific red flags highlighted post-answer | Implemented |
| Attacker strategy | Dark terminal panel showing attacker economics | Implemented |
| Auto-complete detection | Finishes module when all messages classified | Implemented |
| Dynamic message generator | `GET /generate?category=kyc|upi|prize` creates randomised variants | Implemented |
| Result screen | Score, breakdown, key takeaways | Implemented |

### Module 3 — SocialEngineer RPG

| Feature | Description | Status |
|---------|-------------|--------|
| Scenario picker | 3 cards with difficulty badge + max score | Implemented |
| 3 distinct scenarios | Fake IT Support, UPI Fraud, Romance Scam | Implemented |
| Difficulty system | Easy / Medium / Hard with colour coding | Implemented |
| WhatsApp-style chat UI | Auto-scrolling chat with attacker + user bubbles | Implemented |
| Branching decisions | 3 choices per step: vulnerable / cautious / secure | Implemented |
| Score labels | Visual feedback (green/orange/red) after each choice | Implemented |
| Consequence text | Explanation of why that choice was good or bad | Implemented |
| Negative scoring | Dangerous choices subtract points | Implemented |
| Attacker playbook | Full step-by-step scam strategy revealed at result | Implemented |
| Key lessons panel | India-specific helplines (1930, cybercrime.gov.in) | Implemented |
| Try Another flow | Returns to scenario picker; no page reload needed | Implemented |

### India-Specific Scenarios

| Scenario | Attack Type | Ref Numbers |
|----------|-------------|-------------|
| SBI KYC expiry email | Phishing | sbi.co.in official domain |
| Paytm lucky draw SMS | Smishing | Personal UPI red flag |
| Amazon shipping email | Safe (genuine) | amazon.in verification |
| WFH job WhatsApp | Phishing | Rs 499 registration scam |
| HDFC transaction SMS | Safe (genuine) | 1800-258-6161 helpline |
| IT password reset email | Phishing (vishing) | company-helpdesk.info fake domain |
| Swiggy OTP WhatsApp | Safe (genuine) | OTP never share rule |
| Income tax refund email | Phishing | incometax.gov.in official domain |
| Fake IT Support call | Vishing RPG | company security@email |
| UPI fraud bank call | Vishing RPG | 1800-202-6161, cybercrime.gov.in, 1930 |
| Romance investment scam | Social engineering RPG | SEBI registered platforms only |

---

## 6. Module Deep Dive

### Deepfake Detective — Sample Catalogue

| # | Type | Label | Scenario |
|---|------|-------|----------|
| 1 | Image | AI-Generated | GAN portrait — smooth skin, asymmetric ears |
| 2 | Image | Real | Social media headshot — natural imperfections |
| 3 | Audio | AI-Generated | Bank voicemail — robotic inflection, no breathing |
| 4 | Image | AI-Generated | Business executive — too-perfect symmetry |
| 5 | Image | Real | Candid street photo — motion blur, natural lighting |
| 6 | Audio | Real | Customer voicemail — um/uh, memory lapse, varied pacing |
| 7 | Image | AI-Generated | Dating app profile — painted background, uniform teeth |
| 8 | Video | AI-Generated | Political speech — lip-sync errors, blink anomalies |
| 9 | Image | Real | Support agent photo — asymmetric features, real skin |
| 10 | Audio | AI-Generated | Voice-cloned parent emergency — no ambient sound |

### SocialEngineer RPG — Scenario Details

#### Scenario 1: Fake IT Support Attack
- **Difficulty**: Medium | **Max score**: 100 pts | **Steps**: 4
- **Attack type**: Vishing (Voice Phishing)
- **Attacker technique**: Pretexting → urgency → link → password → remote access
- **Key lesson**: IT teams never need your password; always call back via official number

#### Scenario 2: UPI Fraud — Fake Bank Agent
- **Difficulty**: Easy | **Max score**: 90 pts | **Steps**: 3
- **Attack type**: Social engineering + OTP hijacking
- **Attacker technique**: Fake caller ID → fear creation → UPI PIN request → OTP request
- **Key lesson**: Banks never request UPI PINs or OTPs; call 1930 for cybercrime

#### Scenario 3: Romance / Investment Scam
- **Difficulty**: Hard | **Max score**: 110 pts | **Steps**: 3
- **Attack type**: Social engineering + investment fraud
- **Attacker technique**: 3-week trust building → fake profits → personal UPI payment → emotional pressure
- **Key lesson**: Invest only on SEBI-registered platforms; never via personal UPI IDs

### Scoring System — Choice Labels

| Label | Score | Meaning |
|-------|-------|---------|
| `secure` | +30 to +35 | Optimal response; immediately terminates the attack |
| `cautious` | +20 to +25 | Correct instinct; delays attack but doesn't fully stop it |
| `vulnerable` | 0 | Gives attacker useful information |
| `critical_fail` | -20 to -30 | Directly enables the attack (shares credentials/OTP) |

---

## 7. Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2.0 | SPA framework, hooks, context |
| React Router | 6.22.0 | Client-side routing, protected routes |
| Tailwind CSS | 3.x | Utility-first styling |
| Lucide React | 0.344.0 | Icon library |
| Axios | 1.6.7 | HTTP client with interceptors |
| react-hot-toast | 2.4.1 | Toast notifications |
| DM Sans | Google Fonts | Body typeface |
| Syne | Google Fonts | Display/heading typeface |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.110.0 | Async REST API framework |
| Uvicorn | 0.27.1 | ASGI server |
| uvloop | 0.19.0 | High-performance async event loop |
| Pydantic | 2.6.1 | Request/response validation, settings |
| pydantic-settings | 2.2.1 | Environment variable management |
| SQLAlchemy | 2.0.27 | Async ORM |
| Alembic | 1.13.1 | Database migrations |
| aiosqlite | 0.20.0 | Async SQLite driver (dev) |
| python-jose | 3.3.0 | JWT encoding/decoding |
| passlib (bcrypt) | 1.7.4 | Password hashing |
| SlowAPI | 0.1.9 | Rate limiting |
| python-dotenv | 1.0.1 | `.env` file loading |

### Testing

| Technology | Version | Purpose |
|-----------|---------|---------|
| pytest | 8.1.1 | Test runner |
| pytest-asyncio | 0.23.6 | Async test support |
| httpx | 0.26.0 | ASGI test client |
| anyio | 4.3.0 | Async primitives |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker + Docker Compose | Full-stack containerisation |
| nginx | Static file serving, SPA routing, API proxy, security headers |
| GitHub Actions | CI: run tests + build frontend + build Docker images |
| Vercel | Frontend deployment (recommended) |
| Render / Railway | Backend deployment (recommended) |

---

## 8. API Reference

### Authentication

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/auth/signup` | None | 10/min per IP | Create account; returns JWT |
| POST | `/api/auth/login` | None | 20/min per IP | Login; returns JWT + scores + badges |

**Signup request body:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "SecurePass1"
}
```
Password rules: min 8 chars, at least 1 letter, at least 1 digit.

### Deepfake Detective

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/deepfake/samples` | Optional | Returns all 10 samples, shuffled |
| POST | `/api/deepfake/submit` | Optional | Log a single answer to DB |
| POST | `/api/deepfake/session` | Optional | Save completed session |

### PhishBuster

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/phish/messages` | Optional | Returns all 8 messages, shuffled |
| POST | `/api/phish/submit` | Optional | Log classification to DB |
| GET | `/api/phish/generate?category=kyc\|upi\|prize` | None | Generate randomised phishing message |

### SocialEngineer RPG

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/social/scenarios` | None | List all 3 scenarios (metadata only) |
| GET | `/api/social/scenarios/{id}` | None | Full scenario data with all steps |
| POST | `/api/social/submit-decision` | Optional | Log a single step decision |
| POST | `/api/social/save-session` | Optional | Save completed scenario session |

### User & Progress

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/leaderboard` | None | Top 10 users by total score |
| GET | `/api/user/me` | **Required** | Own profile, scores, badges |
| POST | `/api/user/update-score` | **Required** | Add points (idempotent via attempt_id) |
| GET | `/api/user/progress` | **Required** | Session history per module for trend chart |
| GET | `/api/user/{id}/profile` | **Required** | Own profile + recent sessions |

### Infrastructure

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Version info |
| GET | `/health` | DB liveness check; returns 503 if DB unreachable |

---

## 9. Database Schema

### Table: `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | VARCHAR(100) | Display name |
| `email` | VARCHAR(200) | Unique, indexed, lowercase-normalised |
| `hashed_password` | VARCHAR(200) | bcrypt hash |
| `score_deepfake` | INTEGER | Default 0, server_default "0" |
| `score_phish` | INTEGER | Default 0 |
| `score_social` | INTEGER | Default 0 |
| `score_total` | INTEGER | Default 0 |
| `badges` | TEXT | JSON array: `["deepfake_spotter", ...]` |
| `created_at` | DATETIME(tz) | server_default = CURRENT_TIMESTAMP |

### Table: `game_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER FK | → users.id (CASCADE DELETE), nullable for guests |
| `module` | VARCHAR(50) | `deepfake` / `phish` / `social` |
| `score` | INTEGER | Points earned in session |
| `correct` | INTEGER | Count of correct decisions |
| `total` | INTEGER | Total decisions in session |
| `created_at` | DATETIME(tz) | Auto-set |

### Table: `decision_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER FK | → users.id (CASCADE DELETE), nullable |
| `module` | VARCHAR(50) | Module identifier |
| `item_id` | INTEGER | Sample/message/step ID |
| `answer` | VARCHAR(100) | User's answer or `attempt:uid` for idempotency |
| `correct` | BOOLEAN | True/False |
| `points` | INTEGER | Points awarded |
| `created_at` | DATETIME(tz) | Auto-set |

### Relationships

```
users (1) ──── (N) game_sessions    [CASCADE DELETE]
users (1) ──── (N) decision_logs    [CASCADE DELETE]
```

---

## 10. Security Model

### Authentication & Authorisation

| Mechanism | Implementation |
|-----------|---------------|
| Password hashing | bcrypt via passlib CryptContext |
| JWT tokens | HS256, 7-day expiry, python-jose |
| Timing-safe login | Dummy hash always compared (prevents user enumeration) |
| Token expiry | Frontend checks `payload.exp` on every startup via `atob` |
| Protected endpoints | `get_current_user_required` FastAPI dependency |
| Guest endpoints | `get_current_user_optional` — no auth needed to play |

### Input Validation

| Check | Where |
|-------|-------|
| EmailStr format | `auth.py` — Pydantic validates at request time |
| Password complexity | `field_validator` — min 8 chars, 1 letter, 1 digit |
| Name XSS guard | `field_validator` — rejects `<`, `>`, `"`, `'` |
| Module name pattern | `user.py` — `pattern="^(deepfake|phish|social)$"` |
| Points ceiling | `user.py` — `Field(ge=0, le=500)` |
| Answer pattern | `deepfake.py` — `pattern="^(Real|AI-Generated)$"` |
| Classification pattern | `phish.py` — `pattern="^(Safe|Phishing|Smishing)$"` |
| Generate category | `phish.py` — `Query(pattern="^(kyc|upi|prize)$")` |

### Score Integrity

| Threat | Mitigation |
|--------|-----------|
| Client sends arbitrary user_id | `user_id` extracted from JWT only, never from request body |
| Double-submit / retry inflates score | Idempotency key (`attempt_id`) checked before crediting |
| Client inflates points | Server-side `le=500` ceiling per call |
| Client fakes badges | Badge computation runs server-side in `_compute_badges()` |
| Score manipulation via repeated calls | Idempotency record stored in `decision_logs` |

### Infrastructure Security

| Layer | Measure |
|-------|---------|
| CORS | Explicit origins from env var; no wildcard with credentials |
| Rate limiting | 10 signups/min, 20 logins/min per IP (SlowAPI) |
| Error messages | Global handler returns safe 500 message; never leaks stack traces |
| Docs | Swagger UI hidden in production (`ENVIRONMENT=production`) |
| Docker | Non-root `appuser`, HEALTHCHECK, no secrets in image |
| nginx | `server_tokens off`, X-Frame-Options DENY, Content-Security-Policy, X-Content-Type-Options |
| Secrets | `SECRET_KEY` raises `RuntimeError` at startup if missing in production |

---

## 11. Deployment Architecture

### Production Stack

```
                      DNS
                       │
               ┌───────▼────────┐
               │    Vercel CDN   │   ← Static files + edge cache
               │  (Frontend)     │
               └───────┬────────┘
                       │  /api/* proxy
               ┌───────▼────────┐
               │   Render.com   │   ← FastAPI + uvicorn (2 workers)
               │   (Backend)    │
               └───────┬────────┘
                       │
               ┌───────▼────────┐
               │  Render Postgres │  ← Managed database (optional)
               │  or SQLite file  │  ← Volume-mounted for SQLite
               └────────────────┘
```

### Docker Compose (Self-hosted)

```
                    Port 80
                       │
               ┌───────▼────────┐
               │  nginx container │   ← Security headers, gzip, SPA routing
               │  (Frontend)      │
               └───────┬────────┘
                       │  proxy /api/
               ┌───────▼────────┐
               │ FastAPI container│   ← Internal only (expose not publish)
               │  (Backend)      │
               └───────┬────────┘
                       │
               ┌───────▼────────┐
               │  Docker Volume  │   ← /app/data/cybermind.db persisted
               └────────────────┘
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **Yes (prod)** | — | JWT signing key (min 32 hex chars) |
| `ENVIRONMENT` | No | `development` | `production` hides Swagger, enforces key |
| `DATABASE_URL` | No | SQLite | `postgresql+asyncpg://user:pass@host/db` |
| `ALLOWED_ORIGINS` | No | `localhost:3000` | Comma-separated frontend URLs |
| `DB_ECHO` | No | `false` | Log SQL queries (debug) |
| `REACT_APP_API_URL` | No (local) | `""` (proxy) | Full backend URL for production |

---

## 12. Scoring & Progression System

### Points Per Module

| Module | Points per correct answer | Max per session |
|--------|--------------------------|-----------------|
| Deepfake Detective | 15 pts | 150 pts (10 samples) |
| PhishBuster | 15 pts | 120 pts (8 messages) |
| Social RPG — IT Support | 25–35 pts | 100 pts (4 steps) |
| Social RPG — UPI Fraud | 25–35 pts | 90 pts (3 steps) |
| Social RPG — Romance Scam | 25–35 pts | 110 pts (3 steps) |

Dangerous choices (sharing passwords, OTPs, UPI PINs) deduct 20–30 points.

### Levels

| Level | Points Required | Description |
|-------|----------------|-------------|
| Recruit | 0 – 99 | Just getting started |
| Analyst | 100 – 299 | Building awareness |
| Specialist | 300 – 599 | Consistently identifying threats |
| Guardian | 600+ | Maximum level — expert defender |

### Badges

| Badge | Threshold | Module |
|-------|-----------|--------|
| Deepfake Spotter | 50+ deepfake points | Deepfake Detective |
| Phish-Proof | 50+ phish points | PhishBuster |
| Human Firewall | 50+ social points | SocialEngineer RPG |
| Cyber Guardian | 200+ total points | All modules |

Badges are computed **server-side** after every score update. The client cannot fake badge awards.

### Feedback Loop

```
Complete any module
        │
        ▼
Result Screen
  ├── Score earned this session
  ├── Correct vs total count
  ├── Per-decision breakdown (label + consequence)
  ├── Key learnings panel (India-specific tips)
  └── Attacker playbook / perspective reveal
        │
        ▼
Dashboard (next visit)
  ├── Updated score cards
  ├── Level progress bar
  ├── Improvement sparkbars (session history per module)
  └── Badge earned notification
```

---

## 13. Quick Start Guide

### Option 1 — One Command (Makefile)

```bash
git clone <repo>
cd cybermind
make install      # installs backend venv + frontend node_modules
make dev          # starts backend :8000 and frontend :3000 in parallel
```

### Option 2 — Manual

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env .env          # already pre-filled for local dev
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install --legacy-peer-deps
npm start
```

Open **http://localhost:3000** — the frontend proxies all `/api/*` requests to the backend automatically.

### Option 3 — Docker

```bash
cp .env.example .env
# Edit .env: set SECRET_KEY to a 64-char hex string
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"

docker compose up --build
# App runs at http://localhost
```

### Running Tests

```bash
cd backend
source venv/bin/activate
pytest -v
# 45 tests across auth, game modules, user/scoring, infrastructure
# All run against an in-memory SQLite database — no setup needed
```

### Applying Database Migrations

```bash
cd backend
source venv/bin/activate
alembic upgrade head          # apply all pending migrations
alembic revision --autogenerate -m "description"  # create new migration
```

---

*CyberMind — Train smarter. Defend better.*
