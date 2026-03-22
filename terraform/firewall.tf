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

# App port — direct access if not behind a reverse proxy
resource "google_compute_firewall" "allow_app_port" {
  project     = var.project_id
  name        = "shizen-allow-app-port-${var.environment}"
  network     = google_compute_network.vpc.id
  description = "Allow direct access to FastAPI/frontend port — disable once Nginx is configured"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = [tostring(var.app_port)]
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
