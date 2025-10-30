#!/bin/bash
# workers/r2-api-worker/cleanup-r2.sh
# Cleanup utility for R2 API Worker

set -e

# Parse command line arguments
MODE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --data-only)
            MODE="data"
            shift
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

echo "🧹 R2 API Worker - Cleanup Utility"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Interactive mode if no arguments
if [ -z "$MODE" ]; then
    echo "Choose cleanup level:"
    echo ""
    echo "  1) Data Only (soft reset)"
    echo "     • Delete all objects from R2 bucket"
    echo "     • Keep bucket and worker"
    echo "     → Quick reset for fresh data"
    echo ""
    echo "  2) Full Deletion"
    echo "     • Delete all objects"
    echo "     • Delete R2 bucket"
    echo "     • Delete worker"
    echo "     → Complete removal"
    echo ""
    read -p "Enter choice (1-2): " CHOICE
    
    case $CHOICE in
        1)
            MODE="data"
            ;;
        2)
            MODE="full"
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
fi

echo ""

# Get bucket name from wrangler.toml
BUCKET_NAME=$(grep "bucket_name" wrangler.toml | cut -d'"' -f2)
if [ -z "$BUCKET_NAME" ]; then
    BUCKET_NAME="media-library"
fi

# Level 1: Data Only
if [ "$MODE" = "data" ]; then
    echo "🗑️  Level 1: Clearing all data from bucket..."
    echo ""
    
    # Check if bucket exists
    BUCKET_EXISTS=$(wrangler r2 bucket list 2>&1 | grep "$BUCKET_NAME" || echo "")
    
    if [ -z "$BUCKET_EXISTS" ]; then
        echo "⚠️  Bucket '$BUCKET_NAME' not found"
        echo "Nothing to cleanup"
        exit 0
    fi
    
    # List objects
    echo "📊 Checking bucket contents..."
    OBJECT_LIST=$(wrangler r2 object list "$BUCKET_NAME" 2>&1 || echo "")
    
    if echo "$OBJECT_LIST" | grep -q "objects found: 0"; then
        echo "✓ Bucket is already empty"
    else
        # Delete all objects
        echo "Deleting all objects..."
        wrangler r2 object delete "$BUCKET_NAME" --all 2>&1 | grep -v "^$" || true
        echo "✓ All objects deleted"
    fi
    
    echo ""
    echo "✅ Data cleanup complete!"
    echo "Bucket and worker are still active"
fi

# Level 2: Full Deletion
if [ "$MODE" = "full" ]; then
    echo "⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️"
    echo ""
    echo "This will DELETE EVERYTHING:"
    echo "  • All objects in R2 bucket"
    echo "  • R2 bucket '$BUCKET_NAME'"
    echo "  • Worker deployment"
    echo ""
    echo "This action CANNOT be undone!"
    echo ""
    read -p "Type 'DELETE' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "DELETE" ]; then
        echo "❌ Aborted"
        exit 0
    fi
    
    echo ""
    echo "🗑️  Level 2: Full deletion..."
    echo ""
    
    # Check if bucket exists
    BUCKET_EXISTS=$(wrangler r2 bucket list 2>&1 | grep "$BUCKET_NAME" || echo "")
    
    if [ ! -z "$BUCKET_EXISTS" ]; then
        # Delete all objects first
        echo "🗄️  Deleting all objects..."
        OBJECT_LIST=$(wrangler r2 object list "$BUCKET_NAME" 2>&1 || echo "")
        
        if echo "$OBJECT_LIST" | grep -q "objects found: 0"; then
            echo "✓ Bucket already empty"
        else
            wrangler r2 object delete "$BUCKET_NAME" --all 2>&1 | grep -v "^$" || true
            echo "✓ All objects deleted"
        fi
        
        # Delete bucket
        echo "🗄️  Deleting R2 bucket..."
        wrangler r2 bucket delete "$BUCKET_NAME" 2>&1 | grep -v "^$" || true
        echo "✓ R2 bucket deleted"
    else
        echo "⚠️  Bucket '$BUCKET_NAME' not found (may be already deleted)"
    fi
    
    # Delete worker
    echo "🚀 Deleting worker..."
    wrangler delete r2-api-worker --force 2>&1 | grep -v "^$" || true
    echo "✓ Worker deleted"
    
    echo ""
    echo "✅ Full deletion complete!"
    echo ""
    echo "To redeploy: npm run setup"
fi

echo ""

