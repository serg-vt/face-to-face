# Deployment Guide - Face to Face Video Conference App

## 🚀 Deployment Options

Your Face to Face app can be deployed to various platforms. Here are the most popular options:

---

## 1. Railway (Recommended - Easiest)

**Why Railway?**
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ WebSocket support
- ✅ Simple deployment
- ✅ Environment variables UI
- ✅ Built-in domains

### Steps:

1. **Create Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your repository

3. **Configure Environment Variables**
   ```
   NODE_ENV=production
   CLIENT_URL=https://your-app.railway.app
   PORT=3000
   ```

4. **Deploy**
   - Railway automatically detects Node.js
   - Builds and deploys your app
   - Provides URL: `https://your-app.railway.app`

5. **Update Client**
   - Add environment variable in Railway:
   ```
   VITE_SERVER_URL=https://your-app.railway.app
   ```

**Cost:** Free tier includes $5/month credit

---

## 2. Render (Great for Full-Stack Apps)

**Why Render?**
- ✅ Free tier available
- ✅ Automatic SSL
- ✅ Easy configuration
- ✅ Good documentation

### Steps:

1. **Create Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repo

3. **Configure Service**
   ```
   Name: face-to-face-app
   Environment: Node
   Build Command: npm run install-all && npm run build
   Start Command: npm start
   ```

4. **Add Environment Variables**
   ```
   NODE_ENV=production
   CLIENT_URL=https://your-app.onrender.com
   ```

5. **Deploy**
   - Render builds and deploys automatically
   - You get: `https://your-app.onrender.com`

**Note:** Free tier apps sleep after 15 minutes of inactivity

---

## 3. Heroku (Traditional PaaS)

**Why Heroku?**
- ✅ Well-established platform
- ✅ Lots of documentation
- ✅ Add-ons available

### Steps:

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create App**
   ```bash
   cd C:\Workspace\Projects\face-to-face
   heroku create your-app-name
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CLIENT_URL=https://your-app-name.herokuapp.com
   ```

5. **Deploy**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push heroku main
   ```

6. **Open App**
   ```bash
   heroku open
   ```

**Cost:** Starts at $7/month (no free tier anymore)

---

## 4. Vercel (Best for Frontend)

**Note:** Vercel is great for the client, but Socket.IO needs a separate backend.

### Deploy Client Only:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Client**
   ```bash
   cd client
   vercel
   ```

3. **Set Environment Variable**
   ```
   VITE_SERVER_URL=https://your-backend-url.com
   ```

**For Backend:** Use Railway or Render

---

## 5. DigitalOcean App Platform

**Why DigitalOcean?**
- ✅ Reliable infrastructure
- ✅ Good performance
- ✅ Scalable

### Steps:

1. **Create Account**
   - Go to [digitalocean.com](https://www.digitalocean.com)

2. **Create App**
   - Click "Create" → "Apps"
   - Connect GitHub repo

3. **Configure**
   ```
   Run Command: npm start
   Build Command: npm run install-all && npm run build
   ```

4. **Environment Variables**
   ```
   NODE_ENV=production
   PORT=8080
   ```

**Cost:** Starts at $5/month

---

## 6. Docker Deployment (Self-Hosted)

**For VPS/Cloud VM (AWS, Azure, GCP, etc.)**

### Build and Run:

```bash
# Build image
docker build -t face-to-face .

# Run container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  face-to-face
```

### Using Docker Compose:

```bash
# Start
docker-compose up -d

# Stop
docker-compose down
```

---

## Environment Variables Setup

### Server (.env)
```env
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-frontend-domain.com
```

### Client (.env.production)
```env
VITE_SERVER_URL=https://your-backend-domain.com
```

---

## Pre-Deployment Checklist

### 1. Security
- [ ] Update CORS to specific domain (not `origin: true`)
- [ ] Add rate limiting
- [ ] Implement authentication (optional)
- [ ] Add input validation
- [ ] Set secure headers

### 2. Performance
- [ ] Build client for production (`npm run build`)
- [ ] Enable gzip compression
- [ ] Add caching headers
- [ ] Optimize images/assets

### 3. Monitoring
- [ ] Add error logging (e.g., Sentry)
- [ ] Set up uptime monitoring
- [ ] Add analytics (optional)

### 4. SSL/HTTPS
- [ ] Most platforms provide automatic HTTPS
- [ ] Ensure WebSocket works with WSS (secure WebSocket)
- [ ] Test camera/microphone access (requires HTTPS)

### 5. TURN Server (Optional but Recommended)
- [ ] For better connectivity behind NATs/firewalls
- [ ] Use services like Twilio, Xirsys, or self-hosted Coturn
- [ ] Add to WebRTC configuration

---

## Recommended Deployment Strategy

### Option A: Single Platform (Easiest)
**Railway or Render**
- Deploy entire app on one platform
- Server serves built React client
- Single domain for everything
- Simplest setup

### Option B: Split Deployment (More Scalable)
**Vercel (Client) + Railway (Server)**
- Better performance
- Independent scaling
- More complex CORS setup
- Two domains to manage

---

## Quick Deployment Commands

### Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

### Render
```bash
# Just push to GitHub
git push origin main

# Render auto-deploys from GitHub
```

### Heroku
```bash
heroku create
git push heroku main
heroku open
```

---

## Post-Deployment

### 1. Test Deployment
- [ ] Open app in browser
- [ ] Create a meeting
- [ ] Join from another device
- [ ] Test audio/video
- [ ] Test controls (mute, camera off, leave)
- [ ] Test voice detection

### 2. Update README
- [ ] Add deployment URL
- [ ] Update setup instructions
- [ ] Add badges (optional)

### 3. Monitor
- [ ] Check server logs
- [ ] Monitor performance
- [ ] Track errors
- [ ] Monitor uptime

---

## Common Issues & Solutions

### Issue: WebSocket connection failed
**Solution:** Ensure platform supports WebSockets (most do)

### Issue: Camera/Mic not working
**Solution:** Must use HTTPS in production. HTTP only works on localhost.

### Issue: CORS errors
**Solution:** Update CLIENT_URL environment variable with correct domain

### Issue: App works locally but not deployed
**Solution:** 
- Check environment variables
- Check build output (client/dist exists)
- Check server logs
- Verify ports are correct

### Issue: Video calls don't connect
**Solution:**
- Check STUN server accessibility
- Consider adding TURN server
- Check firewall rules

---

## Cost Comparison (as of November 2024)

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/month | $5+/month | Quick deployment |
| **Render** | ✅ Yes (with sleep) | $7+/month | Full-stack apps |
| **Heroku** | ❌ No | $7+/month | Enterprise |
| **Vercel** | ✅ Yes | $20+/month | Frontend only |
| **DigitalOcean** | ❌ No | $5+/month | Self-managed |
| **Fly.io** | $5 credit | $5+/month | Global deployment |

---

## My Recommendation

**For Testing/Small Projects:**
→ **Railway** (easiest, free tier, great DX)

**For Production:**
→ **Render** (reliable, good free tier with auto-sleep)
→ **Railway** (better uptime on free tier)

**For Scale:**
→ **DigitalOcean** or **AWS** with Docker

---

## Next Steps

1. Choose a platform
2. Create account
3. Set environment variables
4. Deploy
5. Test thoroughly
6. Share with users!

Good luck with your deployment! 🚀

For detailed instructions on your chosen platform, see the specific guides below:
- `DEPLOY_RAILWAY.md` (recommended)
- `DEPLOY_RENDER.md`
- `DEPLOY_HEROKU.md`

