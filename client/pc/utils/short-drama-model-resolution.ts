export type ShortDramaResolutionOption = {
    value: string
    label: string
}

type ResolutionCapableModel = {
    default_quality?: unknown
    quality_options?: unknown
    resolution_options?: unknown
}

const normalizeOption = (item: unknown): ShortDramaResolutionOption | null => {
    if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item).trim()
        return value ? { value, label: value } : null
    }
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const value = String(row.value ?? row.quality ?? row.resolution ?? '').trim()
    if (!value) return null
    const label = String(row.label ?? row.name ?? row.resolution_label ?? value).trim()
    return { value, label: label || value }
}

export const shortDramaResolutionOptions = (model?: ResolutionCapableModel | null): ShortDramaResolutionOption[] => {
    const source = Array.isArray(model?.resolution_options)
        ? model.resolution_options
        : (Array.isArray(model?.quality_options) ? model.quality_options : [])
    const seen = new Set<string>()
    return source
        .map(normalizeOption)
        .filter((item): item is ShortDramaResolutionOption => Boolean(item && !seen.has(item.value) && seen.add(item.value)))
}

export const resolveShortDramaResolution = (model?: ResolutionCapableModel | null, current = ''): string => {
    const options = shortDramaResolutionOptions(model)
    const selected = String(current || '').trim()
    if (selected && options.some((item) => item.value === selected)) return selected
    const fallback = String(model?.default_quality || '').trim()
    if (fallback && options.some((item) => item.value === fallback)) return fallback
    return options[0]?.value || ''
}
