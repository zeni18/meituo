<?php
declare(strict_types=1);
namespace app\common\service\press;

use think\facade\Db;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;

/** Platform-owned credentials only. No OEM credential resolution or fallback. */
final class PressConfig
{
    public static function audit(string $action, int $actor = 0, int $order = 0, string $note = ''): void
    {
        Db::name('press_audit')->insert(['action'=>$action,'actor_id'=>$actor,'order_id'=>$order,'note'=>$note,'create_time'=>time()]);
    }
    public static function listing(bool $includeCredentials = false): array
    {
        $r = Db::name('press_config')->where('id',1)->find();
        $secret = $r ? Vault::open($r['secret_cipher'],0,'haipress_media') : [];
        return ['enabled'=>(bool)($r['enabled']??0),'revision'=>(int)($r['revision']??0),'markup_bps'=>(int)($r['markup_bps']??0),
            'public_base'=>$r['public_base']??'','token_configured'=>!empty($secret['token']),'key_configured'=>!empty($secret['key']),
            'provider'=>'海讯社','base_url'=>'https://api.haipress.com','points_per_yuan'=>100,
            'notice'=>'凭证仅在总后台保存；1元=100算力。保存配置不代表已联调或已充值。']
            + ($includeCredentials ? ['token'=>(string)($secret['token']??''),'key'=>(string)($secret['key']??'')] : []);
    }
    private static function mergeCredentials(array $previous, array $input): array
    {
        foreach (['token','key'] as $field) {
            if (!array_key_exists($field,$input)) continue;
            $value=$input[$field];
            if (!is_string($value) || strlen($value)>1024 || preg_match('/[\x00-\x20]/',$value)) throw new \InvalidArgumentException('凭证格式不正确');
            // Older clients sent blanks as placeholders; the unified editor sends
            // replace_credentials so an explicitly emptied field is actually cleared.
            if ($value!=='' || ($input['replace_credentials']??false)===true) $previous[$field]=$value;
        }
        return $previous;
    }
    public static function publicBase(string $url): string
    {
        $p = parse_url($url); $host = strtolower($p['host']??'');
        if (!filter_var($url,FILTER_VALIDATE_URL) || ($p['scheme']??'')!=='https' || isset($p['user'],$p['pass']) || isset($p['user']) || isset($p['port']) || isset($p['query']) || isset($p['fragment']) || !in_array($p['path']??'',['','/'],true) || !str_contains($host,'.') || filter_var($host,FILTER_VALIDATE_IP) || preg_match('/(?:^|\.)(?:localhost|local|internal|invalid)$/D',$host)) {
            throw new \InvalidArgumentException('请配置不含路径和端口的HTTPS公网预览域名');
        }
        return 'https://'.$host;
    }
    public static function save(array $p, int $actor): array
    {
        $enabled = \app\common\service\merchant\clip\ClipIntegrationService::boolean($p['enabled']??false);
        $bps = $p['markup_bps']??0;
        if (!is_int($bps) || $bps<0 || $bps>100000) throw new \InvalidArgumentException('加价比例须为0至100000个基点');
        $base = trim((string)($p['public_base']??'')); if ($base!=='') $base=self::publicBase($base);
        return Db::transaction(function() use($p,$actor,$enabled,$bps,$base) {
            Db::name('admin')->where('root',1)->order('id')->lock(true)->find();
            $r=Db::name('press_config')->where('id',1)->lock(true)->find();
            if (!isset($p['revision']) || (string)$p['revision']!==(string)($r['revision']??0)) throw new \InvalidArgumentException('配置已更新，请刷新后保存');
            $keys=self::mergeCredentials($r?Vault::open($r['secret_cipher'],0,'haipress_media'):[],$p);
            if ($enabled && (empty($keys['token']) || empty($keys['key']))) throw new \InvalidArgumentException('启用接口前请填写 Token 和 Key');
            $data=['enabled'=>$enabled?1:0,'revision'=>(int)($r['revision']??0)+1,'markup_bps'=>$bps,'public_base'=>$base,
                'secret_cipher'=>Vault::seal($keys,0,'haipress_media'),'account_hash'=>hash('sha256',json_encode($keys,JSON_THROW_ON_ERROR)),'access_cipher'=>'','access_expiry'=>0,'updated_by'=>$actor,'update_time'=>time()];
            if ($r) Db::name('press_config')->where('id',1)->update($data); else Db::name('press_config')->insert(['id'=>1]+$data);
            // A pricing/domain edit invalidates old quotes, not the supplier's
            // catalog. Keep the revision fence when the actual account changes.
            if ($r && hash_equals((string)$r['account_hash'],$data['account_hash'])) {
                PressResourceSync::carryConfiguration((int)$r['revision'],$data['revision'],$enabled);
            }
            self::audit('config_save',$actor); return self::listing();
        });
    }
    public static function resolve(): array
    {
        $r=Db::name('press_config')->where('id',1)->find();
        if (!$r || !(int)$r['enabled']) throw new \InvalidArgumentException('海讯社发稿服务尚未配置或已停用，请联系平台');
        return $r+['credentials'=>Vault::open($r['secret_cipher'],0,'haipress_media')];
    }
    public static function assertPublishReady(array $config): void
    {
        if (empty($config['public_base'])) throw new \InvalidArgumentException('正式发稿前，请在接入能力配置中填写本站公网访问域名，供海讯社读取稿件正文。接口验证与媒体资源同步无需该域名。');
        self::publicBase((string)$config['public_base']);
    }
}
