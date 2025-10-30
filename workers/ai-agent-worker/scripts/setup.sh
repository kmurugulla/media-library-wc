#!/bin/bash
# workers/ai-agent-worker/setup.sh
# Automated setup script for AI Agent Worker

set -e

echo "🚀 AI Agent Worker - Automated Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI not found"
    echo "Install: npm install -g wrangler"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

echo "✓ wrangler CLI found"
echo "✓ Node.js found"
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

# Try multiple patterns to extract Account ID (table format or inline format)
ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | grep -oE '[a-f0-9]{32}' | head -1)
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

# Create D1 database
echo "🗄️  Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create media-library-db 2>&1 || echo "")

if echo "$DB_OUTPUT" | grep -q "already exists"; then
    echo "⚠️  Database 'media-library-db' already exists"
    # Try to get existing database ID
    DB_LIST=$(wrangler d1 list 2>&1 || echo "")
    DB_ID=$(echo "$DB_LIST" | grep "media-library-db" | grep -o '[a-f0-9-]\{36\}' | head -1)
    if [ -z "$DB_ID" ]; then
        echo "❌ Could not find existing database ID"
        echo "Please check: wrangler d1 list"
        exit 1
    fi
    echo "✓ Using existing database: $DB_ID"
else
    DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    if [ -z "$DB_ID" ]; then
        echo "❌ Failed to create D1 database"
        echo "$DB_OUTPUT"
        exit 1
    fi
    echo "✓ Created database: $DB_ID"
fi
echo ""

# Update wrangler.toml with database ID and account ID
echo "📝 Updating wrangler.toml..."
if [ -f "wrangler.toml.bak" ]; then
    rm wrangler.toml.bak
fi

# Update account_id
sed -i.bak "s/account_id = \".*\"/account_id = \"$ACCOUNT_ID\"/" wrangler.toml

# Update database_id
sed -i.bak "s/database_id = \"TO_BE_CREATED\"/database_id = \"$DB_ID\"/" wrangler.toml
sed -i.bak "s/database_id = \"[a-f0-9-]\{36\}\"/database_id = \"$DB_ID\"/" wrangler.toml

rm wrangler.toml.bak
echo "✓ wrangler.toml updated"
echo ""

# Apply database schema
echo "📋 Applying database schema..."
SCHEMA_OUTPUT=$(wrangler d1 execute media-library-db --file=db/schema.sql 2>&1 || echo "")
if echo "$SCHEMA_OUTPUT" | grep -q "error"; then
    echo "⚠️  Schema may already exist or error occurred"
else
    echo "✓ Schema applied"
fi
echo ""

# Create KV namespace
echo "🔑 Creating KV namespace..."
KV_OUTPUT=$(wrangler kv namespace create CACHE 2>&1 || echo "")

if echo "$KV_OUTPUT" | grep -q "already exists"; then
    echo "⚠️  KV namespace 'CACHE' already exists"
    # Try to get existing KV ID
    KV_LIST=$(wrangler kv namespace list 2>&1 || echo "")
    KV_ID=$(echo "$KV_LIST" | grep "CACHE" | grep -oE '[a-f0-9]{32}' | head -1)
    if [ -z "$KV_ID" ]; then
        echo "❌ Could not find existing KV namespace ID"
        echo "Please check: wrangler kv namespace list"
        exit 1
    fi
    echo "✓ Using existing KV: $KV_ID"
else
    KV_ID=$(echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}' | head -1)
    if [ -z "$KV_ID" ]; then
        echo "❌ Failed to create KV namespace"
        echo "$KV_OUTPUT"
        exit 1
    fi
    echo "✓ Created KV namespace: $KV_ID"
fi
echo ""

# Update wrangler.toml with KV ID (only in kv_namespaces section)
echo "📝 Updating KV namespace ID..."
sed -i.bak "/\[\[kv_namespaces\]\]/,/^$/s/id = \"TO_BE_CREATED\"/id = \"$KV_ID\"/" wrangler.toml
sed -i.bak "/\[\[kv_namespaces\]\]/,/^$/s/id = \"[a-f0-9]\{32\}\"/id = \"$KV_ID\"/" wrangler.toml
rm wrangler.toml.bak
echo "✓ KV namespace ID updated"
echo ""

# Create Vectorize index
echo "🔍 Creating Vectorize index..."
VEC_OUTPUT=$(wrangler vectorize create media-embeddings --dimensions=768 --metric=cosine 2>&1 || echo "")

if echo "$VEC_OUTPUT" | grep -q "already exists"; then
    echo "⚠️  Vectorize index 'media-embeddings' already exists"
    echo "✓ Using existing index"
else
    if echo "$VEC_OUTPUT" | grep -q "Created"; then
        echo "✓ Vectorize index created"
    else
        echo "❌ Failed to create Vectorize index"
        echo "$VEC_OUTPUT"
        exit 1
    fi
fi
echo ""

# Optional: Configure CORS proxy
echo "🌐 CORS Proxy Configuration"
read -p "Enter CORS Proxy URL (or press Enter to keep default): " CORS_URL
if [ ! -z "$CORS_URL" ]; then
    sed -i.bak "s|CORS_PROXY_URL = \".*\"|CORS_PROXY_URL = \"$CORS_URL\"|" wrangler.toml
    rm wrangler.toml.bak
    echo "✓ CORS Proxy URL updated: $CORS_URL"
else
    echo "✓ Using default CORS Proxy URL"
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
        HEALTH_CHECK=$(curl -s "${WORKER_URL}/api/health" 2>&1 || echo "{}")
        
        if echo "$HEALTH_CHECK" | grep -q "\"status\":\"ok\""; then
            echo "✓ Health check passed!"
        else
            echo "⚠️  Health check failed, but worker is deployed"
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
echo "  • Worker: medialibrary-ai"
echo "  • D1 Database: $DB_ID"
echo "  • KV Namespace: $KV_ID"
echo "  • Vectorize Index: media-embeddings"
echo ""
if [ ! -z "$WORKER_URL" ]; then
    echo "🌐 Worker URL:"
    echo "  $WORKER_URL"
    echo ""
    echo "🧪 Test Endpoints:"
    echo "  curl ${WORKER_URL}/api/health"
    echo "  curl ${WORKER_URL}/api/suggested-questions"
    echo ""
fi
echo "📖 Next Steps:"
echo "  1. Update frontend .env with worker URL"
echo "  2. Run npm run build:ai in frontend"
echo "  3. Start scanning sites!"
echo ""
echo "🧹 To cleanup data: npm run cleanup"
echo ""

