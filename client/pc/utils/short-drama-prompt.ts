const replacementMarks = /[\uFFFD\u25A1\u25AF\u25A0\u25A3\u25A4\u25A6\u25A7\u25A8\u25A9]/g

const labelReplacements: Array<[RegExp, string]> = [
    [/^user request\s*:\s*/i, '用户补充要求：'],
    [/^shot type\s*:\s*/i, '景别：'],
    [/^angle\s*:\s*/i, '角度：'],
    [/^camera movement\s*:\s*/i, '运镜调度：'],
    [/^composition\s*:\s*/i, '构图设计：'],
    [/^visible action\s*:\s*/i, '动作：'],
    [/^result\s*:\s*/i, '结果：'],
    [/^atmosphere\s*:\s*/i, '氛围：'],
    [/^dialogue or narration cue\s*:\s*/i, '对白或旁白提示：'],
    [/^dialogue or dubbing cue\s*:\s*/i, '对白或配音提示：'],
    [/^background music mood\s*:\s*/i, '背景音乐情绪：'],
    [/^duration target\s*:\s*(\d+(?:\.\d+)?)\s*seconds?$/i, '时长目标：$1秒'],
    [/^0-3s\s*:\s*/i, '0-3秒：'],
    [/^3-6s\s*:\s*/i, '3-6秒：']
]

const englishTermReplacements: Array<[RegExp, string]> = [
    [/exteriorexterior/ig, '室外'],
    [/interiorinterior/ig, '室内'],
    [/exterior\s+exterior/ig, '室外'],
    [/interior\s+interior/ig, '室内'],
    [/\bexterior\b/ig, '室外'],
    [/\binterior\b/ig, '室内'],
    [/\beye[-\s]?level\b/ig, '平视'],
    [/\blow[-\s]?angle\b/ig, '低角度'],
    [/\bhigh[-\s]?angle\b/ig, '高角度'],
    [/\boverhead\b/ig, '俯拍'],
    [/\bbird'?s[-\s]?eye\b/ig, '俯视'],
    [/\bclose[-\s]?up\b/ig, '特写'],
    [/\bmedium[-\s]?shot\b/ig, '中景'],
    [/\bwide[-\s]?shot\b/ig, '远景'],
    [/\blong[-\s]?shot\b/ig, '远景'],
    [/\btracking[-\s]?shot\b/ig, '跟拍'],
    [/\bdolly[-\s]?in\b/ig, '推镜'],
    [/\bdolly[-\s]?out\b/ig, '拉镜'],
    [/\bpan\b/ig, '横摇'],
    [/\btilt\b/ig, '俯仰'],
    [/\bhandheld\b/ig, '手持镜头'],
    [/\bstatic[-\s]?shot\b/ig, '固定镜头'],
    [/\bslow[-\s]?motion\b/ig, '慢动作']
]

const internalLinePatterns = [
    /^(system|developer|assistant|provider|schema|json schema|negative prompt|prompt schema)\s*[:：]/i,
    /(api[_ -]?key|endpoint|provider payload|system prompt|json schema|schema|内部|内置|机密|密钥)/i,
    /^use provided .*(reference image|reference images).*$/i,
    /^use the (first|last) reference image.*$/i,
    /^maintain subject identity.*$/i,
    /^keep subject identity.*$/i,
    /^strictly follow .*reference.*$/i,
    /生成一张.*统一参考图/,
    /必须严格以当前输入为唯一依据/,
    /当前输入.*唯一/,
    /参考图.*为准/,
    /基于参考图生成.*(三视图|设定图)/,
    /标准(正面|侧面|背面).*三视图/,
    /保持同一张脸|保持同一个物品|保持角色身份|保持主体身份/,
    /保持.*参考图.*一致/,
    /不要额外生成|不要出现|不要字幕|不要水印|无关装饰|重复脸部|大头特写|半身像|字幕|水印/,
    /背景为纯白或浅灰/,
    /只呈现物品本身/,
    /禁止.*(文字|字幕|水印|logo|标识)/i,
    /\b(no|without)\s+(burned-in\s+)?(text|subtitle|watermark|logo)s?\b/i,
    /\b(reference image|reference images|subject reference|scene reference)\b/i
]

const visibleLabelPattern = /^\s*(分镜|景别|角度|构图设计|构图|可见动作|动作|画面内容|画面结果|结果|氛围|场景|时间|运镜调度|运镜手法|声音|对白或配音提示|对白或旁白提示|背景音乐情绪)\s*[:：]\s*/i
const visibleLabelLinePattern = /^\s*(分镜|景别|角度|构图设计|构图|可见动作|动作|画面内容|画面结果|结果|氛围|场景|时间|运镜调度|运镜手法|声音|对白或配音提示|对白或旁白提示|背景音乐情绪)\s*[:：]\s*(.+?)\s*$/i

const emptyLabelPatterns = [
    /^\s*(分镜|景别|角度|构图设计|构图|可见动作|动作|画面内容|画面结果|结果|氛围|场景|时间|运镜调度|运镜手法|声音|背景音乐情绪|对白或配音提示|对白或旁白提示|时长目标)\s*[:：]\s*$/i
]

const hiddenVisibleLinePatterns = [
    /^\s*执行补充\s*[:：]/i,
    /^\s*当前绑定(?:场景|主体)\s*[:：]/i,
    /^\s*(?:首帧约束|尾帧约束|固定要求)\s*[:：]/i,
    /^\s*画面内容\s*[:：]\s*分镜[一二三四五六七八九十百千万\d]+(?:\s*[:：、\-].*)?$/i,
    /^\s*<duration-ms>\s*\d+\s*<\/duration-ms>\s*$/i,
    /^\s*<\/?(?:role|location)(?:\s+[^>]*)?>.*$/i,
    /^\s*(时长目标|duration target)\s*[:：]/i,
    /^\s*(镜头|镜头类型|画面类型|shot)\s*[:：]/i,
    /^\s*镜.{0,4}\s*[:：]\s*空镜\s*$/i,
    /^\s*\d+(?:\.\d+)?\s*(秒|s|seconds?)\s*$/i
]

const hiddenVisibleSegmentPatterns = [
    /<duration-ms>\s*\d+\s*<\/duration-ms>/gi,
    /当前绑定(?:场景|主体)\s*[:：][^\r\n。]*(?:。)?/g,
    /(?:首帧约束|尾帧约束|固定要求)\s*[:：][^\r\n]*(?:\r?\n|$)/g,
    /<\/?(?:role|location)(?:\s+[^>]*)?>[^<\r\n]*(?:<\/(?:role|location)>)?/gi
]

const displayOnlyHiddenLinePatterns = [
    /^\s*用户补充要求\s*[:：]/i,
    /^\s*必须使用已提供的首帧参考图/i,
    /^\s*第一帧必须与首帧参考图/i,
    /^\s*保持(?:人物|角色|主体|场景|服装|道具|光线|镜头|美术风格|身份|风格).*一致/i,
    /^(?:保持|不得|不要|禁止).*?(字幕|背景音乐|水印|文字|新增角色|修改|改变)/i,
    /(?:无字幕|无背景音乐|水印|文字|新增角色)/i
]

const noSubjectPatterns = [
    /不要(?:出现)?(?:任何)?(?:人物|人类|角色|脸|面部|身体|肖像|人像)/,
    /(?:禁止|避免)(?:出现)?(?:人物|人类|角色|脸|面部|身体|肖像|人像)/,
    /(?:无|没有)(?:人物|人类|角色|脸|面部|身体|肖像|人像)/,
    /\b(no|without)\s+(people|person|human|character|face|body|portrait)s?\b/i
]

const splitLines = (text: string) => String(text || '').split(/\r?\n/)

const stripHiddenVisibleSegments = (text: string) => {
    let next = String(text || '')
    hiddenVisibleSegmentPatterns.forEach((pattern) => {
        next = next.replace(pattern, '\n')
    })
    return next
}

export const stripPromptNoise = (text: string) => {
    return stripHiddenVisibleSegments(text)
        .replace(/风[\uFFFD\uFFFC\uFFFE\uFFFF\u25C6\u2756]/g, '风格')
        .replace(replacementMarks, '')
        .replace(/[\uFFFC\uFFFE\uFFFF\u25C6\u2756]/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

const stripShotSectionPrefix = (text: string) => {
    let next = String(text || '').trim()
    if (/^\s*分镜\s*[^：:\s]*\s*[：:]\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/u.test(next)) {
        return next
    }
    for (let index = 0; index < 3; index += 1) {
        const stripped = next.replace(/^\s*(?:第\s*[一二三四五六七八九十百千万\d]+\s*(?:幕|场|镜|分镜)|分镜\s*[一二三四五六七八九十百千万\d]+)\s*[：:]\s*/u, '')
        if (stripped === next) break
        next = stripped.trim()
    }
    return next
}

const normalizePromptLine = (line: string) => {
    let next = stripPromptNoise(line)
    labelReplacements.forEach(([pattern, replacement]) => {
        next = next.replace(pattern, replacement)
    })
    englishTermReplacements.forEach(([pattern, replacement]) => {
        next = next.replace(pattern, replacement)
    })
    next = next.replace(/(室内)\1+/g, '$1').replace(/(室外)\1+/g, '$1')
    return stripShotSectionPrefix(next)
}

const comparablePromptText = (text: string) => {
    return normalizePromptLine(text)
        .replace(visibleLabelPattern, '')
        .replace(/^@[^，。！？、；：,.!?;:\s]+/u, '')
        .replace(/[，。！？、；：,.!?;:\s"'“”‘’（）()[\]{}《》<>-]/g, '')
        .toLowerCase()
}

const promptComparableOverlap = (current: string, candidate: string) => {
    if (!current || !candidate) return false
    if (current === candidate) return true
    const shorter = current.length <= candidate.length ? current : candidate
    const longer = current.length > candidate.length ? current : candidate
    if (shorter.length < 12) return false
    return longer.includes(shorter)
}

const stripLooseActPrefix = (text: string) => {
    return String(text || '')
        .replace(/^\s*(开端|起始|发展|推进|转折|冲突|高潮|反转|结局|收束|尾声)\s*[：:，,、\s]+/u, '')
        .trim()
}

const stripEndingPunctuation = (text: string) => String(text || '').replace(/[。.!！?？；;，,、\s]+$/u, '').trim()

const genericVideoResultPatterns = [
    /^画面停留在(?:清晰可见的)?(?:动作|表情|关键细节|动作、表情或关键细节)上?。?$/u,
    /^清晰可见的?(?:动作|表情|关键细节|动作、表情或关键细节)。?$/u,
    /^保持(?:画面)?清晰(?:可见)?。?$/u
]

const parsedVisibleLabelLines = (lines: string[]) => {
    return lines.map((line) => {
        const match = line.match(visibleLabelLinePattern)
        if (!match) return null
        return {
            label: match[1],
            value: stripLooseActPrefix(match[2])
        }
    }).filter((item): item is { label: string; value: string } => !!item?.value)
}

const compactLabeledVideoPromptLines = (lines: string[]) => {
    const labels = parsedVisibleLabelLines(lines)
    if (!labels.length) return lines.join('\n')
    const byLabel = (names: string[]) => labels.find((item) => names.includes(item.label))?.value || ''
    const shotType = byLabel(['景别'])
    const angle = byLabel(['角度'])
    const movement = byLabel(['运镜调度'])
    const action = byLabel(['动作', '可见动作'])
    const result = byLabel(['画面结果', '结果'])
    const atmosphere = byLabel(['氛围', '场景', '构图设计', '构图'])
    const nonLabelLines = lines.filter((line) => !visibleLabelLinePattern.test(line))
    const fragments = [
        [shotType ? `${stripEndingPunctuation(shotType)}镜头` : '', angle ? `${stripEndingPunctuation(angle)}视角` : ''].filter(Boolean).join('，'),
        movement,
        action,
        genericVideoResultPatterns.some((pattern) => pattern.test(result)) ? '' : result,
        atmosphere
    ]
        .map((item) => stripEndingPunctuation(item))
        .filter(Boolean)
    const deduped = [...nonLabelLines, ...fragments].reduce<string[]>((resultLines, item) => {
        const comparable = comparablePromptText(item)
        if (!comparable) return resultLines
        if (resultLines.some((line) => promptComparableOverlap(comparablePromptText(line), comparable))) return resultLines
        resultLines.push(item)
        return resultLines
    }, [])
    if (!deduped.length) return lines.join('\n')
    return `${deduped.join('。')}。`
}

const lineMatchesRemoveItem = (line: string, removeItems: Set<string>) => {
    if (!removeItems.size) return false
    const comparableLine = comparablePromptText(line)
    return Array.from(removeItems).some((item) => {
        const cleanItem = stripPromptNoise(item)
        if (!cleanItem) return false
        const comparableItem = comparablePromptText(cleanItem)
        return line === cleanItem || comparableLine === comparableItem
    })
}

const preferOverallDescriptionLines = (text: string) => {
    const normalizedLines = splitLines(text).map(normalizePromptLine).filter(Boolean)
    const hasOverallDescription = normalizedLines.some((line) => !visibleLabelPattern.test(line) && comparablePromptText(line).length >= 12)
    if (!hasOverallDescription && parsedVisibleLabelLines(normalizedLines).length) {
        return compactLabeledVideoPromptLines(normalizedLines)
    }
    const keptLines: string[] = []
    const keptComparable: string[] = []

    normalizedLines.forEach((line) => {
        const comparable = comparablePromptText(line)
        const isLabeledDetail = visibleLabelPattern.test(line)
        const duplicateIndex = comparable.length >= 8
            ? keptComparable.findIndex((item) => promptComparableOverlap(item, comparable))
            : -1
        const isDuplicatedByEarlierOverall = duplicateIndex >= 0
        if (!line || isDuplicatedByEarlierOverall) return
        if (hasOverallDescription && isLabeledDetail) return
        keptLines.push(line)
        keptComparable.push(comparable)
    })

    return keptLines.join('\n')
}

export const isInternalPromptLine = (line: string) => {
    const normalized = normalizePromptLine(line)
    if (!normalized) return false
    return internalLinePatterns.some((pattern) => pattern.test(normalized))
}

export const extractInternalPrompt = (text: string) => {
    const lines = splitLines(text)
        .map(normalizePromptLine)
        .filter((line) => line && isInternalPromptLine(line))
    return Array.from(new Set(lines)).join('\n')
}

export const cleanUserVisiblePrompt = (text: string, options: {
    removeItems?: Array<string | undefined | null>
    removeNoSubjectLines?: boolean
} = {}) => {
    const removeSet = new Set((options.removeItems || [])
        .map((item) => stripPromptNoise(String(item || '')))
        .filter(Boolean))
    const lines = splitLines(text)
        .map(normalizePromptLine)
        .filter((line) => {
            if (!line || lineMatchesRemoveItem(line, removeSet)) return false
            if (emptyLabelPatterns.some((pattern) => pattern.test(line))) return false
            if (hiddenVisibleLinePatterns.some((pattern) => pattern.test(line))) return false
            // A visible field may include internal constraints after its actual scene description.
            if (isInternalPromptLine(line) && !visibleLabelLinePattern.test(line)) return false
            if (options.removeNoSubjectLines && noSubjectPatterns.some((pattern) => pattern.test(line))) return false
            return true
        })
    return Array.from(new Set(lines)).join('\n')
}

export const cleanVisibleImagePrompt = (text: string, removeItems: Array<string | undefined | null> = []) => {
    return cleanUserVisiblePrompt(text, { removeItems })
}

export const cleanVisibleVideoPrompt = (
    text: string,
    keepNoSubjectConstraints = true,
    removeItems: Array<string | undefined | null> = []
) => {
    return cleanUserVisiblePrompt(text, {
        removeItems,
        removeNoSubjectLines: !keepNoSubjectConstraints
    })
}

export const cleanUserDisplayPrompt = (text: string, options: {
    removeItems?: Array<string | undefined | null>
    removeNoSubjectLines?: boolean
} = {}) => {
    const lines = splitLines(cleanUserVisiblePrompt(text, options))
        .map(normalizePromptLine)
        .map((line) => line.replace(/^\s*(?:生成|制作)\s*\d+(?:\.\d+)?\s*秒(?:视频|镜头|片段)\s*[:：]\s*/u, '').trim())
        .filter((line) => line && !displayOnlyHiddenLinePatterns.some((pattern) => pattern.test(line)))
    return preferOverallDescriptionLines(Array.from(new Set(lines)).join('\n'))
}

export const cleanVisibleVideoDisplayPrompt = (
    text: string,
    keepNoSubjectConstraints = true,
    removeItems: Array<string | undefined | null> = []
) => {
    return cleanUserDisplayPrompt(text, {
        removeItems,
        removeNoSubjectLines: !keepNoSubjectConstraints
    })
}

export const composePromptForSubmit = (visiblePrompt: string, internalPrompt = '') => {
    const visible = cleanUserVisiblePrompt(visiblePrompt)
    const internal = splitLines(internalPrompt)
        .map(normalizePromptLine)
        .filter(Boolean)
        .join('\n')
    return [visible, internal].filter(Boolean).join('\n')
}
