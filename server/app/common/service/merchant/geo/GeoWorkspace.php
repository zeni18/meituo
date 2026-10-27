<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use think\facade\Db;
use app\common\service\merchant\MerchantGeoService as Geo;
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;

/** Merchant-owned editorial resources. Credentials and billing remain in their existing services. */
final class GeoWorkspace
{
    private const KINDS=['keyword','instruction','category','contact','site','favorite_group','favorite'];
    private static function q(int $t,int $u){Geo::owner($t,$u);return GeoBrandScope::query('oem_geo_resource',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u]);}
    private static function kind(array $p):string{$k=(string)($p['kind']??'');if(!in_array($k,self::KINDS,true))throw new Invalid('资料类型不正确');return $k;}
    private static function json(array $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    private static function related(int $t,int $u,int $id,string $kind):void{if($id&&!self::q($t,$u)->where(['id'=>$id,'kind'=>$kind,'delete_time'=>0])->find())throw new Invalid('关联资料不存在或无访问权限');}
    private static function url(mixed $value):string{$v=Press::text($value,2048);if($v!==''&&(!filter_var($v,FILTER_VALIDATE_URL)||!in_array(parse_url($v,PHP_URL_SCHEME),['http','https'],true)||parse_url($v,PHP_URL_USER)!==null))throw new Invalid('请输入有效HTTP(S)地址');return $v;}
    public static function resources(int $t,int $u,array $p):array
    {
        $k=self::kind($p);$q=self::q($t,$u)->where('kind',$k)->where('delete_time',empty($p['trash'])?'=':'>',0);
        if(in_array($k,['favorite','favorite_group'],true)&&isset($p['channel']))$q->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.channel')) = ?",[($p['channel']==='influencer')?'influencer':'website']);
        if($k==='favorite'&&!empty($p['group_id'])){$group=(int)$p['group_id'];self::related($t,$u,$group,'favorite_group');$q->whereRaw("JSON_EXTRACT(data_json, '$.group_id') = ?",[$group]);}
        $kw=Press::text($p['keyword']??'',80);if($kw!=='')$q->whereLike('title','%'.addcslashes($kw,'%_\\').'%');
        $requested=(int)($p['page_size']??20);$size=in_array($requested,[20,50,100,500],true)?$requested:20;$page=max(1,(int)($p['page']??1));$count=(clone $q)->count();$rows=$q->order('id desc')->page($page,$size)->select()->toArray();
        foreach($rows as &$r){$r['data']=json_decode($r['data_json'],true)?:[];unset($r['data_json']);}
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>$size];
    }
    public static function save(int $t,int $u,array $p):array
    {
        $kind=self::kind($p);$id=max(0,(int)($p['id']??0));$title=Press::text($p['title']??'',255,true);$content=Press::text($p['content']??'',30000);$d=[];
        // Only declared editorial fields can be saved; never accept credentials or caller-owned IDs.
        if($kind==='keyword')$d=['enabled'=>!empty($p['enabled'])];
        if($kind==='instruction'){$d=['purpose'=>in_array($p['purpose']??'',['article','title'],true)?$p['purpose']:'article'];if($content==='')throw new Invalid('请填写写作指令');}
        if($kind==='contact'){foreach(['phone'=>80,'email'=>160,'company'=>255]as $k=>$limit)$d[$k]=Press::text($p[$k]??'',$limit);if($d['email']!==''&&!filter_var($d['email'],FILTER_VALIDATE_EMAIL))throw new Invalid('邮箱格式不正确');$d['website']=self::url($p['website']??'');}
        if($kind==='site'){$d=['website'=>self::url($p['website']??''),'cms'=>Press::text($p['cms']??'WordPress',80)];if($d['website']==='')throw new Invalid('请填写站点地址');}
        if(in_array($kind,['favorite_group','favorite'],true))$d['channel']=($p['channel']??'')==='influencer'?'influencer':'website';
        return Db::transaction(function()use($t,$u,$p,$kind,$id,$title,$content,$d){
            $old=$id?self::q($t,$u)->where(['id'=>$id,'kind'=>$kind,'delete_time'=>0])->lock(true)->find():null;
            if($id&&!$old)throw new Invalid('资料不存在或无访问权限');if($old&&(int)($p['revision']??0)!==(int)$old['revision'])throw new Invalid('资料已更新，请刷新后重试');
            if($kind==='favorite'){$media=(int)($p['media_id']??0);$row=Db::name('press_media')->where(['id'=>$media,'active'=>1])->find();if(!$row)throw new Invalid('媒体已下架或不存在');$d['media_id']=$media;$d['group_id']=max(0,(int)($p['group_id']??0));self::related($t,$u,$d['group_id'],'favorite_group');if($d['group_id']){$group=self::q($t,$u)->where('id',$d['group_id'])->find();if((json_decode($group['data_json'],true)['channel']??'')!==$d['channel'])throw new Invalid('收藏分组类型不一致');}}
            $data=['title'=>$title,'content'=>$content,'data_json'=>self::json($d),'revision'=>(int)($old['revision']??0)+1,'update_time'=>time()];
            if($id)self::q($t,$u)->where('id',$id)->update($data);else $id=(int)Db::name('oem_geo_resource')->insertGetId($data+['kind'=>$kind,'tenant_id'=>$t,'user_id'=>$u,'brand_id'=>GeoBrandScope::id($t,$u),'create_time'=>time()]);
            return ['id'=>$id,'revision'=>$data['revision']];
        });
    }
    public static function recycle(int $t,int $u,array $p):array
    {
        $kind=self::kind($p);return Db::transaction(function()use($t,$u,$kind,$p){$restore=!empty($p['restore']);$q=self::q($t,$u)->where(['kind'=>$kind,'id'=>(int)($p['id']??0)])->where('delete_time',$restore?'>':'=',0);$r=$q->lock(true)->find();if(!$r)throw new Invalid('资料不存在或无访问权限');if((int)($p['revision']??0)!==(int)$r['revision'])throw new Invalid('资料已更新，请刷新后重试');self::q($t,$u)->where(['id'=>$r['id'],'revision'=>$r['revision']])->update(['delete_time'=>$restore?0:time(),'revision'=>$r['revision']+1,'update_time'=>time()]);return ['id'=>$r['id']];});
    }
    public static function contentSave(int $t,int $u,array $p):array
    {
        $kind=(string)($p['kind']??'');if(!in_array($kind,['questions','articles','materials','evidence'],true))throw new Invalid('内容类型不正确');
        return Db::transaction(function()use($t,$u,$p,$kind){
            Geo::owner($t,$u);$id=(int)($p['id']??0);$table=match($kind){'questions'=>'aigc_geo_keyword','articles'=>'aigc_geo_article','materials'=>'oem_geo_material',default=>'aigc_geo_diagnosis'};
            $old=$id?GeoBrandScope::query($table,$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$id])->lock(true)->find():null;
            if($id&&(!$old||(int)($old['delete_time']??0)>0))throw new Invalid('内容不存在或无访问权限');
            if($old&&((int)($p['expected_update']??-1)!==(int)$old['update_time']||($kind!=='materials'&&!hash_equals((string)($p['expected_hash']??''),hash('sha256',self::json($old))))))throw new Invalid('内容已更新，请刷新后重试');
            $key=max(0,(int)($p['keyword_group_id']??0));$category=max(0,(int)($p['category_id']??0));self::related($t,$u,$key,'keyword');self::related($t,$u,$category,'category');
            $result=Geo::save($t,$u,$p);if(in_array($kind,['articles','questions'],true)){$meta=json_decode($old['metadata_json']??'{}',true)?:[];$meta['keyword_group_id']=$key;$meta['category_id']=$category;GeoBrandScope::query($table,$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$result['id']])->update(['metadata_json'=>self::json($meta)]);}return $result;
        });
    }
    public static function creationContext(int $t,int $u,array $p):array
    {
        $out=[];foreach(['keyword_group_id'=>'keyword','category_id'=>'category','instruction_id'=>'instruction']as $key=>$kind){$id=max(0,(int)($p[$key]??0));self::related($t,$u,$id,$kind);$out[$key]=$id;}
        $out['writing_instruction']=$out['instruction_id']?(string)self::q($t,$u)->where('id',$out['instruction_id'])->value('content'):'';return $out;
    }
    public static function importContext(int $t,int $u,array $p):array
    {
        $out=[];foreach(['keyword_group_id'=>'keyword','category_id'=>'category']as $key=>$kind){$id=max(0,(int)($p[$key]??0));$out[$key]=$id&&self::q($t,$u)->where(['id'=>$id,'kind'=>$kind,'delete_time'=>0])->find()?$id:0;}return $out;
    }
    public static function importQuestions(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){$group=max(0,(int)($p['keyword_group_id']??0));self::related($t,$u,$group,'keyword');$result=Geo::questionImport($t,$u,$p);if($group){foreach(array_unique($p['questions'])as $text){$r=GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'delete_time'=>0,'question'=>trim($text)])->lock(true)->find();if($r){$meta=json_decode($r['metadata_json'],true)?:[];$meta['keyword_group_id']=$group;GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$r['id']])->update(['metadata_json'=>self::json($meta)]);}}}return $result;});
    }
    public static function records(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$kind=(string)($p['kind']??'');$table=match($kind){'questions'=>'aigc_geo_keyword','articles'=>'aigc_geo_article','materials'=>'oem_geo_material','evidence'=>'aigc_geo_diagnosis',default=>throw new Invalid('内容类型不正确')};
        $q=GeoBrandScope::query($table,$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u]);$kind==='evidence'?$q->where('status','recorded_manual'):$q->where('delete_time',0);
        if(isset($p['id'])){if(!preg_match('/^[1-9][0-9]*$/D',(string)$p['id']))throw new Invalid('内容ID无效');$q->where('id',(int)$p['id']);}
        $kw=Press::text($p['keyword']??'',80);if($kw!=='')$q->whereLike(in_array($kind,['articles','materials'],true)?'title':'question','%'.addcslashes($kw,'%_\\').'%');
        if($kind==='materials'&&trim((string)($p['category']??''))!=='')$q->where('category',Press::text($p['category'],80));
        foreach(['keyword_group_id'=>'keyword','category_id'=>'category']as $field=>$related){$value=max(0,(int)($p[$field]??0));if($value&&in_array($kind,['articles','questions'],true)){self::related($t,$u,$value,$related);$q->whereRaw("JSON_EXTRACT(metadata_json, '$.".$field."') = ?",[$value]);}}
        $count=(clone $q)->count();$page=max(1,(int)($p['page']??1));$rows=$q->order('id desc')->page($page,20)->select()->toArray();foreach($rows as &$r){$r['expected_hash']=hash('sha256',self::json($r));foreach(['metadata_json','sources_json']as $f)if(isset($r[$f]))$r[$f]=json_decode($r[$f],true)?:[];if($kind==='articles'){$r['status']='draft';$r['score']=null;}}
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>20];
    }
    public static function report(int $t,int $u):array
    {
        $summary=Geo::summary($t,$u);$owner=['tenant_id'=>$t,'user_id'=>$u,'brand_id'=>GeoBrandScope::id($t,$u)];$start=strtotime(date('Y-m-d',time()-13*86400));$trend=[];for($day=0;$day<14;$day++)$trend[date('Y-m-d',$start+$day*86400)]=['date'=>date('m-d',$start+$day*86400),'created'=>0,'published'=>0];
        foreach(['aigc_geo_article'=>'created','press_order'=>'published']as $table=>$field){$q=Db::name($table)->where($owner)->where('create_time','>=',$start);if($field==='created')$q->where('delete_time',0);else $q->where('state','published');foreach($q->field('create_time')->select()->toArray()as $r){$date=date('Y-m-d',(int)$r['create_time']);if(isset($trend[$date]))$trend[$date][$field]++;}}
        $states=Db::name('oem_geo_job')->where($owner)->field('status,COUNT(*) AS total')->group('status')->select()->toArray();$resources=self::q($t,$u)->where('delete_time',0)->field('kind,COUNT(*) AS total')->group('kind')->select()->toArray();
        $evidence=Db::name('aigc_geo_diagnosis')->where($owner)->where('status','recorded_manual')->field('platform,COUNT(*) AS total')->group('platform')->select()->toArray();
        $monitoring=GeoVisibility::options($t,$u);return ['summary'=>$summary,'resources'=>array_column($resources,'total','kind'),'trend'=>array_values($trend),'jobs'=>array_column($states,'total','status'),'manual_evidence'=>$evidence,'visibility'=>$monitoring,'automatic_monitoring'=>$monitoring['available'],'automatic_mentions'=>null,'updated_at'=>time(),'note'=>'创作量按文章创建日期统计；发布量按订单创建日期归组且仅计已发布订单。人工观察记录不计入自动收录率。'];
    }
}
