#!/bin/bash
# ShizenAI VM startup script for GCE.
# Terraform template variables used:
# - environment, db_host, db_port, db_name, db_user, db_password
# - perplexity_api_key, elevenlabs_api_key
# - app_port

set -euo pipefail
LOG="/var/log/shizen-startup.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== ShizenAI startup: $(date -Iseconds) ==="
echo "Environment: ${environment}"

mkdir -p /opt/shizen

echo "[1/7] Installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git

echo "[2/7] Installing Docker if needed..."
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

echo "[3/7] Resolving instance public IP..."
VM_IP="$(curl -fsS -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip")"

echo "[4/7] Writing runtime environment..."
cat > /opt/shizen/.env <<ENV
ENVIRONMENT=${environment}
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
DATABASE_URL=postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}
PERPLEXITY_API_KEY=${perplexity_api_key}
ELEVENLABS_API_KEY=${elevenlabs_api_key}
APP_PORT=${app_port}
VITE_API_URL=http://$${VM_IP}:8000
ENV
chmod 600 /opt/shizen/.env

echo "[5/7] Cloning or updating repository..."
REPO_URL="https://github.com/DontSpillTheTea/ShizenAI.git"
APP_DIR="/opt/shizen/app"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi
cp /opt/shizen/.env "$APP_DIR/.env"

# Ensure frontend uses the VM public IP for backend calls.
sed -i "s|VITE_API_URL=http://localhost:8000|VITE_API_URL=http://$${VM_IP}:8000|g" "$APP_DIR/docker-compose.yml" || true
echo "[6/7] Ensuring external Docker volumes..."
docker volume create shizen_pg_data >/dev/null 2>&1 || true

echo "[7/7] Starting Docker services..."
cd "$APP_DIR"
docker compose up -d --build --remove-orphans

echo "Waiting for containers to become healthy..."
for i in $(seq 1 30); do
  if docker compose ps --status running --services | grep -Eq "^(backend|frontend)$"; then
    echo "Containers are running."
    break
  fi
  echo "Attempt $i/30: waiting 10s..."
  sleep 10
done

echo "=== Startup complete: $(date -Iseconds) ==="
