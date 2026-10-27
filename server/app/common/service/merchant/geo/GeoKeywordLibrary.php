<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use think\facade\Db;
use app\common\service\merchant\{MerchantGeoService as Geo,MerchantAccountTables,MerchantBrandService};
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;

/** Brand-owned word lists reuse editorial groups and questions; no monitoring scope is changed. */
final class GeoKeywordLibrary
{
    private static function groups(int $t,int $u){return GeoBrandScope::query('oem_geo_resource',$t,$u)->where(['kind'=>'keyword','delete_time'=>0]);}
    public static function saveLibrary(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$brand=$p['brand_id']??null;if(!is_scalar($brand)||!ctype_digit((string)$brand)||(int)$brand<=0)throw new Invalid('请选择词库关联的品牌商');
        return Db::transaction(function()use($t,$u,$p,$brand){$b=MerchantBrandService::owned($t,$u,(int)$brand,true);$id=(int)($p['id']??0);
            if($id){GeoWorkspace::creationContext($t,$u,['keyword_group_id'=>$id]);if(GeoBrandScope::id($t,$u)!==(int)$b['geo_scope'])throw new Invalid('已有词库不能更换品牌商，请在该品牌下另建词库');}
            $r=GeoBrandScope::with($t,$u,(int)$b['geo_scope'],fn()=>GeoWorkspace::save($t,$u,['kind'=>'keyword','id'=>$id,'revision'=>$p['revision']??0,'title'=>$p['title']??'','content'=>$p['content']??'','enabled'=>$p['enabled']??true]));
            return $r+['brand_id'=>(int)$b['id'],'brand_name'=>$b['name']];
        });
    }
    public static function manualPreview(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$group=(int)($p['keyword_group_id']??0);if($group<=0)throw new Invalid('请先选择目标词库');GeoWorkspace::creationContext($t,$u,['keyword_group_id'=>$group]);
        $parts=$p['parts']??null;if(!is_array($parts)||!array_is_list($parts)||count($parts)!==6)throw new Invalid('请提供六组组合词');$sets=[];$count=1;
        foreach($parts as $part){$part=Press::text($part,5000);$rows=array_values(array_unique(array_filter(array_map('trim',preg_split('/\r?\n/',$part)),fn($v)=>$v!=='')));if(count($rows)>100)throw new Invalid('每组最多100个词');foreach($rows as $word)Press::text($word,100,true);$count*=max(1,count($rows));if($count>1000)throw new Invalid('组合结果超过1000条，请减少每组词条');$sets[]=$rows?:[''];}
        if($sets[2]===[''])throw new Invalid('请至少填写一个主词');$result=[''];foreach($sets as $set){$next=[];foreach($result as $prefix)foreach($set as $word){$term=$prefix.$word;Press::text($term,500);$next[]=$term;}$result=$next;}
        return ['terms'=>array_values(array_unique($result)),'keyword_group_id'=>$group,'billable'=>false];
    }
    public static function view(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$group=max(0,(int)($p['group_id']??0));GeoWorkspace::creationContext($t,$u,['keyword_group_id'=>$group]);
        $groups=self::groups($t,$u)->order('id desc')->select()->toArray();$known=array_fill_keys(array_column($groups,'id'),true);$totals=[];
        $base=GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where('delete_time',0);
        foreach((clone $base)->field("COALESCE(JSON_EXTRACT(metadata_json, '$.keyword_group_id'),0) AS gid,COUNT(*) AS total")->group('gid')->select()->toArray() as $r){$id=(int)$r['gid'];if(!isset($known[$id]))$id=0;$totals[$id]=($totals[$id]??0)+(int)$r['total'];}
        foreach($groups as &$r){$r['data']=json_decode($r['data_json'],true)?:[];$r['count']=$totals[$r['id']]??0;unset($r['data_json']);}unset($r);
        if($group)$base->whereRaw("JSON_EXTRACT(metadata_json, '$.keyword_group_id') = ?",[$group]);
        else{$active=self::groups($t,$u)->field('id')->buildSql(false);$base->whereRaw("COALESCE(JSON_EXTRACT(metadata_json, '$.keyword_group_id'),0) NOT IN ($active)");}
        $kw=Press::text($p['keyword']??'',80);if($kw!=='')$base->whereLike('question','%'.addcslashes($kw,'%_\\').'%');
        $page=max(1,(int)($p['page']??1));$size=(int)($p['page_size']??20);if(!in_array($size,[20,100],true))throw new Invalid('每页数量无效');$count=(clone $base)->count();$rows=$base->order('id desc')->page($page,$size)->select()->toArray();
        foreach($rows as &$row){$row['expected_hash']=hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));$row['metadata_json']=json_decode($row['metadata_json'],true)?:[];}unset($row);
        $jobs=GeoBrandScope::query('oem_geo_job',$t,$u)->where('operation','keywords')->whereRaw("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.purpose')),'') <> 'diagnosis'")->order('id desc')->limit(20)->select()->toArray();
        $jobs=array_map(fn($r)=>GeoJobs::publicRow($r)+['group_id'=>(int)(json_decode($r['payload_json'],true)['keyword_group_id']??0)],$jobs);
        return ['groups'=>$groups,'unfiled_count'=>$totals[0]??0,'lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>$size,'jobs'=>$jobs];
    }
    public static function add(int $t,int $u,array $p):array
    {
        $group=(int)($p['keyword_group_id']??0);if($group<=0)throw new Invalid('请先选择或创建词表');
        return GeoCreationStudio::saveTopics($t,$u,$p,true);
    }
    public static function update(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$id=(int)($p['id']??0);return Db::transaction(function()use($t,$u,$id,$p){
            Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u])->lock(true)->find();
            $row=GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where(['id'=>$id,'delete_time'=>0])->lock(true)->find();if(!$row)throw new Invalid('词条不存在或无权限');
            if(!hash_equals(hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)),(string)($p['expected_hash']??'')))throw new Invalid('词条已更新，请刷新后重试');
            $group=max(0,(int)($p['keyword_group_id']??0));GeoWorkspace::creationContext($t,$u,['keyword_group_id'=>$group]);$text=Press::text($p['question']??'',500,true);$intent=Press::text($p['intent']??'内容选题',80,true);
            if(GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where(['question'=>$text,'delete_time'=>0])->where('id','<>',$id)->whereRaw("COALESCE(JSON_EXTRACT(metadata_json, '$.keyword_group_id'),0) = ?",[$group])->find())throw new Invalid('当前词表已有相同词条');
            $meta=json_decode($row['metadata_json'],true)?:[];$meta['keyword_group_id']=$group;if($row['question']!==$text){unset($meta['geo_job_id']);$row['source']='manual';}
            GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where('id',$id)->update(['question'=>$text,'intent'=>$intent,'source'=>$row['source'],'metadata_json'=>json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'update_time'=>time()]);return ['id'=>$id];
        });
    }
}
