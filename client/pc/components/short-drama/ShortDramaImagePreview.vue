<template>
    <button class="short-drama-image-preview" type="button" :aria-label="previewLabel" @click.stop="openPreview">
        <img class="short-drama-image-preview__image" :src="src" :alt="alt" />
    </button>

    <Teleport to="body">
        <div v-if="visible" class="short-drama-preview-modal" @click.self="closePreview">
            <button class="short-drama-preview-modal__close" type="button" aria-label="Close preview" @click="closePreview">
                X
            </button>
            <img class="short-drama-preview-modal__image" :src="src" :alt="alt" />
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
    src: string
    alt?: string
    label?: string
}>()

const visible = ref(false)
const previewLabel = computed(() => props.label || 'Open image preview')

const openPreview = () => {
    if (!props.src) return
    visible.value = true
}

const closePreview = () => {
    visible.value = false
}
</script>

<style scoped lang="scss">
.short-drama-image-preview {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: zoom-in;
}

.short-drama-image-preview__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.short-drama-preview-modal {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
    background: rgba(0, 0, 0, 0.84);
    box-sizing: border-box;
    cursor: zoom-out;
}

.short-drama-preview-modal__image {
    display: block;
    max-width: 92vw;
    max-height: 88vh;
    border-radius: 8px;
    object-fit: contain;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
    cursor: default;
}

.short-drama-preview-modal__close {
    position: fixed;
    top: 24px;
    right: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
}
</style>
