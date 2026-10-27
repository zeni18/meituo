/**
 * @description 获取客户端类型
 */
export function getClient() {
    return useRuntimeConfig().public.client
}

/**
 * @description 获取版本号
 */
export function getVersion() {
    return useRuntimeConfig().public.version
}

/**
 * @description 获取请求域名
 */
export function getApiUrl() {
    const apiUrl = String(useRuntimeConfig().public.apiUrl || '').trim()
    if (apiUrl.includes('undefined') || apiUrl.includes('null')) {
        return ''
    }
    return apiUrl
}

/**
 * @description 获取请求前缀
 */
export function getApiPrefix() {
    const prefix = String(useRuntimeConfig().public.apiPrefix || '').trim()
    if (!prefix || prefix.includes('undefined') || prefix.includes('null')) {
        return '/api'
    }
    return prefix
}

export function getSseApiUrl(path: string) {
    const apiUrl = String(getApiUrl() || '').replace(/\/$/, '')
    const prefix = String(getApiPrefix() || '/api').replace(/\/$/, '')
    const safePath = path.startsWith('/') ? path : `/${path}`
    return `${apiUrl}${prefix}${safePath}`
}
