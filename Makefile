# Convenience targets for local development and deployment.

.PHONY: backend frontend test lint build deploy-gcp destroy-gcp

# Backend on Google Cloud Run via Terraform (see infra/gcp/README section in README.md).
# Usage: make deploy-gcp PROJECT_ID=eld-trip-planner-2609 BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX
deploy-gcp:
	cd infra/gcp && PROJECT_ID=$(PROJECT_ID) BILLING_ACCOUNT=$(BILLING_ACCOUNT) ./deploy.sh

destroy-gcp:
	cd infra/gcp && PROJECT_ID=$(PROJECT_ID) ./destroy.sh --delete-project

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
