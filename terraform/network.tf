# ── VPC ───────────────────────────────────────────────────────────────────────
# Custom VPC with auto_create_subnetworks disabled so we control all subnets.

resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = "shizen-vpc-${var.environment}"
  auto_create_subnetworks = false
  description             = "ShizenAI custom VPC — ${var.environment}"

  depends_on = [google_project_service.compute]
}

# ── Application subnet ────────────────────────────────────────────────────────
# Public-facing subnet where the app VM lives.

resource "google_compute_subnetwork" "app" {
  project       = var.project_id
  name          = "shizen-app-subnet-${var.environment}"
  network       = google_compute_network.vpc.id
  region        = var.region
  ip_cidr_range = "10.10.1.0/24"
  description   = "Subnet for the ShizenAI app VM"
}

# ── Private Services Access ───────────────────────────────────────────────────
# Cloud SQL with private IP requires a peered address range allocated inside the VPC.
# Google-managed services connect over this peering — the DB is never publicly reachable.

resource "google_compute_global_address" "private_ip_range" {
  project       = var.project_id
  name          = "shizen-private-ip-range-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 24
  network       = google_compute_network.vpc.id
  description   = "Reserved IP block for Cloud SQL private service access"

  depends_on = [google_project_service.servicenetworking]
}

# Establish the private service networking connection between our VPC and
# Google-managed services (required for Cloud SQL private IP).
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_project_service.servicenetworking]
}
