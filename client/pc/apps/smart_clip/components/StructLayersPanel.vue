<template>
    <div class="layer-grid">
        <label v-for="item in layerOptions" :key="item.key">
            <input :checked="enabled(item)" :disabled="!available(item)" type="checkbox" @change="toggle(item)" />
            {{ item.label }}
        </label>
    </div>
</template>

<script lang="ts" setup>
const props = defineProps<{ layers: any[]; availableCodes?: string[] }>()

const layerOptions = [
    { key: 'title', markCode: 'headerLayer', label: '标题图层' },
    { key: 'subtitle', markCode: 'subtitleLayer', label: '字幕图层' },
    { key: 'introduceCard', markCode: 'ipLayer', label: '身份栏图层' },
    { key: 'background', markCode: 'backgroundLayer', label: '背景图层' },
    { key: 'digitalHuman', markCode: 'figureLayer', label: '数字人图层' }
]

function enabled(option: { key: string; markCode: string }) {
    return props.layers.some((item) => (item.key === option.key || item.markCode === option.markCode) && item.visible !== false)
}

function available(option: { markCode: string }) {
    return !props.availableCodes?.length || props.availableCodes.includes(option.markCode)
}

function toggle(option: { key: string; markCode: string }) {
    if (!available(option)) return
    const exists = props.layers.find((item) => item.key === option.key || item.markCode === option.markCode)
    if (exists) {
        exists.visible = exists.visible === false
        exists.key = option.key
        exists.markCode = option.markCode
        return
    }
    props.layers.push({ key: option.key, markCode: option.markCode, visible: true })
}
</script>

<style scoped>
.layer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 10px;
}

.layer-grid label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid #222;
    border-radius: 8px;
    background: #0f0f0f;
    color: rgba(255, 255, 255, 0.76);
    font-size: 14px;
    box-sizing: border-box;
}

.layer-grid label:has(input:disabled) {
    color: rgba(255, 255, 255, 0.34);
}

.layer-grid input {
    accent-color: #fff;
}
</style>
