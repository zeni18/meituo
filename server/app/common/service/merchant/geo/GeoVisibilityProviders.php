<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

final class GeoVisibilityProviders
{
    public static function code(array $settings):string
    {
        $code=$settings['provider']??'moli';if(!in_array($code,['moli','geo_partner'],true))throw new \InvalidArgumentException('监测服务协议无效');return $code;
    }
    public static function origin(array $settings,string $value):string{return self::code($settings)==='geo_partner'?PartnerVisibility::origin($value):MoliVisibility::origin($value);}
    public static function platform(array $settings,string $name,string $surface):string{return self::code($settings)==='geo_partner'?PartnerVisibility::platform($name,$surface):MoliVisibility::platform($name,$surface);}
    public static function platforms(array $settings):array{return self::code($settings)==='geo_partner'?array_map('array_keys',PartnerVisibility::PLATFORMS):['网页端'=>['DeepSeek','豆包','腾讯元宝','通义千问','Kimi'],'App端'=>['DeepSeek','豆包','腾讯元宝','通义千问']];}
    public static function name(array $settings):string{return self::code($settings)==='geo_partner'?'GEO服务商 API v1.3':'模力指数';}
}
