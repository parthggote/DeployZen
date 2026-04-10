# 📋 Supabase Auth Setup Checklist

Follow this checklist to complete your Supabase authentication setup.

## ✅ Pre-Setup

- [ ] Node.js and npm installed
- [ ] Project cloned and dependencies installed
- [ ] MongoDB connection working
- [ ] GitHub OAuth app created (you already have this)

## 🔧 Supabase Setup

### 1. Create Supabase Project
- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New Project"
- [ ] Enter project name: "DeployZen" (or your choice)
- [ ] Generate and save database password
- [ ] Select region closest to your users
- [ ] Click "Create new project"
- [ ] Wait ~2 minutes for provisioning

### 2. Get Credentials
- [ ] Go to Settings → API in Supabase Dashboard
- [ ] Copy "Project URL" (looks like: `https://xxxxx.supabase.co`)
- [ ] Copy "anon/public key" (starts with `eyJ...`)

### 3. Update Environment Variables
- [ ] Open `.env.local` in your project
- [ ] Replace `NEXT_PUBLIC_SUPABASE_URL` with your Project URL
- [ ] Replace `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your anon key
- [ ] Save the file

### 4. Configure GitHub OAuth in Supabase
- [ ] Go to Authentication → Providers in Supabase Dashboard
- [ ] Find and expand "GitHub"
- [ ] Toggle "Enable GitHub provider" to ON
- [ ] Enter your GitHub Client ID: `3203638`
- [ ] Enter your GitHub Client Secret: `1f099a9fe67e57d7e4740630728d7b728380059d`
- [ ] Copy the "Callback URL" shown (looks like: `https://xxxxx.supabase.co/auth/v1/callback`)
- [ ] Click "Save"

### 5. Update GitHub OAuth App
- [ ] Go to https://github.com/settings/developers
- [ ] Click on your OAuth App
- [ ] Update "Authorization callback URL" to the Supabase callback URL you copied
- [ ] Click "Update application"

### 6. Configure Redirect URLs in Supabase
- [ ] Go to Authentication → URL Configuration in Supabase Dashboard
- [ ] Set "Site URL" to: `https://deploy-zen-five.vercel.app`
- [ ] Add Redirect URLs:
  - [ ] `http://localhost:3000/**`
  - [ ] `https://deploy-zen-five.vercel.app/**`
- [ ] Click "Save"

## 📦 Installation

### 7. Install Dependencies
```bash
npm install
```

This will install the new `@supabase/ssr` package.

## 🧪 Testing

### 8. Start Development Server
```bash
npm run dev
```

### 9. Test Authentication Flow
- [ ] Open browser to `http://localhost:3000/landing`
- [ ] Click "Sign In" button
- [ ] You should be redirected to `/login`
- [ ] Click "Continue with GitHub"
- [ ] Authorize the application on GitHub
- [ ] You should be redirected back to `/dashboard/repo-scan?connected=true`
- [ ] Check that your avatar and username appear in the header
- [ ] Click on your avatar and verify "Log out" button works

### 10. Test Protected Routes
- [ ] Sign out if you're signed in
- [ ] Try to access `http://localhost:3000/dashboard`
- [ ] You should be redirected to `/landing`
- [ ] Sign in again
- [ ] You should be able to access dashboard

### 11. Test MongoDB Integration
- [ ] Sign in with GitHub
- [ ] Check your MongoDB database
- [ ] Verify a user document exists with:
  - [ ] `supabaseId` field
  - [ ] `email` field
  - [ ] `githubUsername` field
  - [ ] `githubId` field
  - [ ] `avatarUrl` field

### 12. Test Hugging Face OAuth (Optional)
- [ ] Sign in with GitHub first
- [ ] Go to `/dashboard/upload-model`
- [ ] Click "Connect Hugging Face"
- [ ] Authorize on Hugging Face
- [ ] Verify connection in MongoDB

## 🚀 Production Deployment

### 13. Update Production Environment Variables
- [ ] Go to your Vercel/hosting dashboard
- [ ] Add environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Keep existing variables (MongoDB, GitHub, etc.)

### 14. Update Supabase Production URLs
- [ ] Go to Supabase Dashboard → Authentication → URL Configuration
- [ ] Update "Site URL" to your production domain
- [ ] Add production redirect URLs
- [ ] Save changes

### 15. Deploy and Test
- [ ] Deploy to production
- [ ] Test authentication flow in production
- [ ] Verify all features work

## 📝 Documentation Review

### 16. Read Documentation
- [ ] Read `SUPABASE_SETUP.md` for detailed setup instructions
- [ ] Read `MIGRATION_GUIDE.md` to understand what changed
- [ ] Read `SUPABASE_AUTH_COMPLETE.md` for usage examples

## ✨ Optional Enhancements

### 17. Additional Features (Optional)
- [ ] Enable email/password authentication in Supabase
- [ ] Enable magic link authentication
- [ ] Set up email templates
- [ ] Add user profile management
- [ ] Implement role-based access control
- [ ] Set up Row Level Security (RLS) if using Supabase database

## 🎯 Verification

### Final Checks
- [ ] Authentication works in development
- [ ] Protected routes redirect correctly
- [ ] User data syncs to MongoDB
- [ ] Sign out works properly
- [ ] Avatar and username display correctly
- [ ] No console errors
- [ ] All environment variables set correctly

## 🐛 Troubleshooting

If you encounter issues:

1. **Check Environment Variables**
   - Verify all variables are set correctly
   - Restart dev server after changing `.env.local`

2. **Check Supabase Dashboard**
   - Go to Authentication → Users to see registered users
   - Check Logs for error messages

3. **Check Browser Console**
   - Look for error messages
   - Check Network tab for failed requests

4. **Check MongoDB**
   - Verify connection string is correct
   - Check that users collection exists

5. **Common Issues**
   - "Invalid redirect URL" → Check redirect URLs in Supabase
   - "User not found" → Complete OAuth flow
   - Session not persisting → Check middleware configuration

## 📞 Support

Need help?
- Check `SUPABASE_SETUP.md` for detailed instructions
- Review `MIGRATION_GUIDE.md` for technical details
- Visit [Supabase Documentation](https://supabase.com/docs)
- Check [Supabase Discord](https://discord.supabase.com)

## 🎉 Completion

Once all items are checked:
- ✅ Your Supabase authentication is fully configured
- ✅ Your application is ready for development
- ✅ You can deploy to production

Congratulations! 🚀
