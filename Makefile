.PHONY: dev backend frontend install test clean

install:
	@echo "Installing backend..."
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	@echo "Installing frontend..."
	cd frontend && npm install

backend:
	cd backend && . venv/bin/activate && uvicorn main:app --reload --port 8000

frontend:
	cd frontend && npm start

dev:
	@echo "Starting CyberMind full stack..."
	@make -j2 backend frontend

test:
	cd backend && . venv/bin/activate && pytest -v

migrate:
	cd backend && . venv/bin/activate && alembic upgrade head

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -f backend/cybermind.db

docker-up:
	docker compose up --build

docker-down:
	docker compose down

help:
	@echo "Commands:"
	@echo "  make install    Install all dependencies"
	@echo "  make dev        Start both backend and frontend"
	@echo "  make backend    Start backend only (port 8000)"
	@echo "  make frontend   Start frontend only (port 3000)"
	@echo "  make test       Run backend test suite"
	@echo "  make migrate    Apply database migrations"
	@echo "  make docker-up  Start full stack in Docker"
