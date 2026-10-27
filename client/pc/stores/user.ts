import { getUserCenter } from '@/api/user'
import { TOKEN_KEY } from '@/enums/cacheEnums'
import { defineStore } from 'pinia'
import { invalidatePcRequestCache, usePcRequestCache } from '@/composables/usePcRequestCache'

const USER_CACHE_TTL = 30 * 1000
const TOKEN_COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30
}

const getTokenCookie = () => useCookie<string | null>(TOKEN_KEY, TOKEN_COOKIE_OPTIONS)

export const getStoredUserToken = () => {
    const tokenCookie = getTokenCookie()
    const cookieToken = tokenCookie.value ? String(tokenCookie.value) : ''
    if (cookieToken) return cookieToken
    if (import.meta.client) {
        try {
            return window.localStorage.getItem(TOKEN_KEY) || ''
        } catch (_error) {
            return ''
        }
    }
    return ''
}

const setStoredUserToken = (token: string) => {
    const tokenCookie = getTokenCookie()
    tokenCookie.value = token
    if (import.meta.client) {
        try {
            window.localStorage.setItem(TOKEN_KEY, token)
        } catch (_error) {
            // localStorage can be unavailable in private or restricted contexts.
        }
    }
}

const clearStoredUserToken = () => {
    const tokenCookie = getTokenCookie()
    tokenCookie.value = null
    if (import.meta.client) {
        try {
            window.localStorage.removeItem(TOKEN_KEY)
        } catch (_error) {
            // Ignore storage cleanup failures; the cookie is still cleared.
        }
    }
}

interface UserSate {
    userInfo: Record<string, any>
    token: string | null
    temToken: string | null
    avatarVersion: number
}
export const useUserStore = defineStore({
    id: 'userStore',
    state: (): UserSate => {
        return {
            userInfo: {},
            token: getStoredUserToken() || null,
            temToken: null,
            avatarVersion: Date.now()
        }
    },
    getters: {
        isLogin: (state) => !!state.token
    },
    actions: {
        async getUser(force = false) {
            const cacheKey = `pc:user:center:${this.token || 'guest'}`
            const data = await usePcRequestCache(cacheKey, () => getUserCenter(), {
                ttl: USER_CACHE_TTL,
                force,
                staleWhileRevalidate: true
            })
            this.userInfo = data
            this.avatarVersion = Date.now()
        },
        setUser(userInfo) {
            this.userInfo = userInfo
            this.avatarVersion = Date.now()
        },
        restoreToken() {
            const token = getStoredUserToken()
            if (token && !this.token) {
                this.token = token
            }
            return this.token
        },
        login(token: string) {
            const normalizedToken = String(token || '').trim()
            if (!normalizedToken) return
            this.token = normalizedToken
            setStoredUserToken(normalizedToken)
            invalidatePcRequestCache('pc:user:center:')
        },
        logout() {
            this.token = null
            this.userInfo = {}
            this.avatarVersion = Date.now()
            clearStoredUserToken()
            invalidatePcRequestCache()
        }
    }
})
