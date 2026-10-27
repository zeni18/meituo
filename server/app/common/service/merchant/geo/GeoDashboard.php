<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\service\merchant\MerchantGeoService as Geo;
use InvalidArgumentException as Invalid;

/** Read-only merchant overview. Counts use stored records, never estimated rankings. */
final class GeoDashboard
{
    public static function view(int $tenant,int $user,array $p):array
    {
        Geo::owner($tenant,$user);$range=(string)($p['range']??'all');$today=strtotime('today');
        [$from,$until]=match($range){'all'=>[0,time()+1],'today'=>[$today,time()+1],'yesterday'=>[$today-86400,$today],'7d'=>[$today-6*86400,time()+1],'30d'=>[$today-29*86400,time()+1],default=>throw new Invalid('统计时间范围无效')};
        $owner=['tenant_id'=>$tenant,'user_id'=>$user,'brand_id'=>GeoBrandScope::id($tenant,$user)];$q=static function(string $table,string $field='create_time')use($owner,$from,$until){return Db::name($table)->where($owner)->where($field,'>=',$from)->where($field,'<',$until);};
        $observed="CAST(JSON_UNQUOTE(JSON_EXTRACT(sources_json,'$.observed_at')) AS UNSIGNED)";
        $evidence=static function()use($owner,$from,$until,$observed){return Db::name('aigc_geo_diagnosis')->where($owner)->where('status','recorded_auto')->whereRaw($observed.' >= ? AND '.$observed.' < ?',[$from,$until]);};
        $groups=$evidence()->field('platform,COUNT(*) AS samples,COUNT(DISTINCT question) AS questions,SUM(mentioned) AS mentions,MAX('.$observed.') AS latest_at')->group('platform')->select()->toArray();$byPlatform=[];$totalSamples=0;$totalMentions=0;
        foreach($groups as $g){foreach(['samples','questions','mentions','latest_at']as $key)$g[$key]=(int)$g[$key];$totalSamples+=$g['samples'];$totalMentions+=$g['mentions'];$byPlatform[$g['platform']]=$g;}
        $platforms=[];foreach(array_unique(['豆包','DeepSeek','Kimi','腾讯元宝','通义千问',...array_keys($byPlatform)])as $name)$platforms[]=$byPlatform[$name]??['platform'=>$name,'samples'=>0,'questions'=>0,'mentions'=>null,'latest_at'=>0];
        $articles=$q('aigc_geo_article')->where('delete_time',0)->count();$published=$q('press_order')->where('state','published')->count();
        $latest=$q('press_order')->where('state','published')->field('id,title,media_name,published_url,create_time')->order('create_time desc,id desc')->limit(5)->select()->toArray();
        foreach($latest as &$row){$url=$row['published_url'];if(!filter_var($url,FILTER_VALIDATE_URL)||!in_array(parse_url($url,PHP_URL_SCHEME),['https','http'],true)||parse_url($url,PHP_URL_USER)!==null)$row['published_url']='';}unset($row);
        $questions=$evidence()->field('platform,question,COUNT(*) AS samples,SUM(mentioned) AS mentions,MAX('.$observed.') AS latest_at')->group('platform,question')->order('latest_at desc,platform,question')->limit(5)->select()->toArray();
        $profile=Geo::profile($tenant,$user);$fields=['brand_name','industry','intro','products','customers','competitors','website'];$complete=count(array_filter($fields,fn($key)=>trim((string)($profile[$key]??''))!==''));
        $recent=$q('oem_geo_job')->order('id desc')->limit(5)->select()->toArray();
        return ['range'=>$range,'stats'=>['articles'=>(int)$articles,'published'=>(int)$published,'mentions'=>$totalSamples?$totalMentions:null,'samples'=>$totalSamples],
            'platforms'=>$platforms,'latest_published'=>$latest,'recent_questions'=>$questions,'recent_tasks'=>array_map(fn($r)=>GeoJobs::publicRow($r),$recent),
            'brand'=>['name'=>$profile['brand_name']??'','complete'=>$complete,'total'=>count($fields)],'updated_at'=>time()];
    }
}
