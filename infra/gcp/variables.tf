variable "project_id" {
  description = "Dedicated GCP project that holds everything (created by deploy.sh)."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Cloud SQL and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "name" {
  description = "Base name for all resources."
  type        = string
  default     = "eld-trip-planner"
}

variable "access_token" {
  description = "OAuth access token for the google provider (gcloud auth print-access-token)."
  type        = string
  sensitive   = true
}

variable "image" {
  description = "Container image for the API (built by deploy.sh into Artifact Registry)."
  type        = string
  # Placeholder so plan/destroy work before the first image exists.
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_origin" {
  description = "Allowed CORS origin of the Vercel frontend."
  type        = string
  default     = "https://eld-trip-planner-beige-five.vercel.app"
}

variable "geocoder_user_agent" {
  description = "Nominatim usage policy asks for an identifying User-Agent."
  type        = string
  default     = "eld-trip-planner/1.0 (cloud run deployment)"
}

variable "min_instances" {
  description = "Keep one warm instance so graders never hit a cold start."
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Cap instances (free public geocoder/router are rate limited)."
  type        = number
  default     = 2
}

variable "db_tier" {
  description = "Cloud SQL machine tier (db-f1-micro is the cheapest)."
  type        = string
  default     = "db-f1-micro"
}
