import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

export interface AuthUser {
  id: string
  email: string
  name: string
}

/** Normalized PocketBase auth record. */
function normalize(model: unknown): AuthUser | null {
  if (!model || typeof model !== 'object') return null
  const record = model as {
    id?: unknown
    email?: unknown
    name?: unknown
  }
  if (typeof record.id !== 'string') return null
  return {
    id: record.id,
    email: typeof record.email === 'string' ? record.email : '',
    name: typeof record.name === 'string' ? record.name : '',
  }
}

/**
 * Sign up: create a new auth user. PocketBase does not auto-authenticate on
 * collection create, so the caller should redirect to /login afterwards.
 */
export async function signUp(name: string, email: string, password: string): Promise<AuthUser> {
  try {
    const record = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
    })
    const user = normalize(record)
    if (!user) {
      throw new Error('invalid-user')
    }
    return user
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

/** Sign in with email + password. Stores the auth token in PocketBase's store. */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  try {
    const result = await pb.collection('users').authWithPassword(email, password)
    const user = normalize(result.record)
    if (!user) {
      throw new Error('invalid-user')
    }
    return user
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

/** Clear the local auth store. */
export function signOut(): void {
  pb.authStore.clear()
}

/** Current authenticated user (from the persisted auth store), or null. */
export function getCurrentUser(): AuthUser | null {
  try {
    return normalize(pb.authStore.model)
  } catch {
    return null
  }
}

export function isAuthValid(): boolean {
  return pb.authStore.isValid
}

/** Maps a thrown auth error to a stable PT-BR user-facing message. */
export function normalizeAuthError(error: unknown): Error {
  if (error instanceof ClientResponseError) {
    const status = error.status
    // 400 — invalid credentials / validation error
    if (status === 400) {
      const data = error.response?.data
      // Email-already-exists shows up as a 400 with an email field validation
      const emailData = data?.email
      if (
        emailData &&
        typeof emailData === 'object' &&
        'code' in emailData &&
        (emailData as { code: string }).code === 'validation_invalid_email_already_exists'
      ) {
        return new Error('email-exists')
      }
      // Otherwise treat 400 as invalid credentials
      return new Error('invalid-credentials')
    }
    if (status === 0 || status >= 500) {
      return new Error('network')
    }
    return new Error('unknown')
  }
  if (error instanceof Error) {
    if (error.message === 'email-exists') return error
    if (error.message === 'invalid-credentials') return error
    if (error.message === 'network') return error
    if (error.message === 'unknown') return error
    if (error.message === 'invalid-user') return new Error('unknown')
    return new Error('network')
  }
  return new Error('network')
}

/** Returns true while the auth store has no valid token yet during boot. */
export function onAuthChange(cb: () => void): () => void {
  pb.authStore.onChange(cb)
  return () => {
    pb.authStore.onChange(() => {})
  }
}

/** Revalidate the stored token against the backend; clears it if invalid. */
export async function refreshAuth(): Promise<AuthUser | null> {
  try {
    if (!pb.authStore.isValid) {
      return null
    }
    await pb.collection('users').authRefresh()
    return normalize(pb.authStore.model)
  } catch (error) {
    // Token is stale/invalid — clear the local store so the user is sent to
    // login instead of being stuck in an invalid state.
    pb.authStore.clear()
    return null
  }
}
