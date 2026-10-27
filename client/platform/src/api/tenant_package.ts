import request from '@/utils/request'

export function tenantPackageLists(params?: any) {
    return request.get({ url: '/tenant.package/lists', params }, { ignoreCancelToken: true })
}

export function tenantPackageDetail(params?: any) {
    return request.get({ url: '/tenant.package/detail', params })
}

export function tenantPackageAdd(params?: any) {
    return request.post({ url: '/tenant.package/add', params })
}

export function tenantPackageEdit(params?: any) {
    return request.post({ url: '/tenant.package/edit', params })
}

export function tenantPackageDelete(params?: any) {
    return request.post({ url: '/tenant.package/delete', params })
}

export function tenantPackageAppPlans(params?: any) {
    return request.get({ url: '/tenant.package/appPlans', params }, { ignoreCancelToken: true })
}

export function tenantPackageQuotaOrders(params?: any) {
    return request.get({ url: '/tenant.package/quotaOrders', params }, { ignoreCancelToken: true })
}

export function tenantPackageBrandOrders(params?: any) {
    return request.get({ url: '/tenant.package/brandOrders', params }, { ignoreCancelToken: true })
}

