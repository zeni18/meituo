<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
$identity=\app\common\service\merchant\geo\GeoTextRuntime::install();
echo json_encode($identity,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\nDeepSeek GEO catalog registered; existing prices preserved, new SKUs remain off. No key, grant or generation created.\n";
