<?php
declare(strict_types=1);
namespace app\common\service\integration;

final class ConfigLogRedactor
{
    public static function response(string $content):string
    {
        $data=json_decode($content,true);
        if(!is_array($data))return '[redacted configuration response]';
        return json_encode(self::walk($data),JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
    }
    private static function walk(array $data):array
    {
        foreach($data as $key=>$value){
            if(in_array($key,['secrets','secret_values','credentials','token','key','api_key','access_key_id','access_key_secret','app_secret','secret_cipher'],true))$data[$key]='[redacted]';
            elseif(is_array($value))$data[$key]=self::walk($value);
        }
        return $data;
    }
}
