# Supabase Auth Setup Guide

This guide will help you set up Supabase authentication for your DeployZen application.

## 🚀 Quick Start

**The migration is complete!** All files have been created and configured. Follow these steps:

1. **Install dependencies** (already done if you see this):
   ```bash
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com

3. **Update `.env.local`** with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Configure GitHub OAuth** in Supabase Dashboard (see Step 4 below)

5. **Start the dev server**:
   ```bash
   npm run dev
   ```

6. **Test authentication** at http://localhost:3000/landing

---

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in your project details:
   - Name: DeployZen (or your preferred name)
   - Database Password: (generate a strong password)
   - Region: Choose the closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (takes ~2 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Update Environment Variables

Update your `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Configure GitHub OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **GitHub** and click to expand
3. Enable GitHub provider
4. Add your GitHub OAuth credentials:
   - **Client ID**: (from your GitHub OAuth App)
   - **Client Secret**: (from your GitHub OAuth App)
5. Copy the **Callback URL** shown (looks like: `https://xxxxx.supabase.co/auth/v1/callback`)
6. Click **Save**

### Update GitHub OAuth App Settings

1. Go to your GitHub OAuth App settings
2. Update the **Authorization callback URL** to the Supabase callback URL you copied above
3. Save changes

## Step 5: Configure Site URL and Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://deploy-zen-five.vercel.app` (or your production URL)
3. Add **Redirect URLs**:
   - `http://localhost:3000/**` (for local development)
   - `https://deploy-zen-five.vercel.app/**` (for production)
4. Click **Save**

## Step 6: Install Dependencies

Run the following command to install the required Supabase packages:

```bash
npm install @supabase/ssr@latest
```

## Step 7: Database Schema (Optional)

The application uses MongoDB for storing additional user data. The Supabase user ID is stored as `supabaseId` in MongoDB documents.

Your MongoDB users collection should have documents like:

```json
{
  "supabaseId": "uuid-from-supabase",
  "email": "user@example.com",
  "githubUsername": "username",
  "githubId": "12345",
  "avatarUrl": "https://...",
  "hfUsername": "hf-username",
  "hfAccessToken": "hf-token",
  "connectedAt": "2024-01-01T00:00:00.000Z"
}
```

## Step 8: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/landing`
3. Click "Sign in with GitHub"
4. You should be redirected to GitHub for authorization
5. After authorization, you'll be redirected back to your app

## Features Implemented

✅ GitHub OAuth via Supabase
✅ Protected routes with middleware
✅ Session management
✅ User context with React hooks
✅ Sign out functionality
✅ MongoDB integration for additional user data
✅ Hugging Face OAuth (custom implementation)

## API Routes

- `GET /api/auth/github` - Initiate GitHub OAuth
- `GET /api/auth/github/callback` - Handle GitHub OAuth callback
- `POST /api/auth/github/disconnect` - Disconnect GitHub
- `GET /api/auth/huggingface` - Initiate HF OAuth
- `GET /api/auth/huggingface/callback` - Handle HF OAuth callback
- `POST /api/auth/huggingface/disconnect` - Disconnect HF
- `GET /api/auth/status` - Get current user status
- `POST /api/auth/signout` - Sign out user

## Using Auth in Components

```tsx
'use client'

import { useAuth } from '@/contexts/auth-context'

export function MyComponent() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Not authenticated</div>

  return (
    <div>
      <p>Welcome {user.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

## Using Auth in Server Components

```tsx
import { createClient } from '@/lib/supabase/server'

export default async function ServerComponent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  return <div>Welcome {user.email}</div>
}
```

## Troubleshooting

### "Invalid redirect URL" error
- Make sure your redirect URLs are properly configured in Supabase Dashboard
- Check that the URL matches exactly (including protocol and trailing slashes)

### "User not found" error
- Ensure the user has completed the OAuth flow
- Check that the Supabase session is valid

### GitHub OAuth not working
- Verify GitHub OAuth app credentials in Supabase
- Ensure the callback URL in GitHub matches Supabase's callback URL
- Check that the GitHub app has the correct permissions (repo, read:user)

## Security Notes

- Never commit `.env.local` to version control
- Use environment variables for all sensitive data
- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in the browser
- Supabase handles Row Level Security (RLS) for database access
- Middleware protects dashboard routes automatically

## Next Steps

1. Set up Row Level Security (RLS) policies in Supabase if using Supabase database
2. Configure email templates in Supabase for password reset, etc.
3. Add additional OAuth providers if needed
4. Implement user profile management
5. Add role-based access control (RBAC) if needed

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
