# R2 API Worker (Optional Storage Backend)

**Status:** Optional feature - not required for core functionality

REST API for Cloudflare R2 object storage. Provides alternative to IndexedDB for server-side storage, cross-device sync, and team collaboration features.

## 🎯 Quick Start

### One-Command Setup
```bash
npm run setup
```

Creates R2 bucket, deploys worker, and verifies deployment in 1-2 minutes.

### One-Command Cleanup
```bash
npm run cleanup        # Interactive mode
npm run cleanup:full   # Delete everything
```

---

## 📊 Overview

### Default Behavior
**Media Library uses IndexedDB by default** - no R2 needed for:
- ✅ Single-user scanning
- ✅ Local-only workflows
- ✅ Privacy-focused deployments
- ✅ Avoiding cloud storage costs

### When to Use R2
Enable R2 for advanced features:
- ✅ Cross-device synchronization
- ✅ Team collaboration
- ✅ Server-side backup/export
- ✅ Enterprise deployments
- ✅ Centralized storage

### How to Enable
Add `storage="r2"` attribute to component:
```html
<media-library storage="r2"></media-library>
```

---

## 🛠️ Setup & Deployment

### Prerequisites
1. **Cloudflare Account** (Free tier works!)
2. **wrangler CLI**
   ```bash
   npm install -g wrangler
   ```
3. **Logged in**
   ```bash
   wrangler login
   ```

### Automated Setup (Recommended)
```bash
cd workers/r2-api-worker
npm run setup
```

The script will:
1. ✓ Create R2 bucket
2. ✓ Deploy worker
3. ✓ Test endpoints
4. ✓ Display worker URL

### Manual Setup
```bash
# 1. Create R2 bucket
wrangler r2 bucket create media-library

# 2. Install dependencies
npm install

# 3. Deploy worker
npm run deploy

# 4. Test
curl https://your-worker.workers.dev/api/health
```

---

## 🧹 Cleanup & Deletion

### Interactive Cleanup
```bash
npm run cleanup
```

Choose:
1. **Clear Data Only** - Empty bucket, keep infrastructure
2. **Full Deletion** - Delete bucket + worker

### Quick Commands
```bash
# Delete all data (keep bucket + worker)
npm run cleanup:data

# Delete everything (bucket + worker)
npm run cleanup:full
```

### Manual Cleanup
```bash
# List objects
wrangler r2 object list media-library

# Delete all objects
wrangler r2 object delete media-library --all

# Delete bucket
wrangler r2 bucket delete media-library

# Delete worker
wrangler delete r2-api-worker
```

---

## 🌐 API Endpoints

### POST `/api/save`
Save single media item.

**Request:**
```json
{
  "key": "site.com/image-hash.json",
  "data": { ...mediaItem }
}
```

### GET `/api/load`
Load single media item.

**Query:** `?key=site.com/image-hash.json`

### POST `/api/batch-save`
Save multiple media items.

**Request:**
```json
{
  "mode": "full",
  "mediaUsages": [
    { "hash": "abc123", "url": "image.jpg", ... }
  ]
}
```

### POST `/api/batch-load`
Load multiple media items.

**Request:**
```json
{
  "keys": ["site.com/hash1.json", "site.com/hash2.json"]
}
```

### POST `/api/delete`
Delete single media item.

**Request:**
```json
{
  "key": "site.com/image-hash.json"
}
```

### POST `/api/batch-delete`
Delete multiple media items.

**Request:**
```json
{
  "keys": ["site.com/hash1.json", "site.com/hash2.json"]
}
```

### GET `/api/list`
List all media items.

**Query:** `?prefix=site.com/`

---

## 💰 Cost & Free Tier

### R2 Free Tier (Per Month)
- ✅ **10 GB storage**
- ✅ **1 million Class A operations** (writes, lists)
- ✅ **10 million Class B operations** (reads)

### Typical Usage
- Single site scan: ~5-50 MB
- 100 sites: ~500 MB - 5 GB
- Still well under 10 GB limit

### Paid Pricing (If Exceeded)
- **Storage:** $0.015/GB per month
- **Class A:** $4.50 per million operations
- **Class B:** $0.36 per million operations

### No Egress Fees! 🎉
Unlike S3, R2 has **zero egress charges** when reading data.

---

## 🔧 Configuration

### Environment Variables
Update in `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGINS = "*"
MAX_UPLOAD_SIZE = "10485760"  # 10MB
```

### Bucket Name
Default: `media-library`

To change:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-custom-name"
```

---

## 🔗 Frontend Integration

### 1. Deploy R2 Worker
```bash
npm run setup
```

### 2. Update Frontend Component
```html
<media-library 
  storage="r2"
  r2-api-url="https://r2-api-worker.YOUR_ACCOUNT.workers.dev">
</media-library>
```

### 3. Verify Connection
Scan a page - data will be stored in R2 instead of IndexedDB.

---

## 🔄 Switching Storage Modes

### From IndexedDB to R2
1. Deploy R2 worker
2. Add `storage="r2"` attribute
3. Data stays in IndexedDB (not migrated)
4. New scans go to R2

### From R2 to IndexedDB
1. Remove `storage="r2"` attribute
2. Data stays in R2 (not migrated)
3. New scans go to IndexedDB

### Data Migration
Not automatic - use export/import features if needed.

---

## 🧪 Testing

### Health Check
```bash
curl https://your-worker.workers.dev/api/health
```

### Test Save
```bash
curl -X POST https://your-worker.workers.dev/api/save \
  -H "Content-Type: application/json" \
  -d '{
    "key": "test/image.json",
    "data": {
      "hash": "test123",
      "url": "image.jpg",
      "alt": "Test image"
    }
  }'
```

### Test Load
```bash
curl "https://your-worker.workers.dev/api/load?key=test/image.json"
```

### Test List
```bash
curl "https://your-worker.workers.dev/api/list?prefix=test/"
```

---

## 📊 Monitoring

```bash
# View logs
npm run tail

# Or
wrangler tail r2-api-worker
```

### Cloudflare Dashboard
1. Go to **R2** → **Overview**
2. View storage usage
3. View operation counts

---

## 🤔 When to Use R2 vs IndexedDB

### Use IndexedDB (Default) ✅
- Single-user scanning
- Privacy-focused (no cloud storage)
- Local-only workflows
- No internet dependency
- Free forever

### Use R2 💰
- Cross-device sync
- Team collaboration
- Backup/export features
- Centralized storage
- Enterprise deployments

---

## 🚨 Troubleshooting

### Error: "Bucket already exists"
```bash
# Use existing bucket
wrangler r2 bucket list

# Update bucket_name in wrangler.toml if needed
```

### Error: "Worker deployment failed"
```bash
# Check wrangler login
wrangler whoami

# Re-login if needed
wrangler login
```

### Error: "CORS error" in browser
Check `ALLOWED_ORIGINS` in `wrangler.toml` - should be `*` or your domain.

---

## 📖 Additional Resources

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [R2 Pricing](https://www.cloudflare.com/products/r2/)

---

**Ready to deploy!** 🚀

Run `npm run setup` to get started.

