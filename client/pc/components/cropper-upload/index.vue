<template>
    <div class="cropper-upload">
        <div class="cropper-upload__trigger" @click="openCropper">
            <slot />
        </div>
        <input
            ref="fileInputRef"
            class="cropper-upload__file"
            type="file"
            accept="image/*"
            @change="handleFileChange"
        />
        <ClientOnly>
            <ElDialog
                v-model="state.cropperVisible"
                :append-to-body="true"
                :close-on-click-modal="false"
                :width="600"
                :z-index="2147483647"
                @close="state.cropperVisible = false"
            >
                <div class="h-[400px]">
                    <VueCropper
                        ref="vueCropperRef"
                        :img="state.imagePath"
                        :auto-crop="autoCrop"
                        :auto-crop-height="cropHeight"
                        :auto-crop-width="cropWidth"
                        :output-type="outputType"
                    />
                </div>
                <template #footer>
                    <span class="dialog-footer">
                        <ElButton
                            type="primary"
                            :loading="state.uploading"
                            @click="handleConfirmCropper"
                        >
                            {{ state.uploading ? '上传中…' : '确认裁剪' }}
                        </ElButton>
                    </span>
                </template>
            </ElDialog>
        </ClientOnly>
    </div>
</template>

<script lang="ts" setup>
import { nextTick } from 'vue'
import { ElDialog, ElButton } from 'element-plus'
import 'vue-cropper/dist/index.css'
import { VueCropper } from 'vue-cropper'
import { uploadImage } from '~~/api/app'
import feedback from '@/utils/feedback'

const props = withDefaults(
    defineProps<{
        source?: string
        cropWidth?: number
        cropHeight?: number
        autoCrop?: boolean
        outputType?: string
        fileName?: string
    }>(),
    {
        source: '',
        cropWidth: 200,
        cropHeight: 200,
        autoCrop: true,
        outputType: 'png',
        fileName: 'image'
    }
)

const emit = defineEmits(['change'])
const vueCropperRef = shallowRef()
const fileInputRef = shallowRef<HTMLInputElement>()

const state = reactive({
    cropperVisible: false,
    uploading: false,
    imagePath: ''
})

const openCropper = () => {
    if (props.source) {
        void openImage(props.source)
        return
    }
    fileInputRef.value?.click()
}

const openImage = async (source: string, rotateSteps = 0) => {
    if (!source) return
    state.imagePath = source
    state.cropperVisible = true
    if (!rotateSteps) return
    await nextTick()
    for (let step = 0; step < Math.abs(rotateSteps); step += 1) {
        if (rotateSteps > 0) vueCropperRef.value?.rotateRight?.()
        else vueCropperRef.value?.rotateLeft?.()
    }
}

const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const URL = window.URL || window.webkitURL
    state.imagePath = URL.createObjectURL(file)
    state.cropperVisible = true
    // 允许相同文件再次被选中
    input.value = ''
}

const handleConfirmCropper = () => {
    if (state.uploading) return
    const cropper = vueCropperRef.value
    if (!cropper) return

    state.uploading = true
    cropper.getCropBlob(async (file: Blob) => {
        try {
            const ext = (file.type.split('/')[1] || 'png').toLowerCase()
            const fileName = `${props.fileName || 'image'}.${ext}`
            const imgFile = new window.File([file], fileName, {
                type: file.type
            })
            const data = await uploadImage({ file: imgFile })
            const uri = data?.uri
            if (!uri) {
                feedback.msgError('上传失败：服务器未返回图片地址')
                return
            }
            state.cropperVisible = false
            emit('change', uri)
        } catch (err: any) {
            const msg =
                typeof err === 'string'
                    ? err
                    : err?.message || err?.msg || '上传失败，请重试'
            feedback.msgError(msg)
        } finally {
            state.uploading = false
        }
    })
}

defineExpose({ openImage })
</script>

<style lang="scss" scoped>
.cropper-upload {
    display: inline-block;
}

.cropper-upload__trigger {
    display: inline-flex;
    cursor: pointer;
}

.cropper-upload__file {
    display: none;
}
</style>
