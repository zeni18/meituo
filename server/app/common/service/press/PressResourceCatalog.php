<?php
declare(strict_types=1);
namespace app\common\service\press;

use think\facade\Db;

final class PressResourceCatalog
{
    public const TYPES = [1=>'国内软文',2=>'自媒体',3=>'海外发稿',4=>'海外社媒',5=>'贴吧',6=>'论坛',7=>'问答',8=>'友链',9=>'文案',10=>'小红书',11=>'百科',12=>'短视频',13=>'微信',14=>'微博',15=>'母语'];
    public const PAGE_SIZE = 500;

    public static function prepare(array $rows, int $kind, int $revision, string $batch): array
    {
        if (!isset(self::TYPES[$kind])) throw new \InvalidArgumentException('资源类型不正确');
        $prepared = [];
        foreach ($rows as $row) {
            if (!is_array($row)) throw new \InvalidArgumentException('媒体资源字段格式异常');
            $id = PressService::text((string)($row['sourceid'] ?? ''),120,true);
            if (isset($prepared[$id])) throw new \InvalidArgumentException('同页出现重复媒体，已停止本页写入');
            $name = trim((string)($row['name'] ?? $row['proficient_field'] ?? ''));
            if ($name === '') $name = self::TYPES[$kind].' · '.$id;
            $price = $row['costprice'] ?? 0;
            // WeChat/Weibo use <=0 for an unsupported price tier; retain alternatives.
            $cost = is_numeric($price) && (float)$price <= 0 ? 0 : PressMoney::cents($price);
            $details = array_filter($row, static fn($key)=>!preg_match('/token|secret|password|credential|(^|_)key($|_)/i',(string)$key), ARRAY_FILTER_USE_KEY);
            $prepared[$id] = ['kind'=>$kind,'source_id'=>$id,'name'=>mb_substr($name,0,255),'cost_cents'=>$cost,
                'region'=>mb_substr((string)($row['region']??''),0,120),
                'category'=>mb_substr((string)($row['classify']??$row['industrystr']??$row['industry']??$row['language']??''),0,120),
                'remark'=>mb_substr((string)($row['remark']??''),0,8000),'case_url'=>mb_substr((string)($row['caseurl']??$row['case_uri']??''),0,2048),
                'active'=>(string)($row['flag']??'0')==='1' && (string)($row['deleted']??'0')==='1' && ($cost>0 || (in_array($kind,[12,13,14],true)&&(float)($row['cost2_price']??0)>0) || ($kind===14&&(float)($row['cost3_price']??0)>0)) ? 1 : 0,
                'config_revision'=>$revision,'sync_time'=>time(),'sync_batch'=>$batch,
                'details_json'=>json_encode($details,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)];
        }
        return array_values($prepared);
    }

    /** Caller holds the config/job locks and commits rows and cursor atomically. */
    public static function store(array $rows): void
    {
        if (!$rows) return;
        $fields = array_keys($rows[0]);
        $table = (string)Db::name('press_media')->getTable();
        if (!preg_match('/^[a-zA-Z0-9_]+$/D',$table)) throw new \RuntimeException('Invalid resource table');
        foreach (array_chunk($rows,100) as $chunk) {
            $bindings = [];
            foreach ($chunk as $row) foreach ($fields as $field) $bindings[] = $row[$field];
            $placeholders = implode(',',array_fill(0,count($chunk),'('.implode(',',array_fill(0,count($fields),'?')).')'));
            $updates = array_diff($fields,['kind','source_id']);
            Db::execute('INSERT INTO `'.$table.'` (`'.implode('`,`',$fields).'`) VALUES '.$placeholders.' ON DUPLICATE KEY UPDATE '.implode(',',array_map(static fn($f)=>'`'.$f.'`=VALUES(`'.$f.'`)',$updates)),$bindings);
        }
    }
}
