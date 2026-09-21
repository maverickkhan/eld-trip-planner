#!/usr/bin/env bash
# Tear everything down.
#
#   PROJECT_ID=eld-trip-planner-2609 ./destroy.sh                 # destroy resources, keep the empty project
#   PROJECT_ID=eld-trip-planner-2609 ./destroy.sh --delete-project # ...and delete the project itself
#
# If the local Terraform state is ever lost, deleting the project is still a
# complete cleanup: everything lives inside it.
set -euo pipefail
cd "$(dirname "$0")"

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
NAME="${NAME:-eld-trip-planner}"

export TF_VAR_project_id="${PROJECT_ID}" TF_VAR_region="${REGION}" TF_VAR_name="${NAME}"
export TF_VAR_access_token
TF_VAR_access_token="$(gcloud auth print-access-token)"

if [ -f terraform.tfstate ]; then
  echo "==> terraform destroy"
  terraform destroy -input=false -auto-approve
else
  echo "==> no local Terraform state found; skipping terraform destroy"
fi

if [ "${1:-}" = "--delete-project" ]; then
  echo "==> deleting project ${PROJECT_ID} (recoverable for 30 days in the console)"
  gcloud projects delete "${PROJECT_ID}" --quiet
fi
