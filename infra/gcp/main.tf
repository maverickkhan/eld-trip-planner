# ---------------------------------------------------------------------------
# ELD Trip Planner API on Google Cloud
#
#   Artifact Registry  <- Cloud Build pushes backend/Dockerfile here (deploy.sh)
#   Cloud SQL Postgres <- persistent trips (permalinks survive deploys)
#   Secret Manager     <- Django secret key + DATABASE_URL
#   Cloud Run (v2)     <- gunicorn container, public HTTPS, min 1 instance
#
# Everything lives in one dedicated project, so `terraform destroy` (or simply
# deleting the project) removes it all.  No resource has deletion protection.
# ---------------------------------------------------------------------------

data "google_project" "app" {
  project_id = var.project_id
}

locals {
  labels = {
    app        = "eld-trip-planner"
    managed-by = "terraform"
  }
}

# --- Container registry -----------------------------------------------------

resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  description   = "ELD Trip Planner API images"
  labels        = local.labels
}

# --- Database ---------------------------------------------------------------

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "db" {
  name                = "${var.name}-db"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = false

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = false
    user_labels       = local.labels

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      # Cloud Run reaches the instance through the Cloud SQL Auth Proxy socket;
      # no authorized networks needed.
      ipv4_enabled = true
    }
  }
}

resource "google_sql_database" "app" {
  name     = "eld"
  instance = google_sql_database_instance.db.name
}

resource "google_sql_user" "app" {
  name     = "eld"
  instance = google_sql_database_instance.db.name
  password = random_password.db.result
}

# --- Secrets ----------------------------------------------------------------

resource "random_password" "django_secret" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret" "django_secret" {
  secret_id = "${var.name}-django-secret-key"
  labels    = local.labels
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "django_secret" {
  secret      = google_secret_manager_secret.django_secret.id
  secret_data = random_password.django_secret.result
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.name}-database-url"
  labels    = local.labels
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  # dj-database-url understands a unix-socket host via ?host=
  secret_data = "postgres://${google_sql_user.app.name}:${random_password.db.result}@/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.db.connection_name}"
}

# --- Runtime identity -------------------------------------------------------

resource "google_service_account" "run" {
  account_id   = "${var.name}-run"
  display_name = "ELD Trip Planner API (Cloud Run)"
}

resource "google_project_iam_member" "run_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_project_iam_member" "run_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# --- Cloud Run service ------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name                = "${var.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.labels

  template {
    service_account                  = google_service_account.run.email
    timeout                          = "120s"
    max_instance_request_concurrency = 40
    labels                           = local.labels

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.db.connection_name]
      }
    }

    containers {
      image = var.image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "DJANGO_DEBUG"
        value = "false"
      }
      env {
        # Django accepts a leading dot as a subdomain wildcard.
        name  = "DJANGO_ALLOWED_HOSTS"
        value = ".run.app"
      }
      env {
        # Cloud Run terminates TLS and forwards X-Forwarded-Proto.
        name  = "DJANGO_SECURE_SSL_REDIRECT"
        value = "false"
      }
      env {
        name  = "CORS_ALLOWED_ORIGINS"
        value = var.frontend_origin
      }
      env {
        name  = "GEOCODER_USER_AGENT"
        value = var.geocoder_user_agent
      }
      env {
        name  = "TRUCK_MAX_AVERAGE_SPEED_MPH"
        value = "60"
      }
      env {
        name = "DJANGO_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.django_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      # The container runs migrations before gunicorn starts; give it time.
      startup_probe {
        initial_delay_seconds = 5
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 24
        tcp_socket {
          port = 8000
        }
      }
    }
  }

  depends_on = [
    google_project_iam_member.run_sql,
    google_project_iam_member.run_secrets,
    google_secret_manager_secret_version.django_secret,
    google_secret_manager_secret_version.database_url,
    google_sql_user.app,
  ]
}

# Public API (the frontend calls it directly from the browser).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
