<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use app\common\service\press\PressService;
use InvalidArgumentException as Invalid;

/** Account asset view of the existing GEO articles; no separate article storage. */
final class MerchantArticleLibraryService
{
    public static function listing(int $t,int $u,array $p):array
    {
        MerchantGeoService::owner($t,$u);
        $brands=Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'delete_time'=>0])->select()->toArray();
        $byScope=array_column($brands,null,'geo_scope');
        $brand=$p['brand_id']??'';
        if($brand!==''){
            $owned=MerchantBrandService::owned($t,$u,MerchantFilmService::number($brand,1));
            $byScope=[(int)$owned['geo_scope']=>$owned];
        }
        $scopes=array_keys($byScope);
        $q=Db::name('aigc_geo_article')->where(['tenant_id'=>$t,'user_id'=>$u,'delete_time'=>0])->whereIn('brand_id',$scopes?:[-1]);
        $keyword=PressService::text($p['keyword']??'',80);
        if($keyword!=='')$q->whereLike('title','%'.addcslashes($keyword,'%_\\').'%');
        $category=MerchantFilmService::number($p['category_id']??0);
        $categories=Db::name('oem_geo_resource')->where(['tenant_id'=>$t,'user_id'=>$u,'kind'=>'category','delete_time'=>0])->whereIn('brand_id',$scopes?:[-1])->column('title','id');
        if($category){
            if(!isset($categories[$category]))throw new Invalid('文章分类不存在或无访问权限');
            $q->whereRaw("JSON_EXTRACT(metadata_json, '$.category_id') = ?",[$category]);
        }
        $requested=(int)($p['page_size']??10);$size=in_array($requested,[10,20,50,100],true)?$requested:10;
        $count=(clone $q)->count();$page=max(1,(int)($p['page']??1));
        $rows=$q->order('id desc')->page($page,$size)->select()->toArray();
        foreach($rows as &$row){
            // Hash precisely the original GEO row, before adding display-only asset fields.
            $row['expected_hash']=hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
            $row['metadata_json']=json_decode($row['metadata_json']??'{}',true)?:[];
            $owner=$byScope[(int)$row['brand_id']];$row['owner_brand_id']=(int)$owner['id'];$row['brand_name']=$owner['name'];
            $row['category_name']=$categories[(int)($row['metadata_json']['category_id']??0)]??'未分类';
            $row['word_count']=mb_strlen(preg_replace('/\s+/u','',strip_tags($row['content'])));
        }
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>$size];
    }
}
