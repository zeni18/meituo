export function createAiToolDownloadZip(params: any, requestOptions?: any) {
    return $request.post({ url: '/app.ai_tool_download/zip', params }, requestOptions)
}
