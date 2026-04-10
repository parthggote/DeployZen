# Migration from NextAuth to Supabase Auth

This document outlines the changes made to migrate from NextAuth to Supabase Auth.

## Summary of Changes

### 1. Dependencies

**Added:**
- `@supabase/ssr@^0.5.2` - Supabase SSR helpers for Next.js

**Removed:**
- NextAuth dependencies (if any were present)

### 2. Environment Variables

**Updated `.env.local`:**

```env
# Added
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Removed
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
```

### 3. New Files Created

#### Core Auth Files
- `lib/supabase/client.ts` - Browser client for Supabase
- `lib/supabase/server.ts` - Server client for Supabase
- `lib/supabase/middleware.ts` - Middleware helper for session management
- `contexts/auth-context.tsx` - React context for auth state
- `hooks/use-user.ts` - Convenience hook for user data
- `types/supabase.ts` - TypeScript types for auth

#### Middleware
- `middleware.ts` - Route protection middleware

#### Pages
- `app/login/page.tsx` - Login page with GitHub OAuth
- `app/api/auth/signout/route.ts` - Sign out endpoint

#### Documentation
- `SUPABASE_SETUP.md` - Complete setup guide
- `MIGRATION_GUIDE.md` - This file

### 4. Modified Files

#### API Routes
All auth routes were updated to use Supabase:

- `app/api/auth/github/route.ts` - Now uses Supabase OAuth
- `app/api/auth/github/callback/route.ts` - Handles Supabase callback
- `app/api/auth/github/disconnect/route.ts` - Updated for Supabase users
- `app/api/auth/huggingface/route.ts` - Requires Supabase auth
- `app/api/auth/huggingface/callback/route.ts` - Updated for Supabase users
- `app/api/auth/huggingface/disconnect/route.ts` - Updated for Supabase users
- `app/api/auth/status/route.ts` - Returns Supabase user status

#### Components
- `app/layout.tsx` - Added `AuthProvider` wrapper
- `components/dashboard-header.tsx` - Uses `useAuth` hook, displays user info, working sign out

#### Configuration
- `package.json` - Added `@supabase/ssr` dependency
- `.env.local` - Updated with Supabase credentials

### 5. Database Schema Changes

MongoDB users collection now uses `supabaseId` instead of relying solely on `githubId`:

**Before:**
```json
{
  "githubId": "12345",
  "githubUsername": "username",
  "githubAccessToken": "token",
  "avatarUrl": "https://..."
}
```

**After:**
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

### 6. Authentication Flow Changes

#### Before (NextAuth)
1. User clicks "Sign in with GitHub"
2. NextAuth handles OAuth flow
3. Session stored in NextAuth
4. User data in MongoDB

#### After (Supabase)
1. User clicks "Sign in with GitHub"
2. Supabase handles OAuth flow
3. Session stored in Supabase (cookies)
4. User data synced to MongoDB with `supabaseId`
5. Middleware validates session on protected routes

### 7. Key Differences

| Feature | NextAuth | Supabase Auth |
|---------|----------|---------------|
| Session Storage | Database/JWT | Cookies (httpOnly) |
| OAuth Providers | Built-in | Built-in + Custom |
| Server Components | `getServerSession()` | `createClient().auth.getUser()` |
| Client Components | `useSession()` | `useAuth()` custom hook |
| Middleware | Custom | Built-in with SSR helpers |
| User Management | Custom | Built-in dashboard |

### 8. Migration Steps for Existing Users

If you have existing users in your database:

1. **Create a migration script** to add `supabaseId` to existing users
2. **Map GitHub IDs** to Supabase user IDs after first login
3. **Update queries** to use `supabaseId` instead of `githubId`

Example migration script:

```typescript
// scripts/migrate-users.ts
import clientPromise from '@/lib/mongodb'
import { createClient } from '@supabase/supabase-js'

async function migrateUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key
  )
  
  const mongo = await clientPromise
  const db = mongo.db('DeployZen')
  const users = await db.collection('users').find({}).toArray()
  
  for (const user of users) {
    // Find corresponding Supabase user by email or GitHub ID
    const { data: supabaseUser } = await supabase.auth.admin.listUsers()
    const match = supabaseUser?.users.find(u => 
      u.user_metadata?.provider_id === user.githubId
    )
    
    if (match) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { supabaseId: match.id } }
      )
      console.log(`Migrated user ${user.githubUsername}`)
    }
  }
}
```

### 9. Testing Checklist

- [ ] GitHub OAuth login works
- [ ] User session persists across page reloads
- [ ] Protected routes redirect to login
- [ ] Sign out works correctly
- [ ] User data syncs to MongoDB
- [ ] Hugging Face OAuth works (requires GitHub login first)
- [ ] Disconnect GitHub works
- [ ] Disconnect Hugging Face works
- [ ] Avatar and username display correctly
- [ ] Middleware protects dashboard routes

### 10. Rollback Plan

If you need to rollback:

1. Restore previous auth files from git history
2. Revert `.env.local` changes
3. Restore `package.json` dependencies
4. Remove Supabase-specific files
5. Run `npm install` to restore previous dependencies

### 11. Benefits of Supabase Auth

✅ Built-in user management dashboard
✅ Email/password auth ready to enable
✅ Magic link authentication
✅ Phone authentication
✅ Better security with httpOnly cookies
✅ Automatic session refresh
✅ Row Level Security (RLS) for database
✅ Real-time subscriptions
✅ Better TypeScript support
✅ Simpler middleware implementation

### 12. Next Steps

1. Complete Supabase setup (see `SUPABASE_SETUP.md`)
2. Test all authentication flows
3. Update any remaining components using auth
4. Consider enabling additional Supabase features:
   - Email/password authentication
   - Magic link authentication
   - User profile management
   - Role-based access control

### 13. Support

For issues or questions:
- Check `SUPABASE_SETUP.md` for setup instructions
- Review [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- Check [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
