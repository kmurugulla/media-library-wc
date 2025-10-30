#!/bin/bash
# workers/ai-agent-worker/cleanup.sh
# Cleanup utility for AI Agent Worker

set -e

# Parse command line arguments
MODE=""
SITE_KEY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --data-only)
            MODE="data"
            shift
            ;;
        --site)
            MODE="site"
            SITE_KEY="$2"
            shift 2
            ;;
        --full)
            MODE="full"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo "🧹 AI Agent Worker - Cleanup Utility"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Interactive mode if no arguments
if [ -z "$MODE" ]; then
    echo "Choose cleanup level:"
    echo ""
    echo "  1) Data Only (soft reset)"
    echo "     • Clear all D1 data"
    echo "     • Clear KV cache"
    echo "     • Clear Vectorize vectors"
    echo "     • Keep resources intact"
    echo "     → Quick reset for new site scan"
    echo ""
    echo "  2) Site-Specific Data"
    echo "     • Remove data for one site"
    echo "     • Keep other sites' data"
    echo "     • Keep all resources"
    echo "     → Multi-site management"
    echo ""
    echo "  3) Full Teardown (nuclear)"
    echo "     • Delete worker"
    echo "     • Delete D1 database"
    echo "     • Delete KV namespace"
    echo "     • Delete Vectorize index"
    echo "     → Complete removal"
    echo ""
    read -p "Enter choice (1-3): " CHOICE
    
    case $CHOICE in
        1)
            MODE="data"
            ;;
        2)
            MODE="site"
            read -p "Enter site_key to remove (e.g., example.com): " SITE_KEY
            ;;
        3)
            MODE="full"
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
fi

echo ""

# Get resource IDs from wrangler.toml
DB_ID=$(grep "database_id" wrangler.toml | grep -o '"[^"]*"' | tr -d '"' | grep -v "TO_BE_CREATED" | head -1)
KV_ID=$(grep "^id = " wrangler.toml | grep -o '"[^"]*"' | tr -d '"' | grep -v "TO_BE_CREATED" | head -1)

# Level 1: Data Only
if [ "$MODE" = "data" ]; then
    echo "🗑️  Level 1: Clearing all data..."
    echo ""
    
    # Clear D1 data
    if [ ! -z "$DB_ID" ]; then
        echo "📊 Clearing D1 database..."
        wrangler d1 execute media-library-db --command "DELETE FROM media" 2>&1 | grep -v "^$" || true
        echo "✓ D1 data cleared"
    else
        echo "⚠️  No database ID found in wrangler.toml"
    fi
    
    # Clear KV cache
    if [ ! -z "$KV_ID" ]; then
        echo "🔑 Clearing KV cache..."
        KV_KEYS=$(wrangler kv:key list --namespace-id "$KV_ID" 2>&1 | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        
        if [ ! -z "$KV_KEYS" ]; then
            echo "$KV_KEYS" | while read key; do
                if [ ! -z "$key" ]; then
                    wrangler kv:key delete --namespace-id "$KV_ID" "$key" 2>&1 | grep -v "^$" || true
                fi
            done
            echo "✓ KV cache cleared"
        else
            echo "✓ KV cache already empty"
        fi
    else
        echo "⚠️  No KV namespace ID found in wrangler.toml"
    fi
    
    # Vectorize cleanup (recreate index)
    echo "🔍 Clearing Vectorize index..."
    echo "⚠️  Note: Vectorize doesn't support bulk delete"
    echo "   Recommended: Delete and recreate index manually:"
    echo "   $ wrangler vectorize delete media-embeddings"
    echo "   $ wrangler vectorize create media-embeddings --dimensions=768 --metric=cosine"
    
    echo ""
    echo "✅ Data cleanup complete!"
    echo "Ready for fresh scan"
fi

# Level 2: Site-Specific Data
if [ "$MODE" = "site" ]; then
    if [ -z "$SITE_KEY" ]; then
        echo "❌ No site_key provided"
        echo "Usage: ./cleanup.sh --site example.com"
        exit 1
    fi
    
    echo "🗑️  Level 2: Removing data for site: $SITE_KEY"
    echo ""
    
    # Delete site-specific D1 data
    if [ ! -z "$DB_ID" ]; then
        echo "📊 Removing D1 data for $SITE_KEY..."
        wrangler d1 execute media-library-db --command "DELETE FROM media WHERE site_key = '$SITE_KEY'" 2>&1 | grep -v "^$" || true
        
        # Count remaining rows
        COUNT=$(wrangler d1 execute media-library-db --command "SELECT COUNT(*) as count FROM media" --json 2>&1 | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
        echo "✓ Site data removed ($COUNT rows remaining)"
    else
        echo "⚠️  No database ID found"
    fi
    
    # Clear site-specific KV cache
    if [ ! -z "$KV_ID" ]; then
        echo "🔑 Clearing KV cache for $SITE_KEY..."
        # Cache keys format: analysis:SITE_KEY:*
        KV_KEYS=$(wrangler kv:key list --namespace-id "$KV_ID" 2>&1 | grep "$SITE_KEY" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        
        if [ ! -z "$KV_KEYS" ]; then
            echo "$KV_KEYS" | while read key; do
                if [ ! -z "$key" ]; then
                    wrangler kv:key delete --namespace-id "$KV_ID" "$key" 2>&1 | grep -v "^$" || true
                fi
            done
            echo "✓ Site cache cleared"
        else
            echo "✓ No cache entries found for $SITE_KEY"
        fi
    fi
    
    echo ""
    echo "✅ Site cleanup complete!"
    echo "Data for '$SITE_KEY' removed"
fi

# Level 3: Full Teardown
if [ "$MODE" = "full" ]; then
    echo "⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️"
    echo ""
    echo "This will DELETE EVERYTHING:"
    echo "  • Worker deployment"
    echo "  • D1 database (all data)"
    echo "  • KV namespace (all cache)"
    echo "  • Vectorize index (all vectors)"
    echo ""
    echo "This action CANNOT be undone!"
    echo ""
    read -p "Type 'DELETE' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "DELETE" ]; then
        echo "❌ Aborted"
        exit 0
    fi
    
    echo ""
    echo "🗑️  Level 3: Full teardown..."
    echo ""
    
    # Delete worker
    echo "🚀 Deleting worker..."
    wrangler delete medialibrary-ai --force 2>&1 | grep -v "^$" || true
    echo "✓ Worker deleted"
    
    # Delete D1 database
    if [ ! -z "$DB_ID" ]; then
        echo "🗄️  Deleting D1 database..."
        wrangler d1 delete media-library-db --force 2>&1 | grep -v "^$" || true
        echo "✓ D1 database deleted"
    fi
    
    # Delete KV namespace
    if [ ! -z "$KV_ID" ]; then
        echo "🔑 Deleting KV namespace..."
        wrangler kv:namespace delete --namespace-id "$KV_ID" --force 2>&1 | grep -v "^$" || true
        echo "✓ KV namespace deleted"
    fi
    
    # Delete Vectorize index
    echo "🔍 Deleting Vectorize index..."
    wrangler vectorize delete media-embeddings 2>&1 | grep -v "^$" || true
    echo "✓ Vectorize index deleted"
    
    # Reset wrangler.toml
    echo "📝 Resetting wrangler.toml..."
    sed -i.bak 's/database_id = "[^"]*"/database_id = "TO_BE_CREATED"/' wrangler.toml
    sed -i.bak 's/^id = "[a-f0-9-]*"/id = "TO_BE_CREATED"/' wrangler.toml
    rm wrangler.toml.bak
    echo "✓ wrangler.toml reset"
    
    echo ""
    echo "✅ Full teardown complete!"
    echo ""
    echo "To redeploy: npm run setup"
fi

echo ""

