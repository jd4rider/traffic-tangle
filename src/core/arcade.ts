// Little Joy Arcade adapter. The platform ships a drop-in client
// (public/arcade-client.js) that mirrors localStorage into the player's arcade
// account. Everything here degrades to local-only when the client is absent.

interface ArcadeUser {
  id?: string
  email?: string | null
  displayName?: string | null
}

interface ArcadeStatus {
  text: string
  signedIn: boolean
}

interface ArcadeClient {
  gameId: string
  configured: boolean
  signIn?: (email: string, password: string) => Promise<{ error: string | null }>
  signUp?: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  signOut?: () => Promise<void>
  syncNow?: (reason?: string) => Promise<void>
  user?: () => ArcadeUser | null
  status?: () => ArcadeStatus
}

declare global {
  interface Window {
    LittleJoyArcade?: ArcadeClient
  }
}

export const ARCADE_URL = 'https://littlejoyarcade.site'
export const GAME_ID = 'traffic-tangle'

function client(): ArcadeClient | undefined {
  return typeof window === 'undefined' ? undefined : window.LittleJoyArcade
}

function entitlements(): string[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('lja:entitlements')
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

export const arcade = {
  available(): boolean {
    return Boolean(client()?.configured)
  },
  gameId(): string {
    return client()?.gameId ?? GAME_ID
  },
  userLabel(): string {
    const user = client()?.user?.()
    return user?.email ?? user?.displayName ?? 'Guest player'
  },
  status(): string {
    return client()?.status?.()?.text ?? 'Playing locally'
  },
  signedIn(): boolean {
    return Boolean(client()?.status?.()?.signedIn)
  },
  async sync(): Promise<void> {
    await client()?.syncNow?.(GAME_ID)
  },
  openArcade(): void {
    if (typeof window !== 'undefined') window.open(ARCADE_URL, '_blank', 'noopener,noreferrer')
  },
  /** No ads ship in this build; this is the readiness hook for the platform. */
  adsAllowed(): boolean {
    const list = entitlements()
    return !list.includes('arcade.ad_free') && !list.includes('traffic-tangle.ad_free')
  },
  premiumThemes(): boolean {
    const list = entitlements()
    return list.includes('traffic-tangle.premium_themes') || list.includes('arcade.premium')
  },
}
