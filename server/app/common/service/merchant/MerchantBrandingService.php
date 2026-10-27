<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use app\common\service\ConfigService;
use app\common\service\FileService;

/** Public merchant identity, read through the current tenant's existing settings. */
final class MerchantBrandingService
{
    public static function read(): array
    {
        $name = trim((string)ConfigService::get('website', 'shop_name'));
        if ($name === '') $name = trim((string)ConfigService::get('tenant', 'name'));
        if ($name === '') $name = 'AI 商家工作台';
        $title = trim((string)ConfigService::get('website', 'pc_title')) ?: $name;
        return [
            'name' => $name,
            'title' => $title,
            'logo' => FileService::getFileUrl((string)(ConfigService::get('website', 'pc_logo') ?: 'resource/image/tenantapi/default/web_logo.jpg')),
            'favicon' => FileService::getFileUrl((string)(ConfigService::get('website', 'pc_ico') ?: 'resource/image/tenantapi/default/web_favicon.ico')),
        ];
    }

    public static function loginHtml(string $html, array $branding): string
    {
        $values = [];
        foreach (['name', 'title', 'logo', 'favicon'] as $key) {
            $values['{{merchant_' . $key . '}}'] = htmlspecialchars((string)$branding[$key], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        return strtr($html, $values);
    }
}
