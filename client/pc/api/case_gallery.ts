export function getCaseGalleryCases(params?: any, requestOptions?: any) {
    return $request.get({ url: '/case_gallery.case/lists', params }, requestOptions)
}
