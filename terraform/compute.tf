# ── Static external IP (optional, for DNS) ────────────────────────────────────

resource "google_compute_address" "app_static_ip" {
  project     = var.project_id
  name        = "shizen-app-ip-${var.environment}"
  region      = var.region
  description = "Static external IP for the ShizenAI app VM — point DNS A record here"

  depends_on = [google_project_service.compute]
}

# ── VM service account ────────────────────────────────────────────────────────
# Least-privilege service account for the app VM.
# Grants only logging and monitoring write permissions by default.

resource "google_service_account" "app_vm" {
  project      = var.project_id
  account_id   = "shizen-app-vm-${var.environment}"
  display_name = "ShizenAI App VM (${var.environment})"
}

# ── Compute Engine instance ───────────────────────────────────────────────────

resource "google_compute_instance" "app" {
  project      = var.project_id
  name         = "shizen-app-${var.environment}"
  machine_type = var.app_machine_type
  zone         = var.zone
  description  = "ShizenAI application host — ${var.environment}"
  tags         = ["shizen-app"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = google_compute_network.vpc.id
    subnetwork = google_compute_subnetwork.app.id

    # Attach the static external IP for public access
    access_config {
      nat_ip = google_compute_address.app_static_ip.address
    }
  }

  service_account {
    email  = google_service_account.app_vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  # Bootstrap: installs Docker + Docker Compose and starts the app.
  # To use: add your repo URL and env vars below or pass via metadata.
  metadata_startup_script = replace(templatefile("${path.module}/startup.sh.tpl", {
    environment = var.environment
    db_host     = google_sql_database_instance.postgres.private_ip_address
    db_port     = "5432"
    db_name     = var.db_name
    db_user     = var.db_user
    db_password = var.db_password
    app_port    = tostring(var.app_port)
  }), "\r\n", "\n")

  depends_on = [
    google_project_service.compute,
    google_sql_database_instance.postgres,
  ]

  labels = {
    environment = var.environment
    app         = "shizen"
  }
}
