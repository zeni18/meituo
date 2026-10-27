<?php
/** Local PHP development server; mirrors the shipped Nginx static fallbacks. */
declare(strict_types=1);

$public = realpath(__DIR__ . '/../public');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit;
}
if (str_contains($path, "\0") || preg_match('#(?:^|/)[.]#', $path)) {
    http_response_code(404);
    exit;
}
$file = realpath($public . $path);
$adminPath = preg_match('#^/(?:t/[0-9]+/)?(?:platform|admin)(?:/|$)#', $path);
$frontHtml = !$adminPath && (preg_match('#\.html$#i', $path) || ($file && is_dir($file)));
if (!$frontHtml && $file && str_starts_with(str_replace('\\', '/', $file), str_replace('\\', '/', $public) . '/') && is_file($file)) {
    if (preg_match('/\.(?:php|phtml|phar)$/i', $file)) {
        http_response_code(404);
        exit;
    }
    return false;
}
if (!$adminPath) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $public . '/index.php';
    $_SERVER['PATH_INFO'] = $path;
    require $public . '/index.php';
    return true;
}
if (preg_match('#\.(?:js|css|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|mp4|mp3|json)$#i', $path)) {
    http_response_code(404);
    exit;
}
$shell = 'admin';
if (preg_match('#^/(?:t/[0-9]+/)?(platform|admin|mobile)(?:/|$)#', $path, $match)) {
    $shell = $match[1];
}
header('Content-Type: text/html; charset=utf-8');
readfile($public . '/' . $shell . '/index.html');
return true;
