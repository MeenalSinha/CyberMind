# CyberMind — Human Defense Simulator

A full-stack gamified cybersecurity training platform.  
Three interactive modules teach users to detect AI deepfakes, phishing attacks, and social engineering.

---

## Project Structure

```
cybermind/
├── .github/
│   └── workflows/ci.yml          # GitHub Actions: test + build + docker
├── backend/
│   ├── config.py                 # Pydantic-settings — all env vars validated
│   ├── main.py                   # FastAPI app, CORS, global error handler
│   ├── database.py               # SQLAlchemy async, Postgres/SQLite
│   ├── auth_utils.py             # JWT + bcrypt
│   ├── limiter.py                # Shared rate-limiter instance
│   ├── alembic.ini               # Database migration config
│   ├── migrations/               # Alembic migrations
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── routers/
│   │   ├── auth.py               # POST /signup, /login
│   │   ├── deepfake.py           # GET /samples, POST /submit
│   │   ├── phish.py              # GET /messages, POST /submit, GET /generate
│   │   ├── social.py             # GET /scenarios, POST /submit-decision, /save-session
│   │   └── user.py               # GET /leaderboard, /me, POST /update-score, GET /{id}/profile
│   ├── tests/
│   │   ├── conftest.py           # In-memory SQLite fixtures
│   │   ├── test_auth.py          # 14 auth tests
│   │   ├── test_game_modules.py  # 14 game module tests
│   │   ├── test_user.py          # 13 user/scoring tests
│   │   └── test_health.py        # 4 infrastructure tests
│   ├── Dockerfile
│   ├── Procfile
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── .env                      # Local dev (git-ignored)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router, ErrorBoundary, global context
│   │   ├── utils/api.js          # Axios + token + retry interceptors
│   │   ├── components/Layout.jsx # Sidebar, level bar, badges
│   │   └── pages/
│   │       ├── Login.jsx         # Sign in / Sign up / Guest
│   │       ├── Dashboard.jsx     # Score cards, badges, server sync
│   │       ├── DeepfakeDetective.jsx
│   │       ├── PhishBuster.jsx
│   │       ├── SocialEngineerRPG.jsx
│   │       └── NotFound.jsx      # 404 page
│   ├── public/
│   │   ├── index.html            # OG tags, meta
│   │   └── robots.txt
│   ├── Dockerfile                # Multi-stage: build + nginx
│   ├── nginx.conf                # Security headers, CSP, gzip, SPA routing
│   ├── vercel.json               # Rewrites + security headers + env config
│   ├── package.json
│   └── .dockerignore
├── docker-compose.yml            # Full stack with health checks, volume mount
├── .env.example                  # Root env example
└── README.md
```

---

## Quick Start — Local Development

### Prerequisites
- Python 3.11+  
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env .env                                       # already exists — ready to use
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs  
Health check: http://localhost:8000/health

### Frontend (new terminal)

```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

App: http://localhost:3000  
The `"proxy": "http://localhost:8000"` in package.json routes all `/api/*` calls automatically.

---

## Running Tests

```bash
cd backend
pytest -v
```

45 tests across auth, game modules, user/scoring, and infrastructure.  
All tests run against an in-memory SQLite database — no setup required.

---

## Database Migrations

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Generate a new migration after changing models
alembic revision --autogenerate -m "add new column"

# Roll back one migration
alembic downgrade -1
```

---

## Docker — Full Stack

```bash
# Create .env from example
cp .env.example .env
# Edit .env: set SECRET_KEY to a real random value
python -c "import secrets; print(secrets.token_hex(32))"

# Build and start
docker compose up --build

# App runs at http://localhost
```

Backend health check: `curl http://localhost/health`

---

## Production Deployment

### Backend → Render

1. Push to GitHub
2. New Web Service → connect repo → set root to `backend/`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2 --loop uvloop`
5. Environment variables:
   - `SECRET_KEY` = (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `ENVIRONMENT` = `production`
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`
   - `DATABASE_URL` = (Render Postgres URL if using managed DB)

### Frontend → Vercel

1. Import repo → set root to `frontend/`
2. Add environment variable:
   - `REACT_APP_API_URL` = `https://your-backend.onrender.com`
3. Deploy

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | None | Create account |
| POST | `/api/auth/login`  | None | Login, returns JWT |

### Game Modules
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/api/deepfake/samples`          | Optional | Get shuffled samples |
| POST | `/api/deepfake/submit`           | Optional | Log an answer |
| GET  | `/api/phish/messages`            | Optional | Get inbox messages |
| POST | `/api/phish/submit`              | Optional | Log classification |
| GET  | `/api/phish/generate?category=`  | None     | Generate dynamic message |
| GET  | `/api/social/scenarios`          | None     | List scenarios |
| GET  | `/api/social/scenarios/{id}`     | None     | Full scenario data |
| POST | `/api/social/submit-decision`    | Optional | Log a choice |
| POST | `/api/social/save-session`       | Optional | Save completed session |

### User
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/api/user/leaderboard`      | None     | Top 10 users |
| GET  | `/api/user/me`               | Required | Own profile + scores |
| POST | `/api/user/update-score`     | Required | Add points (idempotent) |
| GET  | `/api/user/{id}/profile`     | Required | View own profile |

### Infrastructure
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Version info |
| GET | `/health` | DB liveness check |

---

## Security Features

- **JWT authentication** with 7-day expiry; expiry validated on client startup
- **bcrypt** password hashing with timing-safe comparison
- **Rate limiting**: 10/min signup, 20/min login per IP
- **Input validation**: EmailStr, password complexity, name XSS guard, field length limits
- **CORS**: explicit origins only — no wildcard with credentials
- **Idempotency keys**: score updates safe to retry
- **Server-side badge computation**: client cannot fake badges
- **nginx security headers**: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- **Non-root Docker user**
- **No secrets in source code**: SECRET_KEY enforced via env, fails loudly in production

---

## Scoring System

| Module | Points per correct | Max per session |
|--------|-------------------|-----------------|
| Deepfake Detective | 15 pts | 105 pts (7 samples) |
| PhishBuster | 15 pts | 120 pts (8 messages) |
| Social RPG | 20–35 pts | 100 pts (4 steps) |

### Badges
| Badge | Requirement |
|-------|-------------|
| Deepfake Spotter | 50+ deepfake points |
| Phish-Proof | 50+ phish points |
| Human Firewall | 50+ social points |
| Cyber Guardian | 200+ total points |

### Levels
| Level | Range |
|-------|-------|
| Recruit | 0–99 |
| Analyst | 100–299 |
| Specialist | 300–599 |
| Guardian | 600+ |
