# ── Project ───────────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment label (e.g. demo, dev)"
  type        = string
  default     = "demo"
}

# ── Compute ───────────────────────────────────────────────────────────────────

variable "app_machine_type" {
  description = "Compute Engine machine type for the app VM"
  type        = string
  default     = "e2-medium"
}

variable "app_port" {
  description = "Port the app listens on (used for optional direct-access firewall rule)"
  type        = number
  default     = 8080
}

variable "enable_ssh" {
  description = "Whether to create an SSH ingress rule (true for dev, false for prod-like demo)"
  type        = bool
  default     = false
}

variable "ssh_source_cidr" {
  description = "CIDR range allowed to SSH into the VM — only used when enable_ssh = true"
  type        = string
  default     = "0.0.0.0/0" # Override with your real IP in tfvars
}

variable "domain_name" {
  description = "Optional custom domain to associate with the static IP (documentation only)"
  type        = string
  default     = ""
}

# ── Cloud SQL ─────────────────────────────────────────────────────────────────

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Name of the initial PostgreSQL database to create"
  type        = string
  default     = "shizen"
}

variable "db_user" {
  description = "PostgreSQL application user"
  type        = string
  default     = "shizen_user"
}

variable "db_password" {
  description = "PostgreSQL application user password — set via TF_VAR_db_password or tfvars"
  type        = string
  sensitive   = true
}

variable "perplexity_api_key" {
  description = "Perplexity API key injected into backend runtime"
  type        = string
  default     = ""
  sensitive   = true
}

variable "elevenlabs_api_key" {
  description = "Optional ElevenLabs API key injected into backend runtime"
  type        = string
  default     = ""
  sensitive   = true
}
