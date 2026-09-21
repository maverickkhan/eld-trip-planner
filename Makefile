# Convenience targets for local development.

.PHONY: backend frontend test lint build

backend:
	cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py runserver 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest
	cd frontend && npm test

lint:
	cd frontend && npm run lint

build:
	cd frontend && npm run build
