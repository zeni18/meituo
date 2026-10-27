<?php
declare(strict_types=1);
namespace app\common\service\press;

use think\facade\{Db,Cache};
use app\common\service\merchant\MerchantGeoService as Geo;
use app\common\service\merchant\geo\{GeoBrandScope,GeoWorkspace};
use InvalidArgumentException as Invalid;

/** Merchant-safe catalog. Supplier costs and raw metadata never leave this service. */
final class PressMediaDirectory
{
    private const SPEEDS=[1=>'1小时内',2=>'2小时内',12=>'半天',24=>'当天',48=>'隔天',49=>'2天以上'];
    private static function favorites(int $t,int $u){return GeoBrandScope::query('oem_geo_resource',$t,$u)->where(['kind'=>'favorite','delete_time'=>0]);}
    private static function number(array $d,string $field):?int
    {
        $v=$d[$field]??null;return is_scalar($v)&&preg_match('/^\d+$/',(string)$v)?(int)$v:null;
    }
    public static function metrics(array $d):array
    {
        $out=[];foreach(['pcweight','wapweight','publishtime','weekendpublish','linktype','newsresource','searchcollint','authint','fans','readnumber','isvideo','recommend'] as $key)$out[$key]=self::number($d,$key);
        $out['publish_time_label']=self::SPEEDS[$out['publishtime']??-1]??null;
        $out['fans_label']=[1=>'0–1千',5=>'1千–5千',10=>'5千–1万',50=>'1万–5万',100=>'5万–10万',1000=>'10万–100万',1001=>'100万以上'][$out['fans']??-1]??null;
        $out['read_label']=[1=>'0–1千',5=>'1千–5千',10=>'5千–1万',50=>'1万–5万',100=>'5万–10万',101=>'10万'][$out['readnumber']??-1]??null;
        $out['publication_rate']=null;
        return $out;
    }
    public static function listing(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);
        $config=Db::name('press_config')->where('id',1)->field('revision,markup_bps')->find();
        $q=Db::name('press_media')->where(['config_revision'=>(int)($config['revision']??0),'active'=>1])->whereIn('kind',array_keys(PressResourceCatalog::TYPES));
        $kind=(int)($p['kind']??0);if($kind){if(!isset(PressResourceCatalog::TYPES[$kind]))throw new Invalid('媒体类型不正确');$q->where('kind',$kind);}
        foreach(['keyword','region','category'] as $f)$$f=PressService::text($p[$f]??'',80);
        if($keyword!=='')$q->whereLike('name','%'.addcslashes($keyword,'%_\\').'%');
        if($region==='全国')$q->whereIn('region',['全国','综合全国']);elseif($region!=='')$q->where('region',$region);
        if($category!=='')$q->whereRaw("FIND_IN_SET(?, REPLACE(category, '，', ',')) > 0",[$category]);
        $price=PressService::text($p['price']??'',20);$factor=10000+(int)($config['markup_bps']??0);
        // Filter the same rounded retail price that checkout displays, never the supplier cost.
        $alternative=static fn($field)=>"JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.$field'))";
        $second=$alternative('cost2_price');$third=$alternative('cost3_price');
        // Avoid a literal ? in raw expressions: ThinkPHP's positional binding parser also scans regex strings.
        $cost="(CASE WHEN cost_cents > 0 THEN cost_cents WHEN kind IN (12,13,14) AND $second REGEXP '^[0-9]+([.][0-9]{1,2}){0,1}$' AND CAST($second AS DECIMAL(12,2)) > 0 THEN CAST($second AS DECIMAL(12,2))*100 WHEN kind=14 AND $third REGEXP '^[0-9]+([.][0-9]{1,2}){0,1}$' AND CAST($third AS DECIMAL(12,2)) > 0 THEN CAST($third AS DECIMAL(12,2))*100 ELSE 0 END)";
        $retail="CEIL($cost * $factor / 10000)";
        if($price==='low')$q->whereRaw("$retail <= 10000");
        elseif($price==='mid')$q->whereRaw("$retail > 10000 AND $retail <= 30000");
        elseif($price==='high')$q->whereRaw("$retail > 30000");
        elseif($price==='custom'){
            $min=$p['min_price']??'';$max=$p['max_price']??'';
            if($min===''&&$max==='')throw new Invalid('请至少填写一个价格边界');
            $min=$min===''?null:PressMoney::cents($min);$max=$max===''?null:PressMoney::cents($max);
            if($min!==null&&$max!==null&&$min>$max)throw new Invalid('最低价格不能高于最高价格');
            if($min!==null)$q->whereRaw("$retail >= ?",[$min]);
            if($max!==null)$q->whereRaw("$retail <= ?",[$max]);
        }
        elseif($price!=='')throw new Invalid('价格区间不正确');
        $advanced=['pcweight'=>range(0,10),'wapweight'=>range(0,10),'publishtime'=>array_keys(self::SPEEDS),'weekendpublish'=>[0,1],'linktype'=>[0,2],'newsresource'=>[0,1],'searchcollint'=>[0,1],'authint'=>[0,1],'fans'=>[1,5,10,50,100,1000,1001],'readnumber'=>[1,5,10,50,100,101],'isvideo'=>[0,1],'recommend'=>[0,1]];
        foreach($advanced as $field=>$allowed){
            if(!isset($p[$field])||$p[$field]==='')continue;
            $value=$p[$field];if(!is_scalar($value)||!ctype_digit((string)$value)||!in_array((int)$value,$allowed,true))throw new Invalid('高级筛选条件不正确');
            // Only the website catalog documents 0 = not guaranteed, 1 = guaranteed.
            if($field==='searchcollint')$q->where('kind',1);
            $expr="JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.$field'))";
            $op=in_array($field,['pcweight','wapweight'],true)?'>=':'=';
            $q->whereRaw("$expr REGEXP '^[0-9]+$' AND CAST($expr AS UNSIGNED) $op ?",[(int)$value]);
        }
        if(!empty($p['favorites']))$q->whereIn('id',Db::raw(self::favorites($t,$u)->fieldRaw("CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.media_id')) AS UNSIGNED)")->buildSql(false)));
        $sort=PressService::text($p['sort']??'',20);
        if(!in_array($sort,['','price_asc','price_desc','name'],true))throw new Invalid('排序方式不正确');
        $size=in_array((int)($p['page_size']??20),[10,20,50],true)?(int)($p['page_size']??20):20;
        $count=(clone $q)->count();$page=min(max(1,(int)($p['page']??1)),max(1,(int)ceil($count/$size)));
        $order=match($sort){'price_asc'=>$cost.' asc,id desc','price_desc'=>$cost.' desc,id desc','name'=>'name asc,id desc',default=>'id desc'};
        $rows=$q->orderRaw($order)->page($page,$size)->field('id,kind,name,region,category,cost_cents,remark,case_url,sync_time,details_json')->select()->toArray();
        $ids=array_column($rows,'id');$favorites=[];
        if($ids)$favorites=self::favorites($t,$u)->whereRaw("CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.media_id')) AS UNSIGNED) IN (".implode(',',array_fill(0,count($ids),'?')).")",array_map('intval',$ids))->column('data_json');
        $favoriteIds=array_map(fn($v)=>(int)(json_decode($v,true)['media_id']??0),$favorites);
        foreach($rows as &$r){$r['price_options']=[];foreach(PressPriceOptions::costs($r)as $option){$retailCents=PressMoney::retail($option['cost_cents'],(int)($config['markup_bps']??0));$r['price_options'][]=['price_type'=>$option['price_type'],'label'=>$option['label'],'retail_cents'=>$retailCents,'points'=>PressMoney::points($retailCents)];}$r['retail_cents']=$r['price_options'][0]['retail_cents']??0;$r['points']=PressMoney::points($r['retail_cents']);$r['metrics']=self::metrics(json_decode($r['details_json']??'{}',true)?:[]);$r['is_favorite']=in_array((int)$r['id'],$favoriteIds,true);unset($r['cost_cents'],$r['details_json']);}unset($r);
        return ['lists'=>$rows,'kinds'=>PressResourceCatalog::TYPES,'count'=>$count,'page'=>$page,'page_size'=>$size,'kind'=>$kind,'favorites'=>!empty($p['favorites']),'availability'=>PressService::availability()];
    }
    public static function caseUrl(int $t,int $u,int $id):string
    {
        Geo::owner($t,$u);
        $revision=(int)Db::name('press_config')->where('id',1)->value('revision');
        $row=Db::name('press_media')->where(['id'=>$id,'active'=>1,'config_revision'=>$revision])->whereIn('kind',array_keys(PressResourceCatalog::TYPES))->field('case_url')->find();
        if(!$row)throw new Invalid('媒体已下架或不存在');
        return PressCaseUrl::resolve((string)$row['case_url']);
    }
    public static function options(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$kind=(int)($p['kind']??1);if(!isset(PressResourceCatalog::TYPES[$kind]))throw new Invalid('媒体类型不正确');
        $revision=(int)Db::name('press_config')->where('id',1)->value('revision');
        return Cache::remember('press-directory-facets-v1-'.$revision.'-'.$kind,function()use($kind,$revision){
            $q=Db::name('press_media')->where(['kind'=>$kind,'active'=>1,'config_revision'=>$revision]);
            $categories=[];foreach((clone $q)->distinct(true)->column('category') as $v)foreach(preg_split('/[,，]/u',$v) as $c)if(trim($c)!=='')$categories[trim($c)]=true;
            $regions=array_values(array_unique(array_filter(array_map(fn($v)=>$v==='综合全国'?'全国':trim($v),(clone $q)->distinct(true)->column('region')))));
            sort($regions);$categories=array_keys($categories);sort($categories);return ['categories'=>$categories,'regions'=>$regions];
        },60);
    }
    public static function favorite(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$id=(int)($p['media_id']??0);$wanted=$p['favorite']??null;if(!is_bool($wanted)||$id<=0)throw new Invalid('收藏参数不正确');
        return Db::transaction(function()use($t,$u,$id,$wanted){
            // Serialize repeated clicks across tabs; retain existing collection groups.
            Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->lock(true)->find();
            $q=self::favorites($t,$u)->whereRaw("JSON_EXTRACT(data_json, '$.media_id') = ?",[$id]);
            if(!$wanted){$q->update(['delete_time'=>time(),'update_time'=>time(),'revision'=>Db::raw('revision + 1')]);return ['media_id'=>$id,'is_favorite'=>false];}
            $revision=(int)Db::name('press_config')->where('id',1)->value('revision');
            $r=Db::name('press_media')->where(['id'=>$id,'active'=>1,'config_revision'=>$revision])->whereIn('kind',array_keys(PressResourceCatalog::TYPES))->find();if(!$r)throw new Invalid('媒体已下架或不存在');
            if(!(clone $q)->find())GeoWorkspace::save($t,$u,['kind'=>'favorite','title'=>$r['name'],'content'=>$r['remark'],'media_id'=>$id,'channel'=>(int)$r['kind']===2?'influencer':'website']);
            return ['media_id'=>$id,'is_favorite'=>true];
        });
    }
}
