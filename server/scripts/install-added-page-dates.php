<?php
declare(strict_types=1);
// Restore the shared date controls after regenerating either admin shell.
if (PHP_SAPI !== 'cli') exit(1);
$tags = '<link rel="stylesheet" href="/shared/vendor/flatpickr/flatpickr.min.css?v=4.6.13"><link rel="stylesheet" href="/shared/dates.css?v=20261017-1"><script src="/shared/vendor/flatpickr/flatpickr.min.js?v=4.6.13" defer></script><script src="/shared/vendor/flatpickr/zh.js?v=4.6.13" defer></script><script src="/shared/dates.js?v=20261017-1" defer></script>';
foreach (['app/common/http/middleware/MerchantPortalMiddleware.php','public/admin/index.html','public/platform/index.html'] as $relative) {
    $file = dirname(__DIR__).'/'.$relative;
    $source = file_get_contents($file);
    if (str_contains($source, '/shared/dates.js')) continue;
    $needle = str_ends_with($relative,'.php') ? '<script src="/shared/select.js?v=20261017-1" defer></script>' : '</head>';
    if (substr_count($source,$needle)!==1) throw new RuntimeException('Review date-control insertion point: '.$relative);
    $replacement = str_ends_with($relative,'.php') ? $needle.$tags : $tags.$needle;
    if (file_put_contents($file,str_replace($needle,$replacement,$source))===false) throw new RuntimeException('Cannot update '.$relative);
}
echo "Shared date controls installed.\n";
