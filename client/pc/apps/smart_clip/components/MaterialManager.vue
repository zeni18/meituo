<template>
    <div class="field-block">
        <div class="field-head">
            <label class="field-label">{{ realman ? '口播视频' : '主素材' }}</label>
            <small>{{ videoUrl ? '已选择' : realman ? '必填' : '可选' }}</small>
        </div>
        <div class="upload-card" :class="{ 'is-filled': !!activeVideoUrl, 'is-uploading': videoUploading }">
            <template v-if="activeVideoUrl">
                <div class="upload-card__stage">
                    <video :src="activeVideoUrl" muted playsinline preload="metadata" />
                </div>
                <div class="upload-card__actions">
                    <button class="upload-card__action" type="button" :disabled="videoUploading" @click="$emit('gallery-video')">图库上传</button>
                    <button class="upload-card__action" type="button" :disabled="videoUploading" @click="$emit('upload-video')">本地上传</button>
                </div>
            </template>
            <template v-else>
                <div class="upload-card__placeholder" @click="!videoUploading && $emit('upload-video')">
                    <img class="upload-card__icon" :src="addIcon" alt="" />
                    <strong>本地上传</strong>
                    <span>mp4 / mov，最长5分钟</span>
                    <button class="upload-card__library" type="button" :disabled="videoUploading" @click.stop="$emit('gallery-video')">图库上传</button>
                </div>
            </template>
            <span v-if="videoUploading" class="upload-mask"><i></i>上传中</span>
        </div>

        <div class="field-head material-head">
            <label class="field-label">素材</label>
            <div class="material-actions">
                <button type="button" :disabled="materialUploading" @click="$emit('gallery-material')">图库上传</button>
                <button type="button" :disabled="materialUploading" @click="$emit('upload-material')">{{ materialUploading ? '上传中' : '添加素材' }}</button>
                <button type="button" :disabled="materialUploading" @click="$emit('upload-audio')">添加音频</button>
            </div>
        </div>
        <div class="material-list">
            <article v-for="(item, index) in materials" :key="`${item.fileUrl}-${index}`" class="material-item" :class="{ 'is-uploading': item.uploading }">
                <div class="material-thumb">
                    <img v-if="item.type === 'image'" :src="materialPreviewUrl(item)" alt="" />
                    <audio v-else-if="item.type === 'audio'" :src="item.fileUrl" controls preload="metadata" />
                    <video v-else :src="materialPreviewUrl(item)" muted playsinline preload="metadata" />
                    <div v-if="item.uploading" class="material-upload-mask">
                        <span class="upload-spinner"></span>
                    </div>
                </div>
                <div>
                    <strong>{{ item.name || materialTypeText(item.type) }}</strong>
                    <span>{{ item.uploading ? '上传中...' : item.duration ? `${item.duration}秒` : item.type === 'image' ? '按2秒计' : '待识别' }}</span>
                </div>
                <label v-if="item.type === 'video'" class="sound-switch"><input v-model="item.soundSwitch" :disabled="item.uploading" type="checkbox" />原声</label>
                <button type="button" @click="$emit('remove', index)">删除</button>
            </article>
            <div v-if="!materials.length" class="empty-inline">暂无素材</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import addIcon from '@/assets/images/icon/Add.svg'

const props = defineProps<{
    realman: boolean
    videoUrl: string
    videoUploadPreview?: string
    videoUploading?: boolean
    materialUploading?: boolean
    materials: any[]
}>()

const activeVideoUrl = computed(() => props.videoUploadPreview || props.videoUrl)

defineEmits<{
    (event: 'upload-video'): void
    (event: 'upload-material'): void
    (event: 'upload-audio'): void
    (event: 'gallery-video'): void
    (event: 'gallery-material'): void
    (event: 'remove', index: number): void
}>()

function materialTypeText(type: string) {
    if (type === 'audio') return '音频素材'
    return type === 'video' ? '视频素材' : '图片素材'
}

function materialPreviewUrl(item: any) {
    return item?.previewUrl || item?.coverUrl || item?.url || item?.fileUrl || ''
}
</script>

<style scoped>
.field-block {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.field-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.field-label {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
}

.field-head small,
.empty-inline {
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
}

.material-head {
    margin-top: 14px;
}

.material-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
}

.material-actions button,
.material-item button {
    height: 34px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition:
        background 0.2s ease,
        color 0.2s ease;
}

.material-actions button:disabled,
.upload-card button:disabled,
.material-item button:disabled {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.55;
}

.material-actions button:hover,
.material-item button:hover {
    background: #3c3c3c;
    color: #fff;
}

.upload-card {
    position: relative;
    display: block;
    height: 176px;
    min-height: 176px;
    border: 0;
    border-radius: 10px;
    background: #262626;
    color: #b8b8b8;
    cursor: pointer;
    overflow: hidden;
    transition:
        background 0.2s ease;
}

.upload-card:hover {
    background: #2c2c2c;
}

.upload-card__stage {
    position: relative;
    width: 100%;
    height: 100%;
    background: #050505;
}

.upload-card__stage video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #050505;
}

.upload-card__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 176px;
    padding: 20px;
    cursor: pointer;
    box-sizing: border-box;
}

.upload-card__icon {
    width: 40px;
    height: 40px;
    object-fit: contain;
}

.upload-card strong {
    color: #b8b8b8;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    text-align: center;
}

.upload-card__placeholder > span:not(.upload-card__icon) {
    color: rgba(255, 255, 255, 0.46);
    font-size: 12px;
}

.upload-card__library,
.upload-card__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    min-width: auto;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #343434;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
}

.upload-card__library:hover,
.upload-card__action:hover {
    background: #3c3c3c;
}

.upload-card__actions {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    background: rgba(5, 5, 5, 0.62);
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
}

.upload-card.is-filled:hover .upload-card__actions {
    opacity: 1;
    pointer-events: auto;
}

.upload-mask,
.material-upload-mask {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 5, 5, 0.62);
    backdrop-filter: blur(2px);
}

.upload-mask {
    gap: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
}

.upload-mask i,
.upload-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.24);
    border-top-color: #fff;
    border-radius: 50%;
    animation: upload-spin 0.72s linear infinite;
}

.material-list {
    display: grid;
    gap: 10px;
}

.material-item {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #0f0f0f;
    box-sizing: border-box;
}

.material-item.is-uploading {
    border-color: rgba(255, 255, 255, 0.08);
}

.material-thumb {
    position: relative;
    width: 76px;
    height: 50px;
    border-radius: 8px;
    background: #050505;
    overflow: hidden;
}

.material-thumb img,
.material-thumb video {
    width: 76px;
    height: 50px;
    background: #050505;
    object-fit: cover;
}

.material-thumb audio {
    width: 76px;
    max-width: 76px;
}

.material-upload-mask .upload-spinner {
    width: 16px;
    height: 16px;
}

.material-item strong {
    display: block;
    min-width: 0;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.material-item span {
    display: block;
    margin-top: 4px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 12px;
}

.sound-switch {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
    white-space: nowrap;
}

.empty-inline {
    display: grid;
    place-items: center;
    min-height: 62px;
    border: 0;
    border-radius: 10px;
    background: #262626;
}

@keyframes upload-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
