#!/usr/bin/env bash
# Deploy (or update) the ELD Trip Planner API on Google Cloud Run.
#
#   PROJECT_ID=eld-trip-planner-2609 BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX ./deploy.sh
#
# Idempotent: creates the dedicated project once, enables APIs, builds the
# backend image with Cloud Build, then applies Terraform.  Re-run after code
# changes to ship a new image.  Requires: gcloud (logged in), terraform >= 1.6.
set -euo pipefail
cd "$(dirname "$0")"

: "${PROJECT_ID:?set PROJECT_ID (globally unique, e.g. eld-trip-planner-2609)}"
: "${BILLING_ACCOUNT:?set BILLING_ACCOUNT (gcloud billing accounts list)}"
REGION="${REGION:-us-central1}"
NAME="${NAME:-eld-trip-planner}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://eld-trip-planner-beige-five.vercel.app}"
TAG="${TAG:-$(git -C ../.. rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${NAME}/api:${TAG}"

echo "==> Project ${PROJECT_ID} (${REGION})"
if ! gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud projects create "${PROJECT_ID}" --name="${NAME}" --labels=app=eld-trip-planner,managed-by=terraform
fi
gcloud billing projects link "${PROJECT_ID}" --billing-account="${BILLING_ACCOUNT}" >/dev/null
gcloud services enable \
  serviceusage.googleapis.com cloudresourcemanager.googleapis.com iam.googleapis.com \
  run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

export TF_VAR_project_id="${PROJECT_ID}"
export TF_VAR_region="${REGION}"
export TF_VAR_name="${NAME}"
export TF_VAR_frontend_origin="${FRONTEND_ORIGIN}"
export TF_VAR_access_token
TF_VAR_access_token="$(gcloud auth print-access-token)"

echo "==> Terraform init + container registry"
terraform init -input=false -upgrade >/dev/null
terraform apply -input=false -auto-approve -target=google_artifact_registry_repository.api

echo "==> Building ${IMAGE} with Cloud Build"
gcloud builds submit ../../backend --tag "${IMAGE}" --project "${PROJECT_ID}" --quiet

echo "==> Terraform apply (database, secrets, Cloud Run)"
printf 'image = "%s"\n' "${IMAGE}" > image.auto.tfvars
TF_VAR_access_token="$(gcloud auth print-access-token)"  # refresh; SQL creation can take a while
terraform apply -input=false -auto-approve

URL="$(terraform output -raw service_url)"
echo
echo "==> API deployed: ${URL}"
echo "    health: $(curl -s -m 30 -o /dev/null -w '%{http_code}' "${URL}/api/health/")"
echo
echo "Next: cd ../../frontend && vercel env add VITE_API_BASE_URL production   # value: ${URL}"
echo "      vercel --prod"
