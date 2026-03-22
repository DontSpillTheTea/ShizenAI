#!/bin/bash
# ShizenAI VM startup script — bootstraps Docker + Docker Compose and runs the app.
# This script is rendered by Terraform and injected as the instance's startup script.
# It runs once on first boot and again on manual restart.
#
# Template variables injected by Terraform:
#   ${environment}  ${db_host}  ${db_port}  ${db_name}
#   ${db_user}      ${db_password}  ${app_port}

set -euo pipefail
LOG="/var/log/shizen-startup.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== ShizenAI startup: $(date) ==="
echo "Environment: ${environment}"

# ── 1. System packages ────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  nginx

# ── 2. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
fi

# ── 3. Write environment file ─────────────────────────────────────────────────
# Used by docker compose and/or the app process directly.
cat > /opt/shizen/.env <<ENV
ENVIRONMENT=${environment}
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
DATABASE_URL=postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}
APP_PORT=${app_port}
ENV

chmod 600 /opt/shizen/.env

# ── 4. Clone / update app ────────────────────────────────────────────────────
# Replace the repo URL with your own. If using a private repo, set up deploy keys.
REPO_URL="https://github.com/DontSpillTheTea/ShizenAI.git"
APP_DIR="/opt/shizen/app"

mkdir -p /opt/shizen

if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing repo..."
  git -C "$APP_DIR" pull
else
  echo "Cloning repo..."
  git clone "$REPO_URL" "$APP_DIR"
fi

# Copy env file into repo root for Docker Compose to pick up
cp /opt/shizen/.env "$APP_DIR/.env"

# ── 5. Run with Docker Compose ────────────────────────────────────────────────
cd "$APP_DIR"
docker compose pull
docker compose up -d --remove-orphans

echo "=== Startup complete: $(date) ==="
