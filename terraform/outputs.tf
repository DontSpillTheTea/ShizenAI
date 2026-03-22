output "app_public_ip" {
  description = "External IP of the ShizenAI app VM — point your DNS A record here"
  value       = google_compute_address.app_static_ip.address
}

output "app_instance_name" {
  description = "Name of the Compute Engine instance"
  value       = google_compute_instance.app.name
}

output "vpc_name" {
  description = "Name of the custom VPC"
  value       = google_compute_network.vpc.name
}

output "db_private_ip" {
  description = "Private IP of the Cloud SQL instance — use this as DB_HOST in your app"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "db_connection_name" {
  description = "Cloud SQL connection name (project:region:instance)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "db_name" {
  description = "PostgreSQL database name"
  value       = var.db_name
}

output "db_user" {
  description = "PostgreSQL user"
  value       = var.db_user
}

output "dns_instructions" {
  description = "How to wire DNS to this deployment"
  value       = var.domain_name != "" ? "Create an A record for '${var.domain_name}' pointing to ${google_compute_address.app_static_ip.address}" : "Set domain_name variable and re-apply to see DNS instructions"
}

output "app_env_vars" {
  description = "Environment variable block to paste into your .env or Docker Compose"
  sensitive   = true
  value       = <<-EOT
    DB_HOST=${google_sql_database_instance.postgres.private_ip_address}
    DB_PORT=5432
    DB_NAME=${var.db_name}
    DB_USER=${var.db_user}
    DB_PASSWORD=<set via TF_VAR_db_password>
    DATABASE_URL=postgresql://${var.db_user}:<password>@${google_sql_database_instance.postgres.private_ip_address}:5432/${var.db_name}
  EOT
}
