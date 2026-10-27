<?php
declare(strict_types=1);
// Restore shared added-page controls after rebuilding the supplied admin bundles.
if (PHP_SAPI !== 'cli') exit(1);
foreach (['admin', 'platform'] as $selectBuild) {
    $selectFile = dirname(__DIR__).'/public/'.$selectBuild.'/index.html';
    $selectHtml = file_get_contents($selectFile);
    if (str_contains($selectHtml, '/shared/select.js')) continue;
    if (substr_count($selectHtml, '</head>') !== 1) throw new RuntimeException('Review rebuilt '.$selectBuild.' index before installing shared selects');
    $selectTags = '<link rel="stylesheet" href="/shared/select.css?v=20261017-1"><script src="/shared/select.js?v=20261017-1" defer></script>';
    if (file_put_contents($selectFile, str_replace('</head>', $selectTags.'</head>', $selectHtml)) === false) throw new RuntimeException('Cannot install shared selects');
}
echo "Shared added-page selects installed.\n";
