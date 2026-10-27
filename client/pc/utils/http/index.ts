import { FetchOptions } from 'ofetch'
import { RequestCodeEnum, RequestMethodsEnum } from '@/enums/requestEnums'
import feedback from '@/utils/feedback'
import { merge } from 'lodash-es'
import { Request } from './request'
import { getApiPrefix, getApiUrl, getVersion } from '../env'
import { getStoredUserToken, useUserStore } from '@/stores/user'
import { usePcLoginGate } from '@/composables/usePcLoginGate'
import { parseTenantIdFromRoute } from '../tenant'

const SYSTEM_ERROR_PATTERNS = [
    /unserialize\(\)/i,
    /Error at offset/i,
    /stack trace/i,
    /SQLSTATE/i
]

const normalizeResponseMessage = (msg: any) => {
    const text = typeof msg === 'string' ? msg : msg?.message
    if (!text) return msg
    if (SYSTEM_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
        return '请求异常，请稍后重试'
    }
    if (/^(success|ok)$/i.test(text.trim())) {
        return '操作成功'
    }
    return text
}

const isLoginFailureMessage = (msg: any) => {
    const text = String(typeof msg === 'string' ? msg : msg?.message || normalizeResponseMessage(msg) || '')
    if (/token/i.test(text) && /(\u7f3a|\u7a7a|empty|required|\u5931\u6548|\u8fc7\u671f|\u65e0\u6548|\u767b\u5f55)/i.test(text)) {
        return true
    }
    if (/(\u8bf7\u5148\u767b\u5f55|\u767b\u5f55\u8d85\u65f6|\u91cd\u65b0\u767b\u5f55)/.test(text)) {
        return true
    }
    return false
}

const isTenantAppAccessMessage = (msg: any) => String(normalizeResponseMessage(msg) || '') === '应用未购买、未上架或已过期'

const loginFailureMessage = (msg: any) => {
    const text = String(typeof msg === 'string' ? msg : msg?.message || normalizeResponseMessage(msg) || '')
    if (/token/i.test(text) && /(\u7f3a|\u7a7a|empty|required)/i.test(text)) {
        return '\u8bf7\u5148\u767b\u5f55\u540e\u518d\u64cd\u4f5c'
    }
    if (/(\u8bf7\u5148\u767b\u5f55|\u767b\u5f55\u8d85\u65f6|\u91cd\u65b0\u767b\u5f55|\u767b\u5f55)/.test(text)) {
        return text
    }
    return text || '\u767b\u5f55\u8d85\u65f6\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55'
}

const getHttpStatus = (err: any) =>
    Number(err?.statusCode || err?.status || err?.response?.status || 0)

const normalizeRequestError = (err: any) => {
    if (typeof err === 'string') {
        return normalizeResponseMessage(err)
    }
    const responseMsg = err?.data?.msg || err?.response?._data?.msg || err?.response?.data?.msg
    if (responseMsg) {
        const normalizedMsg = normalizeResponseMessage(responseMsg)
        if (err?.data) {
            err.data.msg = normalizedMsg
        }
        err.message = normalizedMsg
        return err
    }
    const status = getHttpStatus(err)
    if (status >= 500) {
        err.message = '请求失败，请稍后重试'
        return err
    }
    if (err?.message) {
        err.message = normalizeResponseMessage(err.message)
    }
    return err
}

export function createRequest(opt?: Partial<FetchOptions>) {
    const defaultOptions: FetchOptions = {
        // 基础接口地址
        baseURL: getApiUrl(),
        //请求头
        headers: {
            version: getVersion()
        },
        retry: 2,
        requestOptions: {
            apiPrefix: getApiPrefix(),
            isTransformResponse: true,
            isReturnDefaultResponse: false,
            withToken: true,
            isParamsToData: true,
            requestInterceptorsHook(options) {
                const userStore = useUserStore()
                const { apiPrefix, isParamsToData, withToken } = options.requestOptions
                // 拼接请求前缀
                if (apiPrefix) {
                    options.url = `${apiPrefix}${options.url}`
                }
                const params = options.params || {}
                // POST请求下如果无data，则将params视为data
                if (
                    isParamsToData &&
                    !Reflect.has(options, 'body') &&
                    options.method?.toUpperCase() === RequestMethodsEnum.POST
                ) {
                    options.body = params
                    options.params = {}
                }
                const headers = options.headers || {}
                if (withToken) {
                    const token = userStore.token || getStoredUserToken()
                    if (token) {
                        headers['token'] = token
                    }
                }
                headers['terminal'] = '4'
                const tenantId = parseTenantIdFromRoute()
                if (tenantId) {
                    headers['tenant-id'] = tenantId
                }
                options.headers = headers
                return options
            },
            async responseInterceptorsHook(response, options) {
                const { handlePcLoginFailure } = usePcLoginGate()
                const { isTransformResponse, isReturnDefaultResponse, suppressErrorMessage } = options.requestOptions
                //返回默认响应，当需要获取响应头及其他数据时可使用
                if (isReturnDefaultResponse) {
                    return response
                }
                // 是否需要对数据进行处理
                if (!isTransformResponse) {
                    return response._data
                }
                const { code, data, show, msg } = response._data
                const normalizedMsg = normalizeResponseMessage(msg)
                switch (code) {
                    case RequestCodeEnum.SUCCESS:
                        if (show) {
                            normalizedMsg && feedback.msgSuccess(normalizedMsg)
                        }
                        return data
                    case RequestCodeEnum.FAIL:
                        if (isLoginFailureMessage(msg)) {
                            if (!suppressErrorMessage) {
                                feedback.msgWarning(loginFailureMessage(msg))
                            }
                            return Promise.reject(handlePcLoginFailure())
                        }
                        if (show && !suppressErrorMessage && !isTenantAppAccessMessage(normalizedMsg)) {
                            normalizedMsg && feedback.msgError(normalizedMsg)
                        }
                        return Promise.reject(normalizedMsg)
                    case RequestCodeEnum.LOGIN_FAILURE:
                        if (!suppressErrorMessage) {
                            feedback.msgWarning(loginFailureMessage(msg))
                        }
                        return Promise.reject(handlePcLoginFailure())
                    case RequestCodeEnum.NOT_INSTALL:
                        window.location.replace('/install/install.php')
                        break
                    default:
                        return data
                }
            },
            responseInterceptorsCatchHook(err) {
                return normalizeRequestError(err)
            }
        }
    }
    return new Request(
        // 深度合并
        merge(defaultOptions, opt || {})
    )
}
