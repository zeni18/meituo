<?php
declare(strict_types=1);

/** Replaces the retired cross-tab skin installer. CLI only; --apply opts into publishing.
 * Native Nuxt sources are absent. The asserted patch and one module-graph version keep
 * every importer on one Vue runtime. An upstream rebuild must pass the assertions again.
 */
if (PHP_SAPI !== 'cli') throw new RuntimeException('Run this installer from the command line.');
$root = dirname(__DIR__);
$patcher = $root . '/scripts/merchant-white/patch-white-theme.cjs';
$source = $root . '/public/_nuxt';
if (!is_file($patcher)) throw new RuntimeException('Missing scripts/merchant-white/patch-white-theme.cjs');
$stamp = date('Ymd-His') . '-' . getmypid();
$build = $root . '/.collab/local/merchant-white-build/' . $stamp;
$command = 'node ' . escapeshellarg($patcher) . ' --source ' . escapeshellarg($source) . ' --out ' . escapeshellarg($build);
passthru($command, $exitCode);
if ($exitCode !== 0) throw new RuntimeException('Native theme assertions failed. No production files were changed.');
$manifest = json_decode((string)file_get_contents($build . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$version = (string)$manifest['version'];
if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $version)) throw new RuntimeException('Invalid asset version');
$htmlFile = $root . '/public/pc/index.html';
$html = (string)file_get_contents($htmlFile);
$nextHtml = preg_replace('#/_nuxt/entry\.ef871ac3\.js(?:\?v=[a-zA-Z0-9_-]+)?(?=["\'])#', '/_nuxt/entry.ef871ac3.js?v=' . $version, $html, -1, $matches);
if ($matches !== 1 || $nextHtml === null) throw new RuntimeException('Expected one Nuxt entry in public/pc/index.html');
$items = $manifest['cacheOverlay'];
$publicItems = $manifest['publicOverlay'];
foreach ($items as $item) {
    $name = (string)$item['name'];
    if (!preg_match('/^[a-zA-Z0-9_.-]+\.js$/D', $name)) throw new RuntimeException('Invalid module filename');
    if (!hash_equals((string)$item['sha256'], hash_file('sha256', $build . '/cache-overlay/' . $name))) throw new RuntimeException('Staged module hash mismatch: ' . $name);
}
foreach ($publicItems as $item) {
    if ($item['path'] !== 'public/merchant/page.js' || $item['file'] !== 'merchant/page.js') throw new RuntimeException('Unexpected public adapter path');
    if (!hash_equals((string)$item['sha256'], hash_file('sha256', $build . '/public-overlay/' . $item['file']))) throw new RuntimeException('Staged merchant adapter hash mismatch');
}
if (!in_array('--apply', $argv, true)) {
    echo 'Verified ' . count($items) . ' module updates and ' . count($publicItems) . " public adapter. Use --apply after reviewing the generated manifest.\n";
    echo $build . "/manifest.json\n";
    exit(0);
}
$middleware = (string)file_get_contents($root . '/app/common/http/middleware/MerchantPortalMiddleware.php');
if (!str_contains($middleware, '__MERCHANT_UI__') || !str_contains($middleware, '/merchant/merchant-white.js') || !is_file($root . '/public/merchant/merchant-white.js') || !is_file($root . '/public/merchant/merchant-white.css')) {
    throw new RuntimeException('Install the synchronous merchant-white bootstrap and middleware gate before applying the modules.');
}
$backup = $root . '/.collab/local/ui-v2-backup/' . $stamp . '/merchant-white';
if (!is_dir($backup . '/_nuxt') && !mkdir($backup . '/_nuxt', 0775, true) && !is_dir($backup . '/_nuxt')) throw new RuntimeException('Cannot create backup directory');
// Finish all backups before the first write. The HTML entry is switched last.
foreach ($items as $item) {
    $name = (string)$item['name'];
    if (!copy($source . '/' . $name, $backup . '/_nuxt/' . $name)) throw new RuntimeException('Cannot back up ' . $name);
}
if (!copy($htmlFile, $backup . '/pc-index.html')) throw new RuntimeException('Cannot back up public/pc/index.html');
foreach ($publicItems as $item) {
    $target = $backup . '/' . $item['path'];
    if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0775, true) && !is_dir(dirname($target))) throw new RuntimeException('Cannot create adapter backup directory');
    if (!copy($root . '/' . $item['path'], $target)) throw new RuntimeException('Cannot back up merchant adapter');
}
foreach ($items as $item) {
    $name = (string)$item['name'];
    if (!copy($build . '/cache-overlay/' . $name, $source . '/' . $name)) throw new RuntimeException('Cannot publish ' . $name . '; backup: ' . $backup);
}
foreach ($publicItems as $item) {
    if (!copy($build . '/public-overlay/' . $item['file'], $root . '/' . $item['path'])) throw new RuntimeException('Cannot publish merchant adapter; backup: ' . $backup);
}
if ($nextHtml !== $html && file_put_contents($htmlFile, $nextHtml) === false) throw new RuntimeException('Cannot update HTML entry; backup: ' . $backup);
echo 'Merchant white theme installed: ' . count($items) . ' modules, version ' . $version . ".\n";
echo 'Backup: ' . $backup . "\n";
