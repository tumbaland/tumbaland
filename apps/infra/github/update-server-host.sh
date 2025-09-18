#!/bin/bash

# Load environment variables from .env file
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

GITHUB_TOKEN=${GITHUB_TOKEN}
OWNER="toomastahves"
REPO="tumbaland"
VAR_NAME="SERVER_HOST"

# Get public IP
echo "Getting public IP..."
PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "Public IP: $PUBLIC_IP"

# Update GitHub repository variable
echo "Updating GitHub repository variable..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/$OWNER/$REPO/actions/variables/$VAR_NAME \
  -d "{\"name\":\"$VAR_NAME\",\"value\":\"$PUBLIC_IP\"}")

if [ "$RESPONSE" -eq 204 ]; then
  echo "Variable updated successfully!"
else
  echo "Failed to update variable. HTTP status: $RESPONSE"
  exit 1
fi
