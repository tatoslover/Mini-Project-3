# Netlify Environment Variables Setup

## Required Environment Variables for Barkend Deployment

When deploying to Netlify, you need to set these environment variables in your site settings:

### 1. Go to Netlify Dashboard
- Navigate to your site
- Go to **Site settings** → **Environment variables**
- Click **Add a variable** for each of the following:

### 2. Required Variables

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio` | MongoDB Atlas connection string |
| `NODE_ENV` | `production` | Environment setting |
| `DOG_API_BASE` | `https://dog.ceo/api` | Base URL for Dog CEO API |
| `DEPLOY_TIME` | `1640995200000` | Deployment timestamp (update with current time) |
| `ENABLE_ANALYTICS` | `true` | Enable analytics tracking |
| `LOG_LEVEL` | `info` | Logging level |

### 3. Optional Variables (for enhanced functionality)

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `API_RATE_LIMIT` | `100` | API rate limit per minute |
| `CACHE_TTL` | `3600` | Cache time-to-live in seconds |
| `DEBUG_MODE` | `false` | Enable debug logging |

### 4. How to Add Variables in Netlify

1. **Via Netlify UI:**
   - Site settings → Environment variables
   - Click "Add a variable"
   - Enter Name and Value
   - Click "Create variable"

2. **Via Netlify CLI:**
   ```bash
   netlify env:set MONGODB_URI "mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio"
   netlify env:set NODE_ENV "production"
   netlify env:set DOG_API_BASE "https://dog.ceo/api"
   netlify env:set DEPLOY_TIME "$(date +%s)000"
   netlify env:set ENABLE_ANALYTICS "true"
   netlify env:set LOG_LEVEL "info"
   ```

### 5. Verify Environment Variables

After setting up, you can verify by checking:
- Netlify UI: Site settings → Environment variables
- CLI: `netlify env:list`
- Test endpoint: `https://your-site.netlify.app/.netlify/functions/health`

### 6. Security Notes

⚠️ **Important Security Considerations:**
- Never commit `.env` files to version control
- Use different credentials for development and production
- Regularly rotate MongoDB credentials
- Consider using MongoDB Atlas IP whitelisting in production

### 7. Local Development

For local development, create a `.env` file in your project root:

```env
MONGODB_URI=mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio
NODE_ENV=development
DOG_API_BASE=https://dog.ceo/api
DEPLOY_TIME=1640995200000
ENABLE_ANALYTICS=true
LOG_LEVEL=debug
```

### 8. Testing Your Setup

Once variables are set, test your deployment:

```bash
# Test health endpoint
curl https://your-site.netlify.app/.netlify/functions/health

# Expected response should include database connection status
```

### 9. Common Issues

**Environment Variable Not Found:**
- Check spelling and case sensitivity
- Redeploy after adding variables
- Clear browser cache

**MongoDB Connection Failed:**
- Verify MONGODB_URI is correct
- Check IP whitelist in Atlas
- Ensure database user has proper permissions

**Function Timeout:**
- Check MongoDB connection options
- Verify Atlas cluster is active
- Consider connection pooling optimization