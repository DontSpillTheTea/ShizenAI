# ── Cloud SQL PostgreSQL ──────────────────────────────────────────────────────
# Private IP only — the database is not publicly reachable.
# Connection from the app VM uses the internal VPC address.
#
# IMPORTANT: depends_on google_service_networking_connection is required.
# Cloud SQL private IP does not automatically detect the dependency, so without
# an explicit depends_on the apply may fail on first run.
# This is documented in the Terraform Registry for google_sql_database_instance.

resource "google_sql_database_instance" "postgres" {
  project             = var.project_id
  name                = "shizen-db-${var.environment}"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false # Set true for production; false speeds up demo teardown

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL" # Single-zone — sufficient for demo

    disk_autoresize = true
    disk_size       = 10
    disk_type       = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = false                                  # Disable public IP
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled = false # Disable backups for demo simplicity; enable for production
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  # Explicit dependency: private IP setup requires the service networking connection
  # to be established first. Without this, Terraform may attempt to create the instance
  # before peering is ready, which causes a confusing apply failure.
  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.sqladmin,
  ]
}

# ── Database ──────────────────────────────────────────────────────────────────

resource "google_sql_database" "app_db" {
  project  = var.project_id
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# ── Database user ─────────────────────────────────────────────────────────────

resource "google_sql_user" "app_user" {
  project  = var.project_id
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}
