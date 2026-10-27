export function getAigcProductPromoVideoConfig() {
    return $request.get({ url: '/app.aigc_product_promo_video.config/detail' })
}

export function getAigcProductPromoVideoTypes() {
    return $request.get({ url: '/app.aigc_product_promo_video.type/lists' })
}

export function writeAigcProductPromoVideoPrompt(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.prompt/write', params }, requestOptions)
}

export function optimizeAigcProductPromoVideoPrompt(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.prompt/optimize', params }, requestOptions)
}

export function estimateAigcProductPromoVideo(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.generate/estimate', params }, requestOptions)
}

export function generateAigcProductPromoVideo(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.generate/index', params }, requestOptions)
}

export function getAigcProductPromoVideoTasks(params?: any) {
    return $request.get({ url: '/app.aigc_product_promo_video.task/lists', params })
}

export function getAigcProductPromoVideoTask(params: any) {
    return $request.get({ url: '/app.aigc_product_promo_video.task/detail', params })
}

export function deleteAigcProductPromoVideoTask(params: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.task/delete', params })
}

export function getAigcProductPromoVideoResults(params?: any) {
    return $request.get({ url: '/app.aigc_product_promo_video.result/lists', params })
}

export function deleteAigcProductPromoVideoResult(params: any) {
    return $request.post({ url: '/app.aigc_product_promo_video.result/delete', params })
}
