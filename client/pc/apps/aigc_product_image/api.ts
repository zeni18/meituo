import { getCachedAppData } from '@/apps/cache'
export function getAigcProductImageConfig() {
    return getCachedAppData('app:aigc_product_image:config', () => $request.get({ url: '/app.aigc_product_image.config/detail' }))
}

export function getAigcProductImageCategories(params?: any) {
    return getCachedAppData('app:aigc_product_image:categories', () => $request.get({ url: '/app.aigc_product_image.scene_category/lists', params }), params)
}

export function getAigcProductImageTemplates(params?: any) {
    return getCachedAppData('app:aigc_product_image:templates', () => $request.get({ url: '/app.aigc_product_image.scene_template/lists', params }), params)
}

export function estimateAigcProductImage(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_image.generate/estimate', params }, requestOptions)
}

export function generateAigcProductImage(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_image.generate/index', params }, requestOptions)
}

export function getAigcProductImageTasks(params?: any) {
    return $request.get({ url: '/app.aigc_product_image.task/lists', params })
}

export function getAigcProductImageTask(params: any) {
    return $request.get({ url: '/app.aigc_product_image.task/detail', params })
}

export function deleteAigcProductImageTask(params: any) {
    return $request.post({ url: '/app.aigc_product_image.task/delete', params })
}

export function getAigcProductImageResults(params?: any) {
    return $request.get({ url: '/app.aigc_product_image.result/lists', params })
}

export function deleteAigcProductImageResult(params: any) {
    return $request.post({ url: '/app.aigc_product_image.result/delete', params })
}
