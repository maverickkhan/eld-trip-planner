output "service_url" {
  description = "Public HTTPS URL of the API (set this as VITE_API_BASE_URL on Vercel)."
  value       = google_cloud_run_v2_service.api.uri
}

output "image" {
  description = "Container image currently deployed."
  value       = var.image
}

output "sql_connection_name" {
  description = "Cloud SQL connection name (project:region:instance)."
  value       = google_sql_database_instance.db.connection_name
}

output "project_number" {
  value = data.google_project.app.number
}
