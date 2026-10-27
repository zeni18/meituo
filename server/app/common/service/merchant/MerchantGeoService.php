<?php
declare(strict_types=1);
namespace app\common\service\merchant;
use think\facade\Db;
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;
use app\common\service\merchant\geo\GeoBrandScope as BrandScope;

/** Merchant-owned GEO records. No simulated AI answers, ranks or publication. */
final class MerchantGeoService
{
    public static function owner(int $tenant,int $user): void
    {
        if ($tenant<=0 || $user<=0 || !Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user,'status'=>1])->find()) throw new Invalid('商家不可用');
    }
    private static function q(string $table,int $tenant,int $user)
    {
        self::owner($tenant,$user);return $table==='oem_geo_profile'?Db::name($table)->where(['tenant_id'=>$tenant,'user_id'=>$user]):BrandScope::query($table,$tenant,$user);
    }
    public static function profile(int $tenant,int $user): array
    {
        if(BrandScope::id($tenant,$user)>0)return MerchantBrandService::scopedProfile($tenant,$user,BrandScope::id($tenant,$user));
        return self::q('oem_geo_profile',$tenant,$user)->find()?:['brand_name'=>'','website'=>'','industry'=>'','intro'=>'','products'=>'','customers'=>'','competitors'=>'','revision'=>0];
    }
    public static function normalizeWebsite(string $url):string
    {
        $space='[\p{Z}\s\x{200B}\x{2060}\x{FEFF}]';
        $trim=static fn(string $value):string=>preg_replace('~^'.$space.'+|'.$space.'+$~u','',$value);
        $url=$trim($url);if($url==='')return '';
        $url=preg_replace_callback('~^(https?)'.$space.'*:'.$space.'*/'.$space.'*/'.$space.'*~iu',fn($m)=>strtolower($m[1]).'://',$url);
        if(str_starts_with($url,'//'))$url='https:'.$url;
        elseif(!preg_match('~^[a-z][a-z0-9+.-]*:~i',$url))$url='https://'.$url;
        $url=preg_replace_callback('~^(https?://)([^/?#]*)~iu',fn($m)=>strtolower($m[1]).$trim(preg_replace('~[\x{200B}\x{2060}\x{FEFF}]~u','',$m[2])),$url);
        if(!filter_var($url,FILTER_VALIDATE_URL)||!in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true)||parse_url($url,PHP_URL_USER)!==null||parse_url($url,PHP_URL_PASS)!==null)throw new Invalid('官方网站格式不正确，请填写完整域名，例如 example.com');
        return $url;
    }
    public static function profileSave(int $tenant,int $user,array $p): array
    {
        self::owner($tenant,$user);$data=[];
        foreach (['brand_name'=>120,'website'=>500,'industry'=>120,'intro'=>10000,'products'=>10000,'customers'=>5000,'competitors'=>5000] as $key=>$max) $data[$key]=Press::text($p[$key]??'',$max,$key==='brand_name');
        $data['website']=self::normalizeWebsite($data['website']);
        if(BrandScope::id($tenant,$user)>0)return MerchantBrandService::saveScopedProfile($tenant,$user,BrandScope::id($tenant,$user),$data,$p);
        return Db::transaction(function() use($tenant,$user,$p,$data) {
            Db::name(MerchantAccountTables::name($tenant,'user'))->where(['id'=>$user,'tenant_id'=>$tenant])->lock(true)->find();
            $old=self::q('oem_geo_profile',$tenant,$user)->lock(true)->find();
            if (!isset($p['revision']) || (string)$p['revision']!==(string)($old['revision']??0)) throw new Invalid('品牌资料已更新，请刷新后重试');
            $data+=['revision'=>(int)($old['revision']??0)+1,'update_time'=>time()];
            if ($old) self::q('oem_geo_profile',$tenant,$user)->update($data);else Db::name('oem_geo_profile')->insert($data+['tenant_id'=>$tenant,'user_id'=>$user,'create_time'=>time()]);
            MerchantBrandService::syncDefaultName($tenant,$user,$data['brand_name']);return self::profile($tenant,$user);
        });
    }
    private static function table(string $kind): string
    {
        return match($kind) {'questions'=>'aigc_geo_keyword','articles'=>'aigc_geo_article','evidence'=>'aigc_geo_diagnosis','materials'=>'oem_geo_material',default=>throw new Invalid('GEO记录类型无效')};
    }
    public static function lists(int $tenant,int $user,array $p): array
    {
        $kind=Press::text($p['kind']??'',20,true);$q=self::q(self::table($kind),$tenant,$user);
        if ($kind!=='evidence') $q->where('delete_time',0);else $q->where('status','recorded_manual');
        $kw=Press::text($p['keyword']??'',80);if ($kw!=='') $q->whereLike(in_array($kind,['articles','materials'],true)?'title':'question','%'.addcslashes($kw,'%_\\').'%');
        $count=(clone $q)->count();$page=max(1,(int)($p['page']??1));$rows=$q->order('id desc')->page($page,20)->select()->toArray();
        foreach ($rows as &$r) {
            foreach (['metadata_json','sources_json','platforms_json'] as $field) if (isset($r[$field])) $r[$field]=json_decode($r[$field],true)?:[];
            if ($kind==='articles') {$r['status']='draft';$r['score']=null;unset($r['published_time']);}
        }
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>20];
    }
    public static function summary(int $tenant,int $user): array
    {
        return ['profile'=>self::profile($tenant,$user),'questions'=>(int)self::q('aigc_geo_keyword',$tenant,$user)->where('delete_time',0)->count(),
            'articles'=>(int)self::q('aigc_geo_article',$tenant,$user)->where('delete_time',0)->count(),
            'evidence'=>(int)self::q('aigc_geo_diagnosis',$tenant,$user)->where('status','recorded_manual')->count(),
            'materials'=>(int)self::q('oem_geo_material',$tenant,$user)->where('delete_time',0)->count(),
            'press'=>Press::orders($tenant,$user,null,false,[])['summary'],'automatic_monitoring'=>\app\common\service\merchant\geo\GeoVisibility::options($tenant,$user)['available'],'ai_generation'=>\app\common\service\merchant\geo\GeoJobs::options($tenant,$user)['text_available']];
    }
    public static function save(int $tenant,int $user,array $p): array
    {
        $kind=Press::text($p['kind']??'',20,true);$table=self::table($kind);self::owner($tenant,$user);$id=(int)($p['id']??0);
        $data=['update_time'=>time()];
        if ($kind==='questions') $data+=['question'=>Press::text($p['question']??'',500,true),'intent'=>Press::text($p['intent']??'品牌认知',80),'platform'=>Press::text($p['platform']??'未指定',80),'status'=>'draft','source'=>'manual','platforms_json'=>'[]','metadata_json'=>'{}'];
        if ($kind==='articles') $data+=['title'=>Press::text($p['title']??'',255,true),'question'=>Press::text($p['question']??'',500),'content'=>Press::text($p['content']??'',100000,true),'status'=>'draft','score'=>0,'published_time'=>0,'keyword_id'=>0];
        if ($kind==='materials') {
            $url=Press::text($p['source_url']??'',2048);if($url!==''&&(!filter_var($url,FILTER_VALIDATE_URL)||!in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true)||parse_url($url,PHP_URL_USER)!==null))throw new Invalid('素材来源链接无效');
            $data+=['title'=>Press::text($p['title']??'',255,true),'category'=>Press::text($p['category']??'企业事实',80),'content'=>Press::text($p['content']??'',30000,true),'source_url'=>$url];
        }
        if ($kind==='evidence') {
            if ($id>0) throw new Invalid('检测证据不可覆盖，请新增记录');
            $url=Press::text($p['url']??'',2048,true);if (!filter_var($url,FILTER_VALIDATE_URL) || !in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true) || parse_url($url,PHP_URL_USER)!==null) throw new Invalid('请填写有效的回答或证据链接');
            $at=(int)($p['observed_at']??0);if ($at<=0 || $at>time()+300) throw new Invalid('请填写真实的观察时间');
            $data+=['question'=>Press::text($p['question']??'',500,true),'platform'=>Press::text($p['platform']??'',80,true),'answer'=>Press::text($p['answer']??'',30000,true),
                'rank_value'=>0,'mentioned'=>0,'status'=>'recorded_manual','error'=>'','sources_json'=>json_encode(['method'=>'manual','url'=>$url,'observed_at'=>$at],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)];
        }
        return Db::transaction(function() use($tenant,$user,$kind,$table,$id,$data,$p) {
            if ($id>0) {
                $row=self::q($table,$tenant,$user)->where(['id'=>$id,'delete_time'=>0])->lock(true)->find();if (!$row) throw new Invalid('记录不存在或无访问权限');
                if($kind==='materials'){if((int)($p['revision']??0)!==(int)$row['revision'])throw new Invalid('素材已更新，请刷新重试');$data['revision']=(int)$row['revision']+1;}
                self::q($table,$tenant,$user)->where('id',$id)->update($data);
            }else {
                $data+=['tenant_id'=>$tenant,'user_id'=>$user,'brand_id'=>BrandScope::id($tenant,$user),'create_time'=>time()];if ($kind!=='evidence') $data['delete_time']=0;if ($kind==='articles') $data['metadata_json']='{}';
                $id=(int)Db::name($table)->insertGetId($data);
            }
            return ['id'=>$id];
        });
    }
    public static function templates(int $tenant,int $user): array
    {
        $profile=self::profile($tenant,$user);if (!$profile['brand_name']) throw new Invalid('请先完善品牌名称');
        $brand=$profile['brand_name'];$industry=$profile['industry']?:'产品或服务';$count=0;
        return Db::transaction(function() use($tenant,$user,$brand,$industry,$count) {
            Db::name(MerchantAccountTables::name($tenant,'user'))->where(['tenant_id'=>$tenant,'id'=>$user])->lock(true)->find();
            foreach ([[$brand.'适合哪些客户？','品牌认知'],['选择'.$industry.'时应核实哪些条件？','产品选型'],[$brand.'有哪些可核实的客户案例？','信任验证'],[$brand.'与同类方案有哪些差异？','竞品比较'],['如何联系'.$brand.'并确认服务范围？','转化决策']] as [$question,$intent]) {
                if (self::q('aigc_geo_keyword',$tenant,$user)->where(['question'=>$question,'delete_time'=>0])->find()) continue;
                $created=self::save($tenant,$user,['kind'=>'questions','question'=>$question,'intent'=>$intent]);
                self::q('aigc_geo_keyword',$tenant,$user)->where('id',$created['id'])->update(['source'=>'local_template']);$count++;
            }
            return ['created'=>$count,'source'=>'local_templates'];
        });
    }
    public static function toPress(int $tenant,int $user,int $id): array
    {
        return Db::transaction(function() use($tenant,$user,$id) {
            $r=self::q('aigc_geo_article',$tenant,$user)->where(['id'=>$id,'delete_time'=>0])->lock(true)->find();if (!$r) throw new Invalid('文章不存在或无访问权限');
            $meta=json_decode($r['metadata_json']??'{}',true)?:[];$hash=hash('sha256',$r['title']."\n".$r['content']);$old=(int)($meta['press_draft_id']??0);
            if (($meta['press_content_hash']??'')===$hash && BrandScope::query('press_draft',$tenant,$user)->where('id',$old)->where('expires_at','>',time()+3600)->find()) return ['draft_id'=>$old,'replayed'=>true];
            $draft=Press::draftSave($tenant,$user,['title'=>mb_substr($r['title'],0,120),'body'=>$r['content']]);$meta['press_draft_id']=$draft['id'];$meta['press_content_hash']=$hash;
            self::q('aigc_geo_article',$tenant,$user)->where('id',$id)->update(['metadata_json'=>json_encode($meta,JSON_THROW_ON_ERROR)]);
            return ['draft_id'=>$draft['id'],'replayed'=>false];
        });
    }
    public static function questionImport(int $tenant,int $user,array $p):array
    {
        self::owner($tenant,$user);$questions=$p['questions']??null;if(!is_array($questions)||!array_is_list($questions)||count($questions)>100||!$questions)throw new Invalid('每次录入1至100个问题');$clean=[];foreach($questions as $q)$clean[]=Press::text($q,500,true);$clean=array_values(array_unique($clean));
        return Db::transaction(function()use($tenant,$user,$clean){Db::name(MerchantAccountTables::name($tenant,'user'))->where(['tenant_id'=>$tenant,'id'=>$user])->lock(true)->find();$created=0;foreach($clean as $q){if(self::q('aigc_geo_keyword',$tenant,$user)->where(['question'=>$q,'delete_time'=>0])->find())continue;self::save($tenant,$user,['kind'=>'questions','question'=>$q]);$created++;}return ['created'=>$created,'skipped'=>count($clean)-$created];});
    }
}
