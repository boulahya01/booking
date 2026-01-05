#!/bin/bash

# Deploy available-slots function using Supabase Management API

PROJECT_REF="mismymbsavogkuovfyvj"
FUNCTION_NAME="available-slots"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:?Error: SUPABASE_ACCESS_TOKEN not set}"

# Read the function code
FUNCTION_CODE=$(cat supabase/functions/available-slots/index.ts)

# Prepare the payload
cat > /tmp/deploy_payload.json << EOF
{
  "name": "$FUNCTION_NAME",
  "slug": "$FUNCTION_NAME",
  "body": $(echo "$FUNCTION_CODE" | jq -R -s .)
}
EOF

echo "Deploying function: $FUNCTION_NAME"

# Call the API
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/deploy_payload.json \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/$FUNCTION_NAME" \
  2>&1

echo ""
echo "Deployment request sent. Check your Supabase dashboard."
