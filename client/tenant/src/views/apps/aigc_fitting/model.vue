<template>
    <material-page
        upload-text="上传模特图"
        default-name="模特"
        helper-text="用于 PC 端模特示例筛选，单图上传1张，组图上传2-4张，并配置性别、模特服饰、姿势、VIP、排序和启停"
        show-gender
        :fetch-data="getAigcFittingModels"
        :save-data="setAigcFittingModels"
    />
</template>

<script lang="ts" setup name="tenant-aigc-fitting-model">
import { getAigcFittingModels, setAigcFittingModels } from '@/apps/aigc_fitting/api'
import MaterialPage from './components/material-page.vue'
</script>
