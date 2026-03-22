#!/bin/sh
set -e
apk add --no-cache curl jq > /dev/null

echo "Authenticating admin..."
RES=$(curl -s -X POST -d "username=admin&password=admin" http://backend:8000/api/v1/auth/token)
TOKEN=$(echo $RES | jq -r .access_token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "Login failed: $RES"
    exit 1
fi

echo "Uploading chunk via Single-Click Pipeline..."
START=$(date +%s)
UPLOAD_RES=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -F "topic_title=Culinary Arts" \
    -F "file=@/mock/pumpkin_pie.pdf" \
    http://backend:8000/api/v1/admin/upload)
END=$(date +%s)

echo "Result: $UPLOAD_RES"
echo "Total Time: $((END - START)) seconds"
