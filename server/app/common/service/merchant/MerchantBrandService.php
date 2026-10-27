<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use InvalidArgumentException as Invalid;
use app\common\service\merchant\geo\{GeoBrandScope as Scope,GeoDashboard};
use app\common\service\press\PressService as Press;

final class MerchantBrandService
{
    private static function q(int $t,int $u){MerchantGeoService::owner($t,$u);return Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u]);}
    public static function owned(int $t,int $u,int $id,bool $lock=false):array{$r=self::q($t,$u)->where(['id'=>$id,'delete_time'=>0])->lock($lock)->find();if(!$r)throw new Invalid('品牌不存在或无访问权限');return $r;}
    private static function id(mixed $v):int{if(!is_int($v)&&!(is_string($v)&&ctype_digit($v)))throw new Invalid('品牌标识无效');if((int)$v<0)throw new Invalid('品牌标识无效');return (int)$v;}
    private static function publicRow(int $t,int $u,array $r):array
    {
        foreach(['logo','cover'] as $image){
            $r[$image]=null;
            if($r[$image.'_file_id']??0)try{$r[$image]=MerchantWorkspaceService::files($t,$u,[(int)$r[$image.'_file_id']],'image')[0]??null;}catch(Invalid){}
        }
        $r['store_count']=Db::name('oem_brand_store')->alias('b')->join('oem_merchant_store s','s.id=b.store_id AND s.tenant_id=b.tenant_id AND s.user_id=b.user_id')->where(['b.tenant_id'=>$t,'b.user_id'=>$u,'b.brand_id'=>$r['id'],'s.delete_time'=>0])->count();
        $profile=self::knowledge($t,$u,$r);$fields=['brand_name','industry','intro','products','customers','competitors','website'];$r['complete']=count(array_filter($fields,fn($k)=>trim((string)($profile[$k]??''))!==''));$r['total']=count($fields);$r['industry']=$profile['industry'];$r['website']=$profile['website'];
        $scope=(int)$r['geo_scope'];$r['keyword_count']=Scope::with($t,$u,$scope,fn()=>Scope::query('oem_geo_resource',$t,$u)->where(['kind'=>'keyword','delete_time'=>0])->count());$r['article_count']=Scope::with($t,$u,$scope,fn()=>Scope::query('aigc_geo_article',$t,$u)->where('delete_time',0)->count());
        $r['intro']=mb_substr(trim((string)($profile['intro']??'')),0,240);
        unset($r['knowledge_json']);return $r;
    }
    public static function listing(int $t,int $u,array $p):array
    {
        $q=self::q($t,$u)->where('delete_time',($p['trash']??'')==='1'?'>':'=',0);$kw=Press::text($p['keyword']??'',80);if($kw!=='')$q->whereLike('name','%'.addcslashes($kw,'%_\\').'%');
        $size=in_array((int)($p['page_size']??12),[12,24,48],true)?(int)($p['page_size']??12):12;$count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/$size))));
        $rows=$q->order('legacy desc,id desc')->page($page,$size)->select()->toArray();return ['lists'=>array_map(fn($r)=>self::publicRow($t,$u,$r),$rows),'count'=>$count,'page'=>$page,'page_size'=>$size];
    }
    public static function choices(int $t,int $u):array{return self::q($t,$u)->where('delete_time',0)->field('id,name,legacy,revision')->order('legacy desc,id')->select()->toArray();}
    public static function detail(int $t,int $u,array $p):array
    {
        $r=self::owned($t,$u,self::id($p['id']??0));return Scope::with($t,$u,(int)$r['geo_scope'],function()use($t,$u,$r,$p){
            $dashboard=GeoDashboard::view($t,$u,['range'=>$p['range']??'all']);$q=fn($table)=>Scope::query($table,$t,$u);
            $months=[];foreach([30,90,365]as $days)$months[]=['days'=>$days,'count'=>(int)$q('aigc_geo_article')->where('delete_time',0)->where('create_time','>=',time()-$days*86400)->count()];
            $categories=$q('oem_geo_material')->where('delete_time',0)->field('category,COUNT(*) AS total')->group('category')->order('category')->select()->toArray();
            return ['brand'=>self::publicRow($t,$u,$r),'profile'=>self::knowledge($t,$u,$r),'dashboard'=>$dashboard,'knowledge_categories'=>array_map(fn($c)=>['category'=>$c['category'],'total'=>(int)$c['total']],$categories),'metrics'=>['keywords'=>(int)$q('oem_geo_resource')->where(['kind'=>'keyword','delete_time'=>0])->count(),'questions'=>(int)$q('aigc_geo_keyword')->where('delete_time',0)->count(),'materials'=>(int)$q('oem_geo_material')->where('delete_time',0)->count(),'samples'=>(int)$q('aigc_geo_diagnosis')->where('status','recorded_auto')->count()],'article_periods'=>$months];
        });
    }
    public static function save(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){
            MerchantGeoService::owner($t,$u);Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u])->lock(true)->find();
            $id=self::id($p['id']??0);$old=$id?self::owned($t,$u,$id,true):null;if($old&&(int)($p['revision']??0)!==(int)$old['revision'])throw new Invalid('品牌资料已更新，请刷新重试');
            $name=Press::text($p['name']??'',120,true);$data=['name'=>$name,'contact'=>Press::text($p['contact']??'',80),'mobile'=>MerchantContactPhone::normalize($p['mobile']??''),'email'=>Press::text($p['email']??'',160),'address'=>Press::text($p['address']??'',255),'update_time'=>time()];
            if($data['email']!==''&&!filter_var($data['email'],FILTER_VALIDATE_EMAIL))throw new Invalid('邮箱格式不正确');
            // Optional profile fields share this transaction with the brand, so retries cannot leave half-created records.
            $profileFields=[];
            if(array_key_exists('industry',$p))$profileFields['industry']=Press::text($p['industry'],120);
            if(array_key_exists('website',$p))$profileFields['website']=MerchantGeoService::normalizeWebsite(Press::text($p['website'],500));
            foreach(['logo_file_id','cover_file_id'] as $image){$file=self::id($p[$image]??($old[$image]??0));if($file)MerchantWorkspaceService::files($t,$u,[$file],'image');$data[$image]=$file;}
            if(self::q($t,$u)->where(['name'=>$name,'delete_time'=>0])->where('id','<>',$id)->find())throw new Invalid('当前账号中已存在同名品牌');
            if($old){$data['revision']=(int)$old['revision']+1;self::q($t,$u)->where('id',$id)->update($data);if($name!==$old['name'])self::renameKnowledge($t,$u,$old,$name);}
            else{
                $legacy=!self::q($t,$u)->where('legacy',1)->find();$knowledge=self::emptyProfile();$knowledge['brand_name']=$name;
                $id=(int)Db::name('oem_merchant_brand')->insertGetId($data+['tenant_id'=>$t,'user_id'=>$u,'legacy'=>(int)$legacy,'knowledge_json'=>json_encode($knowledge,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'create_time'=>time()]);
                if(!$legacy)self::q($t,$u)->where('id',$id)->update(['geo_scope'=>$id]);
                else{
                    $profile=Db::name('oem_geo_profile')->where(['tenant_id'=>$t,'user_id'=>$u])->find();
                    if(!$profile)Db::name('oem_geo_profile')->insert(self::emptyProfile()+['tenant_id'=>$t,'user_id'=>$u,'create_time'=>time(),'update_time'=>time()]);
                    if(($profile['brand_name']??'')!==$name)Db::name('oem_geo_profile')->where(['tenant_id'=>$t,'user_id'=>$u])->update(['brand_name'=>$name,'revision'=>(int)($profile['revision']??0)+1,'update_time'=>time()]);
                    foreach(Db::name('oem_merchant_store')->where(['tenant_id'=>$t,'user_id'=>$u])->column('id')as $store){if(!Db::name('oem_brand_store')->where(['tenant_id'=>$t,'user_id'=>$u,'store_id'=>$store])->find())Db::name('oem_brand_store')->insert(['tenant_id'=>$t,'user_id'=>$u,'store_id'=>$store,'brand_id'=>$id]);}
                }
            }
            if($profileFields){
                $brand=self::owned($t,$u,$id,true);$profile=self::knowledge($t,$u,$brand);
                if(array_filter($profileFields,fn($value,$key)=>$value!==($profile[$key]??''),ARRAY_FILTER_USE_BOTH))self::knowledgeSave($t,$u,array_merge($profile,$profileFields,['id'=>$id,'brand_name'=>$name]));
            }
            return ['id'=>$id];
        });
    }
    public static function migrateOwner(int $t,int $u):void
    {
        if(self::q($t,$u)->find()){$brand=self::q($t,$u)->where('delete_time',0)->order('legacy desc,id')->value('id');if($brand)foreach(Db::name('oem_merchant_store')->where(['tenant_id'=>$t,'user_id'=>$u])->column('id')as $store){if(!Db::name('oem_brand_store')->where(['tenant_id'=>$t,'user_id'=>$u,'store_id'=>$store])->find())self::assignStore($t,$u,(int)$store,(int)$brand);}return;}$profile=Db::name('oem_geo_profile')->where(['tenant_id'=>$t,'user_id'=>$u])->find();$merchant=Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->find();
        self::save($t,$u,['name'=>($profile['brand_name']??'')?:($merchant['name']?:'默认品牌')]);
    }
    public static function emptyProfile():array{return ['brand_name'=>'','website'=>'','industry'=>'','intro'=>'','products'=>'','customers'=>'','competitors'=>'','revision'=>0];}
    public static function knowledge(int $t,int $u,array $brand):array
    {
        if((int)$brand['legacy']===1)return Db::name('oem_geo_profile')->where(['tenant_id'=>$t,'user_id'=>$u])->find()?:self::emptyProfile();
        $r=json_decode($brand['knowledge_json'],true)?:self::emptyProfile();$r['revision']=(int)$brand['knowledge_revision'];return $r;
    }
    public static function scopedProfile(int $t,int $u,int $scope):array{$r=self::owned($t,$u,$scope);if((int)$r['geo_scope']!==$scope)throw new Invalid('品牌范围不匹配');return self::knowledge($t,$u,$r);}
    public static function saveScopedProfile(int $t,int $u,int $scope,array $data,array $p):array
    {
        return Db::transaction(function()use($t,$u,$scope,$data,$p){$r=self::owned($t,$u,$scope,true);if(!isset($p['revision'])||(int)$p['revision']!==(int)$r['knowledge_revision'])throw new Invalid('企业知识库已更新，请刷新重试');$data['revision']=(int)$r['knowledge_revision']+1;
            if(self::q($t,$u)->where(['name'=>$data['brand_name'],'delete_time'=>0])->where('id','<>',$scope)->find())throw new Invalid('当前账号中已存在同名品牌');
            self::q($t,$u)->where('id',$scope)->update(['name'=>$data['brand_name'],'knowledge_json'=>json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'knowledge_revision'=>$data['revision'],'revision'=>(int)$r['revision']+1,'update_time'=>time()]);return $data;});
    }
    public static function syncDefaultName(int $t,int $u,string $name):void{if(self::q($t,$u)->where(['name'=>$name,'legacy'=>0,'delete_time'=>0])->find())throw new Invalid('当前账号中已存在同名品牌');self::q($t,$u)->where(['legacy'=>1,'delete_time'=>0])->update(['name'=>$name,'update_time'=>time(),'revision'=>Db::raw('revision + 1')]);}
    private static function renameKnowledge(int $t,int $u,array $r,string $name):void
    {
        if((int)$r['legacy']===1)Db::name('oem_geo_profile')->where(['tenant_id'=>$t,'user_id'=>$u])->update(['brand_name'=>$name,'revision'=>Db::raw('revision + 1'),'update_time'=>time()]);
        else{$data=self::knowledge($t,$u,$r);$data['brand_name']=$name;self::q($t,$u)->where('id',$r['id'])->update(['knowledge_json'=>json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'knowledge_revision'=>(int)$r['knowledge_revision']+1]);}
    }
    public static function knowledgeSave(int $t,int $u,array $p):array{$r=self::owned($t,$u,self::id($p['id']??0));$profile=Scope::with($t,$u,(int)$r['geo_scope'],fn()=>MerchantGeoService::profileSave($t,$u,$p));return $profile+['brand_revision'=>(int)self::owned($t,$u,(int)$r['id'])['revision']];}
    public static function recycle(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){$id=self::id($p['id']??0);$restore=($p['restore']??false)===true;$r=self::q($t,$u)->where('id',$id)->where('delete_time',$restore?'>':'=',0)->lock(true)->find();if(!$r)throw new Invalid('品牌不存在或无访问权限');if((int)($p['revision']??0)!==(int)$r['revision'])throw new Invalid('品牌资料已更新，请刷新重试');
            if(!$restore){$row=self::publicRow($t,$u,$r);if($row['store_count'])throw new Invalid('请先转移或回收旗下门店，再回收品牌');$busy=Scope::with($t,$u,(int)$r['geo_scope'],fn()=>Scope::query('oem_geo_job',$t,$u)->whereIn('status',['queued','running','submitting','polling'])->count());if($busy)throw new Invalid('品牌仍有执行中的GEO任务，请完成后再回收');}
            if(!$restore)Scope::with($t,$u,(int)$r['geo_scope'],fn()=>Scope::query('oem_geo_monitor_schedule',$t,$u)->where('enabled',1)->update(['enabled'=>0,'last_error'=>'品牌已移入回收站，定期复测已停止','revision'=>Db::raw('revision + 1'),'update_time'=>time()]));
            if($restore&&self::q($t,$u)->where(['name'=>$r['name'],'delete_time'=>0])->where('id','<>',$id)->find())throw new Invalid('已有同名品牌，请先调整名称后恢复');
            self::q($t,$u)->where('id',$id)->update(['delete_time'=>$restore?0:time(),'revision'=>(int)$r['revision']+1,'update_time'=>time()]);return ['id'=>$id];});
    }
    public static function assignStore(int $t,int $u,int $store,int $brand):void
    {
        self::owned($t,$u,$brand,true);if(!Db::name('oem_merchant_store')->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$store])->find())throw new Invalid('门店不存在或无访问权限');
        $where=['tenant_id'=>$t,'user_id'=>$u,'store_id'=>$store];if(Db::name('oem_brand_store')->where($where)->find())Db::name('oem_brand_store')->where($where)->update(['brand_id'=>$brand]);else Db::name('oem_brand_store')->insert($where+['brand_id'=>$brand]);
    }
    public static function assignDefaultStore(int $t,int $u,int $store):void
    {
        if(Db::name('oem_brand_store')->where(['tenant_id'=>$t,'user_id'=>$u,'store_id'=>$store])->find())return;
        $brand=self::q($t,$u)->where('delete_time',0)->order('legacy desc,id')->value('id');if($brand)self::assignStore($t,$u,$store,(int)$brand);elseif(self::q($t,$u)->count())throw new Invalid('请先创建或恢复品牌，再添加门店');
    }
}
