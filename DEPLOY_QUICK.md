# Quick Deployment Reference

## 🚀 Fastest Way to Deploy

### 1. Railway (Recommended)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/face-to-face.git
git push -u origin main

# Then go to railway.app:
# 1. Login with GitHub
# 2. New Project → Deploy from GitHub repo
# 3. Select your repo
# 4. Add environment variables:
#    NODE_ENV=production
#    CLIENT_URL=https://your-app.up.railway.app
# 5. Done! Your app is live.
```

---

## 📋 Environment Variables Needed

### Server (.env)
```env
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-deployed-app.com
```

### Client (.env.production)
```env
VITE_SERVER_URL=https://your-deployed-app.com
```

---

## 🔧 Files Created for Deployment

- ✅ `Procfile` - For Heroku
- ✅ `vercel.json` - For Vercel
- ✅ `Dockerfile` - For Docker/Container platforms
- ✅ `docker-compose.yml` - For Docker Compose
- ✅ `.dockerignore` - Ignore files for Docker
- ✅ `.gitignore` - Ignore files for Git
- ✅ `server/.env.example` - Environment template
- ✅ `client/.env.example` - Environment template
- ✅ Server updated with dotenv support
- ✅ Client updated with environment variable support
- ✅ Production build scripts added

---

## 📚 Documentation Created

1. **DEPLOYMENT.md** - Complete deployment guide
   - All platform options
   - Cost comparison
   - Step-by-step instructions
   - Troubleshooting

2. **DEPLOY_RAILWAY.md** - Detailed Railway guide
   - Why Railway
   - Complete walkthrough
   - Custom domain setup
   - Monitoring & scaling

---

## 🎯 Choose Your Platform

| Platform | Difficulty | Free Tier | Time to Deploy |
|----------|-----------|-----------|----------------|
| **Railway** | ⭐ Easy | ✅ $5 credit | 5 minutes |
| **Render** | ⭐ Easy | ✅ Yes | 5 minutes |
| **Heroku** | ⭐⭐ Medium | ❌ No | 10 minutes |
| **Vercel** | ⭐ Easy | ✅ Yes | 5 minutes (client only) |
| **Docker** | ⭐⭐⭐ Hard | N/A | 15+ minutes |

---

## ✅ Pre-Deployment Checklist

Before deploying, make sure:

- [ ] Code is pushed to GitHub
- [ ] `.env` files are in `.gitignore` (already done)
- [ ] Build scripts work: `npm run build` in client folder
- [ ] Environment variables are documented
- [ ] Server uses environment variables for configuration
- [ ] Client uses VITE_SERVER_URL for API connection

---

## 🧪 Test Before Deploying

```bash
# Test production build locally
cd client
npm run build
npm run preview

# Test server in production mode
cd ../server
NODE_ENV=production npm start
```

---

## 🚨 Common Issues

### Build Fails
- Check Node version (needs >=18)
- Run `npm run install-all` first
- Check `package.json` scripts

### CORS Errors After Deployment
- Set `CLIENT_URL` environment variable correctly
- Use your actual deployed URL
- Include `https://` in the URL

### WebSocket Connection Fails
- Ensure platform supports WebSockets (Railway, Render, Heroku do)
- Check CLIENT_URL matches deployed domain
- Use `wss://` for secure WebSocket

### Camera/Mic Not Working
- Must use HTTPS (all modern platforms provide this)
- Check browser permissions
- Test on different browser

---

## 📖 Read the Guides

For detailed instructions:
- **Start here:** `DEPLOYMENT.md`
- **Railway deployment:** `DEPLOY_RAILWAY.md`

---

## 💰 Cost Estimates

### Free Tier Options:
1. **Railway**: $5 credit/month (enough for testing)
2. **Render**: Free with auto-sleep after 15 min
3. **Vercel**: Free for client (need separate backend)

### Paid Options:
1. **Railway**: ~$5-10/month
2. **Render**: ~$7/month
3. **Heroku**: ~$7/month
4. **DigitalOcean**: ~$5/month (requires more setup)

---

## 🎉 You're Ready!

Your app is now ready to be deployed to the cloud!

**Next steps:**
1. Choose a platform (Railway recommended)
2. Follow the guide in DEPLOYMENT.md or DEPLOY_RAILWAY.md
3. Deploy and test
4. Share your app with the world!

**Need help?** Check the detailed guides in:
- `DEPLOYMENT.md`
- `DEPLOY_RAILWAY.md`

Good luck with your deployment! 🚀

