<?php
// 全局中间件定义文件
return [
    \app\common\http\middleware\OpenGatewayMiddleware::class,
    //跨域中间件
    \app\common\http\middleware\LikeAdminAllowMiddleware::class,
    \app\common\http\middleware\PressPortalMiddleware::class,
    \app\common\http\middleware\ClipIntegrationScopeMiddleware::class,
    \app\common\http\middleware\GeoScopeMiddleware::class,
    \app\common\http\middleware\AgentAdminMiddleware::class,
    \app\common\http\middleware\TaskPortalMiddleware::class,
    \app\common\http\middleware\MerchantPortalMiddleware::class,
    //基础中间件
    \app\common\http\middleware\BaseMiddleware::class,
];
