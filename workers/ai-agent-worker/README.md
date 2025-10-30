# AI Agent Worker

Production-ready Cloudflare Worker for AI-powered media analysis using MCP tools, Workers AI, D1, Vectorize, and KV.

## 🚀 Quick Start (One Command!)

```bash
npm run setup
```

That's it! The script will:
- ✅ Create D1 database + apply schema
- ✅ Create KV namespace
- ✅ Create Vectorize index
- ✅ Update wrangler.toml automatically
- ✅ Deploy worker
- ✅ Verify deployment

**Time:** 2-3 minutes

---

## 📦 What's Included

### Core Features
- **MCP Tools**: 5 SQL-based query functions (metadata queries)
- **AI Query Handler**: LLM-powered query routing with tool orchestration
- **Deep Analysis**: On-demand HTML + image context extraction
- **Semantic Search**: Vector similarity search via Vectorize
- **Batch Indexing**: Chunked D1 inserts (handles >1000 items)
- **KV Caching**: 7-day cache for analysis results
- **Auto-Adaptive AI**: Automatically detects user intent (SEO, A11y, Developer, etc.)
- **Production-Grade Alt Text**: WCAG + SEO scoring with impact analysis

### Architecture
```
Browser Scan → IndexedDB (FREE)
     ↓
[Optional] Premium AI Indexing
     ↓
POST /api/ai/index-batch
     ↓
┌─────────────────────────────┐
│ AI Agent Worker             │
│ ├─ D1 (metadata storage)    │
│ ├─ Vectorize (embeddings)   │
│ └─ KV (caching)             │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│ Query Layer                 │
│ ├─ AI Query (broad search)  │
│ └─ Deep Analysis (per-item) │
└─────────────────────────────┘
```

### Modular Code Structure
```
workers/ai-agent-worker/
├── index.js (433 lines)          - Main orchestration
├── constants.js (28 lines)       - Shared constants
├── response-utils.js (42 lines)  - HTTP helpers
├── html-context.js (62 lines)    - HTML parsing
├── mcp-tools.js (176 lines)      - MCP tool implementations
├── ai-prompts.js (507 lines)     - AI prompts & scoring
├── schema.sql                    - D1 database schema
├── wrangler.toml                 - Cloudflare configuration
├── setup.sh                      - Automated setup
├── cleanup.sh                    - Automated cleanup
└── README.md                     - This file
```

---

## 📋 Prerequisites

1. **Node.js** (v18+)
2. **wrangler CLI**
   ```bash
   npm install -g wrangler
   ```
3. **Cloudflare Account** (Free tier works!)
4. **Logged in to wrangler**
   ```bash
   wrangler login
   ```

---

## 🛠️ Setup & Deployment

### Option 1: Automated Setup (Recommended)

```bash
# Clone and navigate
cd workers/ai-agent-worker

# Run setup (creates everything automatically)
npm run setup
```

The script will prompt you for:
- CORS Proxy URL (optional, can use default)

### Option 2: Manual Setup

If you prefer manual control:

```bash
# 1. Install dependencies
npm install

# 2. Create D1 database
wrangler d1 create media-library-db
# Copy database_id to wrangler.toml

# 3. Apply schema
wrangler d1 execute media-library-db --file=schema.sql

# 4. Create KV namespace
wrangler kv:namespace create CACHE
# Copy id to wrangler.toml

# 5. Create Vectorize index
wrangler vectorize create media-embeddings --dimensions=768 --metric=cosine

# 6. Deploy
npm run deploy
```

---

## 🧹 Cleanup & Data Management

### Quick Cleanup Commands

```bash
# Interactive mode (choose level)
npm run cleanup

# Clear all data (keep resources)
npm run cleanup:data

# Remove specific site data
npm run cleanup:site
# Will prompt for site_key (e.g., example.com)

# Full teardown (delete everything)
npm run cleanup:full
# WARNING: Deletes worker, D1, KV, Vectorize
```

### Cleanup Levels

**Level 1: Data Only** (Soft Reset)
- Clears D1 tables
- Clears KV cache
- Clears Vectorize vectors
- Keeps resources intact
- → Quick reset for new site scan

**Level 2: Site-Specific**
- Removes data for one site
- Keeps other sites' data
- Perfect for multi-site management
- → Switch between different sites

**Level 3: Full Teardown**
- Deletes worker
- Deletes D1 database
- Deletes KV namespace
- Deletes Vectorize index
- → Complete removal

### Multi-Site Workflow

```bash
# Deploy once
npm run setup

# Scan Site A
# ... use for a while ...

# Switch to Site B
npm run cleanup:site
# Enter: siteA.com

# Scan Site B
# ... use for a while ...

# Quick reset for testing
npm run cleanup:data
```

---

## 🌐 API Endpoints

### POST `/api/ai/query`
AI-powered queries with MCP tools.

**Request:**
```json
{
  "query": "Which images are missing alt text?",
  "siteKey": "example.com"
}
```

**Response:**
```json
{
  "query": "...",
  "tool": "getImagesWithoutAlt",
  "data": [...],
  "message": "Found 47 images without alt text",
  "count": 47,
  "suggestedActions": [...]
}
```

### POST `/api/ai/analyze`
Deep analysis of specific image occurrence.

**Request:**
```json
{
  "imageUrl": "hero.jpg",
  "pageUrl": "https://example.com/about",
  "occurrence": 0,
  "siteKey": "example.com"
}
```

**Response:**
```json
{
  "suggestedAlt": "Team collaborating in modern office",
  "reasoning": "...",
  "wcagCompliance": "1.1.1",
  "type": "informative",
  "keywords": ["team", "office", "collaboration"],
  "confidence": 0.9,
  "impact": {
    "seo": { "current": 20, "suggested": 85, "improvement": 65 },
    "a11y": { "current": 0, "suggested": 95, "improvement": 95 }
  },
  "pageContext": {...},
  "occurrence": 0,
  "totalOccurrences": 1
}
```

### POST `/api/ai/semantic-search`
Vector similarity search.

### POST `/api/ai/index-batch`
Batch index media metadata.

### GET `/api/suggested-questions`
Get categorized suggested questions.

### GET `/api/health`
Health check endpoint.

---

## 🆓 Free Tier Compatibility

All features work on Cloudflare Free tier:
- ✅ **Workers AI**: 10K neurons/day
- ✅ **D1**: 5M reads, 100K writes/day
- ✅ **Vectorize**: 30M vectors/month
- ✅ **KV**: 100K reads, 1K writes/day

Perfect for testing and small-scale production!

---

## 🧪 Testing

### Health Check
```bash
curl https://your-worker.workers.dev/api/health
```

### Test Indexing
```bash
curl -X POST https://your-worker.workers.dev/api/ai/index-batch \
  -H "Content-Type: application/json" \
  -d '{
    "siteKey": "example.com",
    "batch": [{
      "hash": "test123",
      "url": "test.jpg",
      "doc": "page.html",
      "alt": "Test image",
      "width": 1920,
      "height": 1080
    }]
  }'
```

### Local Development
```bash
npm run dev
```

### View Logs
```bash
npm run tail
```

---

## 🔒 Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
CORS_PROXY_URL = "https://your-cors-proxy.workers.dev"
MAX_BATCH_SIZE = "500"
CACHE_TTL_SECONDS = "604800"  # 7 days
```

### Using wrangler.toml.example

For new deployments or sharing the codebase:

```bash
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your account_id
npm run setup
```

---

## 📊 Monitoring

```bash
# Real-time logs
npm run tail

# Cloudflare Dashboard
# → Workers & Pages → medialibrary-ai → Metrics
```

---

## 🚀 Frontend Integration

After deployment, update your frontend `.env`:

```env
VITE_AI_ENABLED=true
VITE_AI_WORKER_URL=https://medialibrary-ai.YOUR_ACCOUNT.workers.dev
VITE_AI_API_KEY=  # Optional
```

Then rebuild the frontend:
```bash
cd ../..  # Back to project root
npm run build:ai
```

---

## 💡 Key Features

### 1. Auto-Adaptive AI
No manual persona selection needed. The AI automatically detects if the user is asking about:
- SEO optimization
- Accessibility compliance
- Developer implementation
- Content quality
- Site administration

### 2. Production-Grade Alt Text
- WCAG 1.1.1 compliance analysis
- SEO scoring (0-100)
- A11y scoring (0-100)
- Impact calculation (current vs suggested)
- Keyword extraction from page context

### 3. Multi-Site Support
- Site-specific data isolation (via `site_key`)
- Easy cleanup of individual sites
- Stays within free tier limits

### 4. Smart Caching
- KV cache for deep analysis (7 days)
- Reduces AI API calls
- Cost-effective

---

## 🛠️ Troubleshooting

### Error: "Database not found"
```bash
# List databases
wrangler d1 list

# Verify ID in wrangler.toml matches
```

### Error: "KV namespace not found"
```bash
# List KV namespaces
wrangler kv:namespace list

# Verify ID in wrangler.toml matches
```

### Error: "Not logged in"
```bash
wrangler login
```

### Setup Script Fails
1. Check `wrangler whoami` works
2. Check you have permissions in Cloudflare account
3. Try manual setup instead

---

## 📝 Code Quality

- ✅ Modular structure (6 focused modules)
- ✅ DRY principles applied
- ✅ Registry patterns for tools and routes
- ✅ Centralized response utilities
- ✅ Comprehensive error handling
- ✅ Production-ready code

---

## 🎯 What's Next

1. Run `npm run setup`
2. Update frontend `.env` with worker URL
3. Build frontend with `npm run build:ai`
4. Start scanning sites!
5. Monitor usage in Cloudflare dashboard

---

## 📖 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [KV Storage Docs](https://developers.cloudflare.com/kv/)

---

**Ready for production! 🎯**
