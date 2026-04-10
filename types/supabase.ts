import { User, Session } from '@supabase/supabase-js'

export type { User, Session }

export interface UserMetadata {
  user_name?: string
  preferred_username?: string
  avatar_url?: string
  provider_id?: string
}

export interface AuthUser extends User {
  user_metadata: UserMetadata
}

export interface MongoUser {
  supabaseId: string
  email?: string
  githubUsername?: string
  githubId?: string
  avatarUrl?: string
  hfUsername?: string
  hfAccessToken?: string
  hfConnectedAt?: string
  connectedAt?: string
  disconnectedAt?: string
}
