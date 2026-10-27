export const resolveToolDisplayName = (config: unknown, fallback: string) => {
    const displayConfig = (config as any)?.display_config || {}
    const title = String(displayConfig?.title || '').trim()
    const appCode = String(displayConfig?.app_code || '').trim()
    if (title && title !== appCode) return title
    return fallback
}
