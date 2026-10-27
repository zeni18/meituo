<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** A new namespace and key: never changes encryption or configuration for native apps. */
final class ClipCredentialVault
{
    private static function key():string
    {
        $configured=(string)env('MERCHANT_CLIP_CONFIG_KEY','');
        if($configured!==''){if(strlen($configured)<32)throw new \RuntimeException('剪辑配置加密密钥至少32位');return hash('sha256',$configured,true);}
        $dir=root_path().'runtime/merchant_clip_integration';
        if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new \RuntimeException('无法创建剪辑安全目录');
        $path=$dir.'/master.key';if(is_link($path))throw new \RuntimeException('剪辑加密密钥文件不正确');
        $fp=fopen($path,'c+b');if(!$fp)throw new \RuntimeException('无法读取剪辑加密密钥');
        try{if(!flock($fp,LOCK_EX))throw new \RuntimeException('无法锁定剪辑加密密钥');@chmod($path,0600);$key=stream_get_contents($fp);
            if($key===''){$key=random_bytes(32);rewind($fp);if(fwrite($fp,$key)!==32)throw new \RuntimeException('无法保存剪辑加密密钥');fflush($fp);}
            if(strlen($key)!==32)throw new \RuntimeException('剪辑加密密钥文件损坏');return $key;
        }finally{flock($fp,LOCK_UN);fclose($fp);}
    }
    public static function seal(array $secrets,int $tenant,string $capability):string
    {
        if(!$secrets)return '';$iv=random_bytes(12);$tag='';$plain=json_encode($secrets,JSON_THROW_ON_ERROR);
        $cipher=openssl_encrypt($plain,'aes-256-gcm',self::key(),OPENSSL_RAW_DATA,$iv,$tag,'merchant_clip_v1:'.$tenant.':'.$capability);
        if($cipher===false)throw new \RuntimeException('剪辑凭证加密失败');return 'v1:'.base64_encode($iv.$tag.$cipher);
    }
    public static function open(string $value,int $tenant,string $capability):array
    {
        if($value==='')return [];if(!str_starts_with($value,'v1:'))throw new \RuntimeException('剪辑凭证版本不正确');
        $raw=base64_decode(substr($value,3),true);if($raw===false||strlen($raw)<28)throw new \RuntimeException('剪辑凭证无法读取');
        $plain=openssl_decrypt(substr($raw,28),'aes-256-gcm',self::key(),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16),'merchant_clip_v1:'.$tenant.':'.$capability);
        if($plain===false)throw new \RuntimeException('剪辑凭证校验失败');$data=json_decode($plain,true,16,JSON_THROW_ON_ERROR);if(!is_array($data))throw new \RuntimeException('剪辑凭证格式不正确');return $data;
    }
}
