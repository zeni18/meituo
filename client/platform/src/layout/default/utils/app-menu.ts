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

const promotedMenuIconMap: Record<string, string> = {
    网站信息: 'el-icon-Document',
    系统维护: 'el-icon-SetUp',
    定时任务: 'el-icon-Clock',
    系统日志: 'el-icon-Tickets',
    系统缓存: 'el-icon-Box',
    系统环境: 'el-icon-Monitor'
}

const withFallbackIcon = (route: RouteRecordRaw): RouteRecordRaw => {
    const title = String(route.meta?.title || '')
    const icon = String(route.meta?.icon || promotedMenuIconMap[title] || '')
    if (!icon) {
        return route
    }
    return {
        ...route,
        meta: {
            ...route.meta,
            icon
        }
    }
}

const withoutIcon = (route: RouteRecordRaw): RouteRecordRaw => ({
    ...route,
    meta: {
        ...route.meta,
        icon: ''
    }
})

const isAppCenterRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'core_app_center' || route.meta?.title === '应用管理'

const isAppMarketRoute = (route: RouteRecordRaw) =>
    route.meta?.sourceMenuKey === 'core_app_center_index' ||
    route.path === 'center' ||
    route.meta?.title === '应用中心' ||
    route.meta?.title === '应用市场'

const isSystemSettingRoute = (route: RouteRecordRaw) =>
    route.path === '/setting' || route.path === 'setting' || route.meta?.title === '系统设置'

const isWebsiteSettingRoute = (route: RouteRecordRaw) => route.path === 'website' || route.meta?.title === '网站设置'

const isStorageSettingRoute = (route: RouteRecordRaw) => route.path === 'storage' || route.meta?.title === '存储设置'

export const buildSidebarRoutes = (routes: RouteRecordRaw[]) => {
    const sidebarRoutes: RouteRecordRaw[] = []
    routes.forEach((route) => {
        if (isAppRoute(route)) {
            return
        }

        if (isAppCenterRoute(route)) {
            const marketRoute = (route.children || []).find(isAppMarketRoute)
            if (marketRoute) {
                const appCenterRoute = cloneRouteWithPath(route, route.path)
                appCenterRoute.meta = {
                    ...appCenterRoute.meta,
                    title: '应用中心'
                }
                appCenterRoute.children = [
                    {
                        ...cloneRouteWithPath(marketRoute, resolvePath(route.path, marketRoute.path)),
                        meta: {
                            ...marketRoute.meta,
                            title: '应用市场'
                        }
                    }
                ]
                sidebarRoutes.push(appCenterRoute)
            }
            return
        }

        if (isSystemSettingRoute(route)) {
            const settingChildren = route.children || []
            const storageRoute = settingChildren.find((child) => isVisibleRoute(child) && isStorageSettingRoute(child))
            settingChildren
                .filter(isVisibleRoute)
                .filter((child) => !isStorageSettingRoute(child))
                .forEach((child) => {
                    const nextRoute = withFallbackIcon(
                        cloneRouteWithPath(child, resolvePath(route.path, child.path))
                    )
                    if (storageRoute && isWebsiteSettingRoute(child)) {
                        nextRoute.children = [
                            ...(nextRoute.children || []),
                            withoutIcon(
                                cloneRouteWithPath(
                                    storageRoute,
                                    resolvePath(route.path, storageRoute.path)
                                )
                            )
                        ]
                    }
                    sidebarRoutes.push(nextRoute)
                })
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
