# ── Firewall rules ────────────────────────────────────────────────────────────
# GCP VPC blocks all inbound traffic by default.
# We only open what is explicitly needed.

# HTTP — public access to the app
resource "google_compute_firewall" "allow_http" {
  project     = var.project_id
  name        = "shizen-allow-http-${var.environment}"
  network     = google_compute_network.vpc.id
  description = "Allow HTTP ingress to app VMs"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["shizen-app"]
}

# HTTPS — TLS termination at Nginx/Caddy on the VM
resource "google_compute_firewall" "allow_https" {
  project     = var.project_id
  name        = "shizen-allow-https-${var.environment}"
  network     = google_compute_network.vpc.id
  description = "Allow HTTPS ingress to app VMs"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["shizen-app"]
}

# App ports — direct access to frontend and backend
resource "google_compute_firewall" "allow_app_ports" {
  project     = var.project_id
  name        = "shizen-allow-app-ports-${var.environment}"
  network     = google_compute_network.vpc.id
  description = "Allow direct access to Frontend (5173) and Backend (8000)"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["5173", "8000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["shizen-app"]
}

# SSH — optional, gated by enable_ssh variable.
# Default: disabled. Only create when you need to shell into the VM.
# Restrict ssh_source_cidr to your office/home IP rather than 0.0.0.0/0.
resource "google_compute_firewall" "allow_ssh" {
  count = var.enable_ssh ? 1 : 0

  project     = var.project_id
  name        = "shizen-allow-ssh-${var.environment}"
  network     = google_compute_network.vpc.id
  description = "Allow SSH from a known source CIDR — keep restricted"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [var.ssh_source_cidr]
  target_tags   = ["shizen-app"]
}

# Note: Cloud SQL private IP connectivity is handled through VPC peering /
# Private Services Access — no explicit VM-to-database firewall rule is needed.
