# Deploy to Railway - Step by Step Guide

## Why Railway?

- ✅ **$5 free credit** per month (enough for small projects)
- ✅ **Automatic HTTPS** with custom domains
- ✅ **WebSocket support** out of the box
- ✅ **Zero configuration** deployment
- ✅ **GitHub integration** for auto-deploys
- ✅ **Environment variables** UI
- ✅ **Live logs** and metrics

---

## Prerequisites

1. GitHub account
2. Your code pushed to GitHub repository
3. Railway account (free)

---

## Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
cd C:\Workspace\Projects\face-to-face

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/face-to-face.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Login"
3. Choose "Login with GitHub"
4. Authorize Railway

### Step 3: Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `face-to-face`
4. Railway will detect it's a Node.js app

### Step 4: Configure Build Settings

Railway auto-detects most settings, but verify:

**Build Command:**
```
npm run install-all && npm run build
```

**Start Command:**
```
npm start
```

### Step 5: Add Environment Variables

1. Click on your service
2. Go to "Variables" tab
3. Add these variables:

```
NODE_ENV=production
PORT=3000
```

**Important:** Don't add CLIENT_URL yet - we need the Railway URL first!

### Step 6: Deploy

1. Click "Deploy" (or it auto-deploys)
2. Wait for build to complete (2-3 minutes)
3. Railway will show deployment status

### Step 7: Get Your App URL

1. Go to "Settings" tab
2. Under "Domains", click "Generate Domain"
3. You'll get: `https://your-app-name.up.railway.app`

### Step 8: Update Environment Variables

Now that you have the URL, add:

```
CLIENT_URL=https://your-app-name.up.railway.app
VITE_SERVER_URL=https://your-app-name.up.railway.app
```

### Step 9: Redeploy

1. Railway will auto-redeploy with new environment variables
2. Wait for deployment to complete

### Step 10: Test Your App

1. Open: `https://your-app-name.up.railway.app`
2. Enter your name
3. Create a meeting
4. Test from another device!

---

## Adding Custom Domain (Optional)

### Step 1: Get a Domain
- Buy from Namecheap, GoDaddy, Google Domains, etc.

### Step 2: Add to Railway
1. In Railway, go to Settings → Domains
2. Click "Custom Domain"
3. Enter your domain: `meet.yourdomain.com`

### Step 3: Configure DNS
Add these records to your domain:

**CNAME Record:**
```
Name: meet
Value: your-app-name.up.railway.app
```

Or **A Record:**
```
Name: meet
Value: [Railway provides the IP]
```

### Step 4: Update Environment Variables
```
CLIENT_URL=https://meet.yourdomain.com
VITE_SERVER_URL=https://meet.yourdomain.com
```

### Step 5: Wait for DNS
- Can take 1-48 hours
- Railway provides automatic SSL certificate

---

## Monitoring Your App

### View Logs
1. Go to your service
2. Click "Deployments"
3. Click on latest deployment
4. View real-time logs

### Check Metrics
1. Go to "Metrics" tab
2. See:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count

### Set Up Alerts (Optional)
1. Go to "Observability"
2. Configure alerts for:
   - App crashes
   - High resource usage
   - Deployment failures

---

## Updating Your App

### Automatic Updates (Recommended)

1. Make changes locally
2. Commit and push:
```bash
git add .
git commit -m "Update feature"
git push origin main
```
3. Railway auto-deploys from GitHub
4. Check deployment status in Railway dashboard

### Manual Deploy

1. Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway up
```

---

## Cost Management

### Free Tier Limits
- **$5 credit per month**
- **500 hours** of usage
- Sufficient for:
  - Small projects
  - Testing
  - Personal use
  - Low traffic apps

### Usage Tips
1. Monitor usage in Railway dashboard
2. Set spending limits
3. Use "Sleep" feature for non-critical apps
4. Upgrade to paid plan if needed ($5-20/month)

### What Uses Credits?
- CPU time
- Memory
- Network egress
- Storage

---

## Troubleshooting

### Build Failed
**Check:**
- Build logs in Railway
- Ensure `package.json` is correct
- All dependencies installed
- Node version compatible

**Solution:**
```bash
# Specify Node version in package.json
"engines": {
  "node": ">=18.0.0"
}
```

### App Deployed but Not Working
**Check:**
1. Environment variables set correctly
2. Logs for errors
3. PORT is set (Railway assigns dynamically)
4. CORS configuration

### WebSocket Not Connecting
**Check:**
1. Using `wss://` (secure WebSocket) in production
2. CLIENT_URL environment variable correct
3. Socket.IO configuration allows your domain

### Camera/Mic Not Working
**Solution:**
- HTTPS is required for getUserMedia
- Railway provides HTTPS automatically
- Check browser permissions

### Database Connection Issues
**Note:** This app doesn't use a database, but if you add one:
- Use Railway's PostgreSQL plugin
- Add DATABASE_URL to environment variables

---

## Advanced Configuration

### Using Railway CLI

```bash
# Install
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open dashboard
railway open

# Deploy
railway up
```

### Environment-Specific Variables

**Development:**
```env
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
```

**Production (Railway):**
```env
NODE_ENV=production
PORT=$PORT  # Railway assigns this
CLIENT_URL=https://your-app.up.railway.app
```

### Scaling

**Vertical Scaling:**
1. Go to Settings
2. Adjust resources:
   - Memory: 512MB - 8GB
   - vCPU: 0.5 - 8 cores

**Horizontal Scaling:**
- Not needed for this app
- WebRTC is peer-to-peer
- Server only handles signaling

---

## Security Best Practices

### 1. Secure Environment Variables
- Never commit `.env` files
- Use Railway's secure variable storage
- Rotate secrets regularly

### 2. CORS Configuration
Update server to restrict origins:
```javascript
cors: {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST"],
  credentials: true
}
```

### 3. Rate Limiting
Add express-rate-limit:
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);
```

### 4. Helmet for Security Headers
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

## Backup & Recovery

### Database Backups
- If you add a database, use Railway's backup feature
- Enable automatic backups

### Code Backups
- GitHub is your backup
- Use tags for releases:
```bash
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

### Rollback
1. Go to Deployments
2. Find previous working deployment
3. Click "Redeploy"

---

## Performance Optimization

### 1. Enable Compression
```bash
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());
```

### 2. Caching
```javascript
app.use(express.static('client/dist', {
  maxAge: '1d',
  etag: true
}));
```

### 3. CDN (Optional)
- Use Cloudflare for static assets
- Railway integrates with Cloudflare

---

## Complete Deployment Checklist

### Pre-Deployment
- [ ] Code pushed to GitHub
- [ ] `.env.example` files created
- [ ] `.gitignore` includes `.env` and `node_modules`
- [ ] `package.json` has correct scripts
- [ ] Build tested locally

### During Deployment
- [ ] Railway project created
- [ ] Environment variables set
- [ ] Custom domain added (optional)
- [ ] SSL certificate active
- [ ] Deployment successful

### Post-Deployment
- [ ] App accessible via URL
- [ ] Video calls working
- [ ] Audio working
- [ ] Controls functional
- [ ] Voice detection working
- [ ] Mobile devices tested
- [ ] Logs reviewed
- [ ] Monitoring set up

---

## Getting Help

### Railway Support
- [Documentation](https://docs.railway.app)
- [Discord Community](https://discord.gg/railway)
- [GitHub Issues](https://github.com/railwayapp/railway)

### Railway Status
- [status.railway.app](https://status.railway.app)

---

## Example Full Deployment

```bash
# 1. Prepare code
cd C:\Workspace\Projects\face-to-face
git add .
git commit -m "Ready for Railway deployment"
git push origin main

# 2. Create Railway project (via web UI)
# - Login to railway.app
# - New Project → Deploy from GitHub
# - Select repository

# 3. Set environment variables (via Railway UI)
NODE_ENV=production
CLIENT_URL=https://your-app.up.railway.app
PORT=3000

# 4. Wait for deployment
# Railway builds and deploys automatically

# 5. Test
# Open: https://your-app.up.railway.app

# 6. Monitor
# Check logs and metrics in Railway dashboard
```

---

## Success! 🎉

Your Face to Face app is now live on Railway!

**Share your app:**
```
https://your-app-name.up.railway.app
```

**Monitor your deployment:**
- Check Railway dashboard regularly
- Review logs for errors
- Monitor resource usage

**Next steps:**
- Add authentication
- Implement TURN server
- Add analytics
- Improve error handling
- Add more features!

Congratulations on deploying your video conference app! 🚀

