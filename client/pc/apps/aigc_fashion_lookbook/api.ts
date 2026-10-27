import { getCachedAppData } from '@/apps/cache'
export function getAigcFashionLookbookConfig() {
    return getCachedAppData('app:aigc_fashion_lookbook:config', () => $request.get({ url: '/app.aigc_fashion_lookbook.config/detail' }))
}

export function getAigcFashionLookbookModels() {
    return getCachedAppData('app:aigc_fashion_lookbook:models', () => $request.get({ url: '/app.aigc_fashion_lookbook.model/lists' }))
}

export function estimateAigcFashionLookbook(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_fashion_lookbook.generate/estimate', params }, requestOptions)
}

export function generateAigcFashionLookbook(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_fashion_lookbook.generate/index', params }, requestOptions)
}

export function getAigcFashionLookbookTasks(params?: any) {
    return $request.get({ url: '/app.aigc_fashion_lookbook.task/lists', params })
}

export function getAigcFashionLookbookTask(params: any) {
    return $request.get({ url: '/app.aigc_fashion_lookbook.task/detail', params })
}

export function deleteAigcFashionLookbookTask(params: any) {
    return $request.post({ url: '/app.aigc_fashion_lookbook.task/delete', params })
}

export function getAigcFashionLookbookResults(params?: any) {
    return $request.get({ url: '/app.aigc_fashion_lookbook.result/lists', params })
}

export function deleteAigcFashionLookbookResult(params: any) {
    return $request.post({ url: '/app.aigc_fashion_lookbook.result/delete', params })
}
