import type { RouteRecordRaw } from 'vue-router'

import { MenuEnum } from '@/enums/appEnums'
import { getNormalPath } from '@/utils/util'
import { isExternal } from '@/utils/validate'

export interface AppMenuItem {
    title: string
    path: string
    active: boolean
    children?: AppMenuItem[]
}

export interface CurrentAppMenu {
    title: string
    items: AppMenuItem[]
    activeTitles: string[]
}

const isAppRoute = (route: RouteRecordRaw) =>
    route.meta?.source === 'app' && route.meta?.appCode && route.meta?.appCode !== 'system_default'

const isMainSidebarAppRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'aigc_image_case' || route.meta?.sourceMenuKey === 'core_tenant_case_gallery'

const isVisibleRoute = (route: RouteRecordRaw) => !route.meta?.hidden

const resolvePath = (basePath: string, path: string) => {
    if (isExternal(path)) {
        return path
    }
    if (path.startsWith('/')) {
        return getNormalPath(path)
    }
    return getNormalPath(`${basePath}/${path}`)
}

const cloneRouteWithPath = (route: RouteRecordRaw, path: string): RouteRecordRaw => ({
    ...route,
    meta: route.meta ? { ...route.meta } : undefined,
    path,
    children: route.children ? [...route.children] : undefined
})

const isAppMarketRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'core_tenant_app_market' ||
    route.path === 'market' ||
    route.meta?.title === '应用市场'

const isTenantMyAppRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'core_tenant_my_app' ||
    route.path === 'my' ||
    route.meta?.title === '我的应用'

const isSystemAppRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'core_tenant_system_default' ||
    route.meta?.appCode === 'system_default' ||
    route.meta?.title === '系统应用'

export const buildSidebarRoutes = (routes: RouteRecordRaw[]) => {
    const sidebarRoutes: RouteRecordRaw[] = []
    routes.forEach((route) => {
        if (isAppRoute(route) && !isMainSidebarAppRoute(route)) {
            return
        }

        if (route.meta?.sourceMenuKey === 'core_tenant_app_center' || route.meta?.title === '应用管理') {
            const children = route.children || []
            const marketRoute = children.find(isAppMarketRoute)
            if (marketRoute) {
                const appCenterRoute = cloneRouteWithPath(route, route.path)
                appCenterRoute.meta = {
                    ...appCenterRoute.meta,
                    title: '应用中心'
                }
                appCenterRoute.children = [
                    cloneRouteWithPath(marketRoute, resolvePath(route.path, marketRoute.path))
                ]
                sidebarRoutes.push(appCenterRoute)
            }
            const systemRoute = children.find(isSystemAppRoute)
            if (systemRoute) {
                sidebarRoutes.push(cloneRouteWithPath(systemRoute, resolvePath(route.path, systemRoute.path)))
            }
            const restChildren = children.filter(
                (item) => !isSystemAppRoute(item) && !isAppMarketRoute(item) && !isTenantMyAppRoute(item)
            )
            if (restChildren.length > 0) {
                sidebarRoutes.push({
                    ...route,
                    children: restChildren
                })
            }
            return
        }

        sidebarRoutes.push(route)
    })
    return sidebarRoutes
}

const routeMatchesPath = (routePath: string, currentPath: string) =>
    currentPath === routePath || currentPath.startsWith(`${routePath}/`)

const findFirstVisiblePath = (route: RouteRecordRaw, basePath: string): string => {
    const currentPath = resolvePath(basePath, route.path)
    if (route.meta?.type === MenuEnum.MENU && isVisibleRoute(route)) {
        return currentPath
    }
    for (const child of route.children || []) {
        const childPath = findFirstVisiblePath(child, currentPath)
        if (childPath) {
            return childPath
        }
    }
    return isVisibleRoute(route) ? currentPath : ''
}

const hasActiveChild = (route: RouteRecordRaw, basePath: string, currentPath: string) => {
    const fullPath = resolvePath(basePath, route.path)
    if (routeMatchesPath(fullPath, currentPath)) {
        return true
    }
    return (route.children || []).some((child) => hasActiveChild(child, fullPath, currentPath))
}

const buildAppMenuItem = (
    route: RouteRecordRaw,
    basePath: string,
    currentPath: string
): AppMenuItem | null => {
    if (!isVisibleRoute(route)) {
        return null
    }
    const currentRoutePath = resolvePath(basePath, route.path)
    const children = (route.children || [])
        .map((child) => buildAppMenuItem(child, currentRoutePath, currentPath))
        .filter((item): item is AppMenuItem => !!item)
    const title = String(route.meta?.title || '')
    const path = findFirstVisiblePath(route, basePath) || currentRoutePath
    if (!title || !path) {
        return null
    }
    return {
        title,
        path,
        active: hasActiveChild(route, basePath, currentPath),
        children: children.length ? children : undefined
    }
}

const findActiveTitles = (items: AppMenuItem[]): string[] => {
    for (const item of items) {
        if (!item.active) {
            continue
        }
        const childTitles = item.children ? findActiveTitles(item.children) : []
        return [item.title, ...childTitles]
    }
    return []
}

export const getCurrentAppMenu = (routes: RouteRecordRaw[], currentPath: string): CurrentAppMenu | null => {
    const appRoute = routes.find((route) => isAppRoute(route) && hasActiveChild(route, '', currentPath))
    if (!appRoute) {
        return null
    }

    const rootPath = resolvePath('', appRoute.path)
    const items = (appRoute.children || [])
        .map((child) => buildAppMenuItem(child, rootPath, currentPath))
        .filter((item): item is AppMenuItem => !!item)

    return {
        title: String(appRoute.meta?.title || ''),
        items,
        activeTitles: findActiveTitles(items)
    }
}

export const getAppManagePath = (routes: RouteRecordRaw[], appCode: string) => {
    const appRoute = routes.find((route) => isAppRoute(route) && route.meta?.appCode === appCode)
    if (!appRoute) {
        return ''
    }
    const rootPath = resolvePath('', appRoute.path)
    return findFirstVisiblePath(appRoute, '') || rootPath
}
