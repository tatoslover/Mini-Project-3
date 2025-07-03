# PupHub API - MongoDB Atlas & Netlify Deployment Guide

🚀 Complete guide to deploy PupHub API using MongoDB Atlas for database and Netlify for hosting.

## 📋 Prerequisites

- Node.js 18+ installed locally
- Git repository for your project
- MongoDB Atlas account
- Netlify account
- Basic understanding of environment variables

## 🗄️ MongoDB Atlas Setup

### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a new organization (optional)

### Step 2: Create a Cluster
1. Click "Build a Database"
2. Choose **M0 Sandbox** (Free tier)
3. Select your preferred cloud provider and region
4. Name your cluster (e.g., `puphub-cluster`)
5. Click "Create Cluster"

### Step 3: Configure Database Access
1. Go to **Database Access** in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and strong password
5. Set user privileges to "Read and write to any database"
6. Click "Add User"

### Step 4: Configure Network Access
1. Go to **Network Access** in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - For production, restrict to specific IPs
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to **Database** → **Connect**
2. Choose "Connect your application"
3. Select "Node.js" and version "4.1 or later"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `puphub`

Example connection string:
```
mongodb+srv://puphub_user:yourpassword@puphub-cluster.abc123.mongodb.net/puphub?retryWrites=true&w=majority
```

## 🌐 Netlify Deployment

### Step 1: Prepare Your Repository
1. Ensure your code is in a Git repository
2. Push all changes to GitHub/GitLab/Bitbucket

### Step 2: Connect to Netlify
1. Go to [Netlify](https://www.netlify.com/)
2. Sign up/login with your Git provider
3. Click "New site from Git"
4. Choose your Git provider
5. Select your PupHub repository

### Step 3: Configure Build Settings
**Build Settings:**
- **Build command:** `npm run build`
- **Publish directory:** `frontend`
- **Functions directory:** `netlify/functions`

### Step 4: Set Environment Variables
1. Go to **Site settings** → **Environment variables**
2. Add the following variables:

| Variable | Value | Example |
|----------|-------|---------|
| `MONGODB_URI` | Your Atlas connection string | `mongodb+srv://user:pass@cluster.net/puphub` |
| `NODE_ENV` | `production` | `production` |
| `DOG_API_BASE` | `https://dog.ceo/api` | `https://dog.ceo/api` |
| `DEPLOY_TIME` | Current timestamp | `1640995200000` |
| `ENABLE_ANALYTICS` | `true` | `true` |
| `LOG_LEVEL` | `info` | `info` |

### Step 5: Deploy
1. Click "Deploy site"
2. Wait for deployment to complete
3. Your site will be available at a Netlify URL (e.g., `amazing-app-123456.netlify.app`)

## 🔧 Local Development Setup

### Step 1: Clone and Install
```bash
git clone <your-repo-url>
cd Mini-Project-3
npm install
```

### Step 2: Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your MongoDB Atlas credentials
nano .env
```

### Step 3: Install Netlify CLI
```bash
npm install -g netlify-cli
netlify login
```

### Step 4: Local Development
```bash
# Start Netlify dev server
netlify dev

# Or use npm script
npm run netlify:dev
```

Your local development server will run at `http://localhost:8888`

## 🔍 Testing Your Deployment

### Health Check
```bash
curl https://your-site.netlify.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "PupHub API",
  "database": {
    "status": "connected",
    "type": "MongoDB Atlas"
  }
}
```

### Test API Endpoints
```bash
# Get all breeds
curl https://your-site.netlify.app/api/breeds

# Get random dog
curl https://your-site.netlify.app/api/random

# Search breeds
curl "https://your-site.netlify.app/api/search?q=golden"
```

## 📊 MongoDB Collections

Your database will automatically create these collections:

- **users** - User preferences and statistics
- **favoriteimages** - User favorite dog images
- **apiusages** - API usage analytics
- **breedcaches** - Cached breed data from Dog CEO API
- **serverstats** - Daily server statistics
- **errorlogs** - Error logging for debugging

## 🔐 Security Best Practices

### MongoDB Atlas Security
1. **Use strong passwords** for database users
2. **Restrict IP access** to specific addresses in production
3. **Enable audit logging** for compliance
4. **Regularly rotate credentials**

### Netlify Security
1. **Use environment variables** for sensitive data
2. **Enable branch deploys** for testing
3. **Set up proper CORS headers**
4. **Monitor function usage** and costs

### Application Security
1. **Validate all inputs** in functions
2. **Implement rate limiting** for API endpoints
3. **Use HTTPS only** (handled by Netlify)
4. **Sanitize user data** before storage

## 📈 Monitoring & Analytics

### Netlify Analytics
1. Go to **Site overview** → **Analytics**
2. Monitor function invocations
3. Check build times and success rates
4. Review bandwidth usage

### MongoDB Atlas Monitoring
1. Go to **Monitoring** in Atlas dashboard
2. Check connection counts
3. Monitor query performance
4. Set up alerts for issues

### Custom Monitoring
Access your analytics dashboard:
```
https://your-site.netlify.app/api/stats
```

## 🚀 Performance Optimization

### Database Optimization
1. **Use indexes** for frequently queried fields
2. **Implement connection pooling** (done automatically)
3. **Cache frequently accessed data**
4. **Monitor slow queries** in Atlas

### Function Optimization
1. **Minimize cold starts** with connection caching
2. **Use async/await** properly
3. **Implement request/response compression**
4. **Optimize bundle sizes**

### Frontend Optimization
1. **Use CDN** for static assets (Netlify handles this)
2. **Implement caching strategies**
3. **Optimize images** and assets
4. **Minimize JavaScript bundles**

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
Error: MongoNetworkError: connection 0 to cluster.net:27017 timed out
```
Solution: Check network access whitelist and connection string

**Function Timeout:**
```bash
Task timed out after 10.00 seconds
```
Solution: Optimize database queries and add indexes

**CORS Errors:**
```bash
Access to fetch blocked by CORS policy
```
Solution: Check CORS headers in netlify.toml

### Debug Commands
```bash
# Check function logs
netlify functions:logs

# Test function locally
netlify functions:invoke health

# Check environment variables
netlify env:list
```

## 💰 Cost Estimation

### MongoDB Atlas (Free Tier)
- **Storage:** 512 MB included
- **Data Transfer:** Limited but sufficient for development
- **Connections:** Up to 500 concurrent

### Netlify (Free Tier)
- **Bandwidth:** 100 GB/month
- **Function Invocations:** 125K/month
- **Function Runtime:** 125K seconds/month
- **Build Minutes:** 300/month

### Scaling Considerations
- **MongoDB:** Upgrade to M2/M5 for production
- **Netlify:** Pro plan for higher limits
- **Functions:** Optimize for efficiency to stay within limits

## 🔄 CI/CD Pipeline

### Automatic Deployments
1. **Push to main branch** → Auto-deploy to production
2. **Pull request** → Deploy preview (if enabled)
3. **Environment branches** → Deploy to staging

### GitHub Actions Example
```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: netlify/actions/deploy@master
        with:
          publish-dir: './frontend'
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 📚 Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Netlify CLI Documentation](https://cli.netlify.com/)

## 🆘 Support

For issues with:
- **MongoDB:** Contact Atlas support or check community forums
- **Netlify:** Check Netlify status page and documentation
- **PupHub API:** Check GitHub issues or create new issue

---

**🎉 Congratulations!** Your PupHub API is now deployed with MongoDB Atlas and Netlify, providing a scalable, serverless architecture for your dog breed application.