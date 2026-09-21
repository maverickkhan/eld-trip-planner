terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Short-lived user token from `gcloud auth print-access-token` (deploy.sh sets it),
# so no service-account keys or application-default login are needed.
provider "google" {
  access_token          = var.access_token
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}
