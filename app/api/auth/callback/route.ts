import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect to dashboard after successful email confirmation
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    }
  }

  // Return the user to signin page with error
  return NextResponse.redirect(new URL('/signin?error=Could not verify email. Please try again.', requestUrl.origin))
}
