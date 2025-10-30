#!/bin/bash
# workers/r2-api-worker/setup-r2.sh
# Automated setup script for R2 API Worker

set -e

echo "🚀 R2 API Worker - Automated Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI not found"
    echo "Install: npm install -g wrangler"
    exit 1
fi

echo "✓ wrangler CLI found"
echo ""

# Check if logged in
echo "🔑 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi

ACCOUNT_INFO=$(wrangler whoami 2>/dev/null || echo "")
if [ -z "$ACCOUNT_INFO" ]; then
    echo "❌ Could not get account info"
    exit 1
fi

ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | grep -o 'Account ID: [a-f0-9]*' | cut -d' ' -f3)
if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Could not detect Account ID"
    exit 1
fi

echo "✓ Logged in to Cloudflare"
echo "✓ Account ID: $ACCOUNT_ID"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Get bucket name from wrangler.toml
BUCKET_NAME=$(grep "bucket_name" wrangler.toml | cut -d'"' -f2)
if [ -z "$BUCKET_NAME" ]; then
    BUCKET_NAME="media-library"
    echo "⚠️  No bucket_name found in wrangler.toml, using default: $BUCKET_NAME"
fi

# Create R2 bucket
echo "🗄️  Creating R2 bucket: $BUCKET_NAME..."
BUCKET_OUTPUT=$(wrangler r2 bucket create "$BUCKET_NAME" 2>&1 || echo "")

if echo "$BUCKET_OUTPUT" | grep -q "already exists"; then
    echo "⚠️  Bucket '$BUCKET_NAME' already exists"
    echo "✓ Using existing bucket"
elif echo "$BUCKET_OUTPUT" | grep -q "Created bucket"; then
    echo "✓ Created bucket: $BUCKET_NAME"
else
    # Check if bucket exists
    BUCKET_LIST=$(wrangler r2 bucket list 2>&1 | grep "$BUCKET_NAME" || echo "")
    if [ ! -z "$BUCKET_LIST" ]; then
        echo "✓ Bucket '$BUCKET_NAME' exists"
    else
        echo "❌ Failed to create R2 bucket"
        echo "$BUCKET_OUTPUT"
        exit 1
    fi
fi
echo ""

# Deploy worker
echo "🚀 Deploying worker..."
DEPLOY_OUTPUT=$(npm run deploy 2>&1 || echo "")

if echo "$DEPLOY_OUTPUT" | grep -q "Published"; then
    WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*' | head -1)
    echo "✓ Worker deployed successfully!"
    echo ""
    
    # Verify deployment
    if [ ! -z "$WORKER_URL" ]; then
        echo "🔍 Verifying deployment..."
        sleep 2
        
        # Test health endpoint (if it exists, otherwise just test root)
        TEST_URL="${WORKER_URL}"
        if curl -s "${TEST_URL}" &> /dev/null; then
            echo "✓ Worker is responding!"
        else
            echo "⚠️  Worker deployed but not responding yet (may take a moment)"
        fi
    fi
else
    echo "❌ Deployment failed"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Resources Created:"
echo "  • Worker: r2-api-worker"
echo "  • R2 Bucket: $BUCKET_NAME"
echo ""
if [ ! -z "$WORKER_URL" ]; then
    echo "🌐 Worker URL:"
    echo "  $WORKER_URL"
    echo ""
    echo "🧪 Test Endpoints:"
    echo "  curl -X POST ${WORKER_URL}/api/save \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"key\":\"test.json\",\"data\":{\"test\":true}}'"
    echo ""
    echo "  curl '${WORKER_URL}/api/list'"
    echo ""
fi
echo "📖 Frontend Integration:"
echo "  <media-library"
echo "    storage=\"r2\""
echo "    r2-api-url=\"$WORKER_URL\">"
echo "  </media-library>"
echo ""
echo "🧹 To cleanup: npm run cleanup"
echo ""

