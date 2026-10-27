<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use InvalidArgumentException as Invalid;
use app\common\service\app\AppAccessService;
use app\common\service\merchant\clip\{MerchantClipService as Clip,ClipCloudJobService,ClipIntegrationService};
use app\common\service\merchant\geo\{GeoVisibility as Visibility,GeoWorkflow as Workflow,GeoJobs,GeoConnections,GeoBrandScope};
use app\common\service\press\{PressService as Press,PressConfig,PressMoney};

/** Durable orchestration; every external operation remains in its existing paid queue. */
final class AutomationService
{
    private static function json(array $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    private static function localTime(int $stamp,string $format='Y/m/d H:i'):string{return (new \DateTimeImmutable('@'.$stamp))->setTimezone(new \DateTimeZone('Asia/Shanghai'))->format($format);}
    private static function q(string $table,int $t,int $u){return Db::name('oem_automation_'.$table)->where(['tenant_id'=>$t,'user_id'=>$u]);}
    private static function integer(mixed $v,int $min,int $max):int{return MerchantFilmService::number($v,$min,$max);}
    private static function owned(int $t,int $u,int $id,bool $lock=false):array
    {
        $r=self::q('plan',$t,$u)->where('id',$id)->lock($lock)->find();if(!$r)throw new Invalid('计划不存在或无访问权限');return $r;
    }
    private static function account(int $t,int $u):void
    {
        MerchantGeoService::owner($t,$u);
        if(!Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u,'is_disable'=>0])->whereNull('delete_time')->find())throw new Invalid('商家账号已停用');
        if(AppAccessService::assertTenantCanUse($t,'merchant_marketing',$u))throw new Invalid('商家营销服务未开通');
    }
    public static function options(int $t,int $u):array
    {
        self::account($t,$u);
        $geo=Db::name('oem_geo_project')->where(['tenant_id'=>$t,'user_id'=>$u])->whereIn('state',['diagnosis','active'])->field('id,title,brand_id,config_json')->order('id desc')->select()->toArray();
        foreach($geo as &$project){$scope=json_decode($project['config_json'],true)?:[];$project['scope']=array_intersect_key($scope,array_flip(['questions','platforms','region','search_mode','surface']));unset($project['config_json']);}
        return ['libraries'=>MerchantFilmService::libraries($t,$u)['lists'],
            'projects'=>Db::name('oem_clip_document')->where(['tenant_id'=>$t,'user_id'=>$u,'kind'=>'project','delete_time'=>0])->field('id,name,revision')->order('id desc')->select()->toArray(),
            'geo_projects'=>$geo,
            'video_ready'=>Clip::capabilities($t)['rendering'],'press_ready'=>Press::availability()['publishing_ready'],
            'text'=>GeoJobs::options($t,$u),'visibility'=>Visibility::options($t,$u)];
    }
    public static function media(int $t,int $u,array $p):array
    {
        self::account($t,$u);return Press::media(['kind'=>($p['kind']??'1'),'keyword'=>Press::text($p['keyword']??'',80),'page'=>max(1,(int)($p['page']??1))]);
    }
    public static function listing(int $t,int $u):array
    {
        self::account($t,$u);$rows=self::q('plan',$t,$u)->order('id desc')->select()->toArray();
        $history=[];$stock=[];$names=MerchantFilmService::scope('oem_film_library',$t,$u)->where('delete_time',0)->column('name','id');
        if($rows)foreach(self::q('run',$t,$u)->whereIn('plan_id',array_column($rows,'id'))->field('id,plan_id,sequence_no,state,stage,budget_cents,allocated_cents,note,create_time,finish_time')->order('id desc')->select()->toArray() as $run){$history[$run['plan_id']][]=$run;}
        foreach($rows as &$r){$r['config']=json_decode($r['config_json'],true);unset($r['config_json'],$r['config']['authority'],$r['config']['clip_config'],$r['config']['save_request']);
            $r['latest']=$history[$r['id']][0]??null;$r['recent_runs']=array_slice($history[$r['id']]??[],0,7);
            if($r['kind']==='video'){$lib=(int)$r['config']['library_id'];$r['config']['library_name']=$names[$lib]??'已不可用的成片库';
                try{if(!isset($stock[$lib]))$stock[$lib]=self::inventory($t,$u,$lib);$r['inventory']=$stock[$lib];}catch(Invalid $e){$r['inventory_error']=$e->getMessage();}}
        }
        $month=(new \DateTimeImmutable('first day of this month 00:00:00',new \DateTimeZone('Asia/Shanghai')))->getTimestamp();
        return ['lists'=>$rows,'heartbeat'=>(int)Db::name('oem_automation_heartbeat')->where('id',1)->value('beat_at',0),
            'server_time'=>time(),'timezone'=>'Asia/Shanghai',
            'stats'=>['month_runs'=>self::q('run',$t,$u)->where('create_time','>=',$month)->count()]];
    }
    /** Read-only readiness check: configuration and quotes only; never enqueues work. */
    public static function preflight(int $t,int $u,int $id):array
    {
        self::account($t,$u);$r=self::owned($t,$u,$id);$c=json_decode($r['config_json'],true);$checks=[];
        $running=self::q('run',$t,$u)->where(['plan_id'=>$id,'state'=>'running'])->find();
        $valid=(int)$r['expires_at']>time();$limit=$running||(int)$r['runs']<(int)$c['max_runs'];
        $checks[]=['key'=>'expiry','label'=>'授权有效期','state'=>$valid?'ok':'fail','note'=>$valid?'至 '.self::localTime((int)$r['expires_at']):'授权已到期，请复制为新计划'];
        $checks[]=['key'=>'limit','label'=>'执行轮数','state'=>$limit?'ok':'fail','note'=>$running?'继续当前轮，不重复创建任务':$r['runs'].' / '.$c['max_runs'].' 轮'];
        if($r['kind']==='video'){
            try{$assets=Clip::assets($t,$u,$c['clip_config']);$visual=in_array($c['clip_config']['mode'],['storyboard','script'],true)?array_filter($c['clip_config']['groups'],fn($g)=>empty($g['material_ids'])):empty($c['clip_config']['material_ids']);
                if($visual||!array_filter($assets,fn($a)=>in_array($a['kind'],['video','image'],true)))throw new Invalid('工程缺少镜头素材，请补齐并复制为新计划');
                if($c['clip_config']['mode']==='script'&&empty($c['clip_config']['script']['copy']))throw new Invalid('口播工程缺少文案，请补齐后复制为新计划');
                $checks[]=['key'=>'content','label'=>'工程素材快照','state'=>'ok','note'=>'镜头素材可用；视频和音频时长在实际编排时读取'];
            }catch(Invalid $e){$checks[]=['key'=>'content','label'=>'工程素材快照','state'=>'fail','note'=>$e->getMessage()];}
        }else{
            $ready=Visibility::asOwner($t,$u,fn()=>['diagnosis'=>Visibility::options($t,$u)['available'],'text'=>GeoJobs::options($t,$u)['text_available']],$c['brand_scope']??0);
            $ready['press']=Press::availability()['publishing_ready'];
            foreach(['diagnosis'=>'自动诊断与复测','text'=>'文章生成','press'=>'媒体发布'] as $key=>$label)$checks[]=['key'=>$key,'label'=>$label,'state'=>!empty($ready[$key])?'ok':'fail','note'=>!empty($ready[$key])?'服务已配置':'服务尚未配置完成'];
        }
        try{$pins=self::authority($t,$u,$r['kind'],$c,!$running);
            if($running&&isset($c['authority'])&&$pins!==$c['authority'])throw new Invalid('授权配置已变化，当前轮不能在新的连接下继续');
            $checks[]=['key'=>'resources','label'=>$r['kind']==='video'?'工程、成片库与云剪辑':'诊断、写作与媒体发布','state'=>'ok','note'=>'资源归属、服务权限与配置已核验'];
        }catch(Invalid $e){$checks[]=['key'=>'resources','label'=>'执行资源与服务','state'=>'fail','note'=>$e->getMessage()];}
        $beat=(int)Db::name('oem_automation_heartbeat')->where('id',1)->value('beat_at',0);
        $checks[]=['key'=>'scheduler','label'=>'服务器调度','state'=>$beat>time()-180?'ok':'warning','note'=>$beat>time()-180?'最近心跳 '.self::localTime($beat,'H:i:s'):'调度未就绪；启用后须等待服务器调度恢复'];
        return ['id'=>$id,'revision'=>(int)$r['revision'],'checks'=>$checks,'can_enable'=>!array_filter($checks,fn($x)=>$x['state']==='fail'),'running'=>(bool)$running,'server_time'=>time()];
    }
    private static function savedRequest(int $t,int $u,string $key,string $hash):?array
    {
        if($key==='')return null;
        foreach(self::q('plan',$t,$u)->field('id,config_json')->select()->toArray() as $r){$meta=json_decode($r['config_json'],true)['save_request']??[];
            if(($meta['key']??'')!==$key)continue;
            if(($meta['hash']??'')!==$hash)throw new Invalid('保存标识已用于其他内容，请重新打开配置');
            return ['id'=>(int)$r['id'],'replayed'=>true];}
        return null;
    }
    public static function records(int $t,int $u,int $id):array
    {
        self::owned($t,$u,$id);$rows=self::q('run',$t,$u)->where('plan_id',$id)->order('id desc')->limit(100)->select()->toArray();
        foreach($rows as &$r){$r['data']=json_decode($r['data_json'],true);unset($r['data_json']);$r['links']=Db::name('oem_automation_link')->where('run_id',$r['id'])->select()->toArray();}
        return ['lists'=>$rows];
    }
    public static function save(int $t,int $u,array $p):array
    {
        self::account($t,$u);$requestKey=(string)($p['request_key']??'');
        if($requestKey!==''&&!preg_match('/^[a-zA-Z0-9_-]{16,100}$/D',$requestKey))throw new Invalid('保存标识无效');
        $requestHash=hash('sha256',self::json($p));
        if($replay=self::savedRequest($t,$u,$requestKey,$requestHash))return $replay;
        $name=Press::text($p['name']??'',100,true);$kind=$p['kind']??'';
        if(!in_array($kind,['video','geo'],true))throw new Invalid('请选择自动化类型');
        $c=['max_runs'=>self::integer($p['max_runs']??10,1,20)];
        $days=self::integer($p['valid_days']??30,1,366);$c['valid_days']=$days;
        if($kind==='video'){
            $c+=['library_id'=>self::integer($p['library_id']??0,1,PHP_INT_MAX),'source_id'=>self::integer($p['source_id']??0,1,PHP_INT_MAX),
                'threshold'=>self::integer($p['threshold']??5,1,1000),'target'=>self::integer($p['target']??10,1,1000),
                'batch'=>self::integer($p['batch']??5,1,10),'interval_minutes'=>self::integer($p['interval_minutes']??60,15,1440)];
            if($c['target']<$c['threshold'])throw new Invalid('补充目标不能低于触发阈值');
            MerchantFilmService::library($t,$u,$c['library_id']);$doc=Clip::detail($t,$u,$c['source_id']);
            if($doc['kind']!=='project')throw new Invalid('请选择已保存的剪辑工程');$c['clip_config']=$doc['config'];$c['source_name']=$doc['name'];
            Clip::assets($t,$u,$c['clip_config']);
        }else{
            $c+=['source_id'=>self::integer($p['source_id']??0,1,PHP_INT_MAX),'interval_days'=>self::integer($p['interval_days']??7,1,30),
                'retest_days'=>self::integer($p['retest_days']??7,1,30),'articles'=>self::integer($p['articles']??1,1,3),
                'budget_cents'=>PressMoney::cents($p['budget_points']??'0'),'model_id'=>Press::text($p['model_id']??'',30),
                'media_ids'=>\app\common\service\merchant\clip\ClipConfiguration::ids($p['media_ids']??[],5)];
            if(!$c['media_ids']||$c['budget_cents']<100||$c['budget_cents']>100000000)throw new Invalid('请选择1至5家媒体，并设置1至100万TP的每轮预算');
            $source=Db::name('oem_geo_project')->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$c['source_id']])->whereIn('state',['diagnosis','active'])->find();
            if(!$source)throw new Invalid('请选择本商家已确认范围的GEO项目');$c['brand_scope']=(int)$source['brand_id'];$c['source_name']=$source['title'];
            $c['brand_id']=(int)Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'geo_scope'=>$c['brand_scope'],'delete_time'=>0])->value('id',0);
            $c['scope']=json_decode($source['config_json'],true);
            if(($c['scope']['region']??'')!=='全国'||($c['scope']['search_mode']??'')!=='search')throw new Invalid('自动诊断项目须为全国、search联网模式');
            if(Db::name('press_media')->whereIn('id',$c['media_ids'])->whereIn('kind',[1,2])->where('active',1)->count()!==count($c['media_ids']))throw new Invalid('所选媒体不可用');
            $c['media_names']=Db::name('press_media')->whereIn('id',$c['media_ids'])->field('id,name')->select()->toArray();
        }
        return Db::transaction(function()use($t,$u,$p,$kind,$name,$c,$days,$requestKey,$requestHash){
            $id=(int)($p['id']??0);$r=$id?self::owned($t,$u,$id,true):null;
            Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->lock(true)->find();
            if($replay=self::savedRequest($t,$u,$requestKey,$requestHash))return $replay;
            if($requestKey!=='')$c['save_request']=['key'=>$requestKey,'hash'=>$requestHash];
            if($id){if($r['state']==='active'||self::q('run',$t,$u)->where(['plan_id'=>$id,'state'=>'running'])->count())throw new Invalid('运行中的计划请先暂停；当前轮结束前不能修改范围');if((int)($p['revision']??0)!==(int)$r['revision'])throw new Invalid('计划已变化，请刷新');if($r['runs']>0)throw new Invalid('已执行计划请新建，保留原授权与记录');}
            elseif(self::q('plan',$t,$u)->count()>=100)throw new Invalid('最多保存100个自动化计划');
            $values=['name'=>$name,'kind'=>$kind,'config_json'=>self::json($c),'state'=>'paused','expires_at'=>time()+$days*86400,'revision'=>($r['revision']??0)+1,'update_time'=>time()];
            if($id)self::q('plan',$t,$u)->where('id',$id)->update($values);else $id=(int)Db::name('oem_automation_plan')->insertGetId($values+['tenant_id'=>$t,'user_id'=>$u,'create_time'=>time()]);return ['id'=>$id];
        });
    }
    private static function authority(int $t,int $u,string $kind,array $c,bool $checkQuote=false):array
    {
        self::account($t,$u);
        if($kind==='video'){
            if(AppAccessService::assertTenantCanUse($t,'smart_clip',$u))throw new Invalid('剪辑应用尚未授权');
            MerchantFilmService::library($t,$u,$c['library_id']);Clip::assets($t,$u,$c['clip_config']);$pins=[];
            foreach(['oss','ims'] as $code){$r=ClipIntegrationService::resolve($t,$code);$pins[$code]=[$r['source_tenant_id'],$r['revision']];}return $pins;
        }
        return Visibility::asOwner($t,$u,function()use($t,$u,$c,$checkQuote){
            if($c['brand_scope']&&!Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'geo_scope'=>$c['brand_scope'],'delete_time'=>0])->count())throw new Invalid('品牌已回收');
            $agent=(int)Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->value('agent_id');$v=Visibility::connection($t,$u);$text=GeoConnections::resolve($t,$agent,'text');
            $model=\app\common\service\merchant\geo\GeoTextRuntime::model($t,$text,(string)$c['model_id']);
            $press=PressConfig::resolve();PressConfig::assertPublishReady($press);
            if($checkQuote){
            $quote=\app\common\service\merchant\geo\GeoApiBilling::quote($t,'visibility_cn',$v['settings']);
            $media=Db::name('press_media')->whereIn('id',$c['media_ids'])->whereIn('kind',[1,2])->where('active',1)->where('config_revision',$press['revision'])->where('sync_time','>=',time()-86400)->select()->toArray();
            if(count($media)!==count($c['media_ids']))throw new Invalid('指定媒体已下架或报价超过24小时，请先同步媒体资源');
            $minimum=(int)ceil($quote['user']*count($c['scope']['questions'])*count($c['scope']['platforms'])*2*100);
            foreach($media as $m)$minimum+=PressMoney::retail((int)$m['cost_cents'],(int)$press['markup_bps'])*100*$c['articles'];
            if($minimum>$c['budget_cents'])throw new Invalid('每轮预算低于当前两轮诊断及指定媒体的报价合计，请增加预算后启用');
            }
            foreach($c['scope']['platforms'] as $platform)\app\common\service\merchant\geo\MoliVisibility::platform($platform,$c['scope']['surface']);
            $profile=MerchantGeoService::profile($t,$u);foreach(['brand_name','industry','products','customers'] as $field)if(empty($profile[$field]))throw new Invalid('请先完善企业知识库');
            return ['visibility'=>$v['stamp'],'text'=>$text['stamp'],'agent'=>$agent,'press'=>$press['account_hash'],'model'=>$model['id'],'profile_revision'=>$profile['revision']];
        },$c['brand_scope']);
    }
    public static function change(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){$r=self::owned($t,$u,(int)($p['id']??0),true);
            if((int)($p['revision']??0)!==(int)$r['revision'])throw new Invalid('计划状态已变化，请刷新');$action=$p['action']??'';$c=json_decode($r['config_json'],true);
            if($action==='pause')$values=['state'=>'paused','last_error'=>''];
            elseif($action==='enable'){
                if(($p['confirmed']??false)!==true)throw new Invalid('请明确确认自动执行范围与费用');
                if($r['expires_at']<=time())throw new Invalid('授权已到期，请新建计划');
                $running=self::q('run',$t,$u)->where(['plan_id'=>$r['id'],'state'=>'running'])->find();
                if(!$running&&(int)$r['runs']>=$c['max_runs'])throw new Invalid('已达到授权轮数，请新建计划');
                $authority=Visibility::asOwner($t,$u,fn()=>self::authority($t,$u,$r['kind'],$c,!$running),$c['brand_scope']??0);
                if($running&&isset($c['authority'])&&$c['authority']!==$authority)throw new Invalid('原任务配置已改变，请核对已有任务后重新建立计划');
                $c['authority']=$authority;$values=['state'=>'active','config_json'=>self::json($c),'next_at'=>time(),'last_error'=>''];
            }else throw new Invalid('不支持的计划操作');
            self::q('plan',$t,$u)->where('id',$r['id'])->update($values+['revision'=>(int)$r['revision']+1,'update_time'=>time()]);return ['id'=>$r['id']];
        });
    }
    /** Count usable videos, not raw asset rows. An unlimited library counts only never-assigned videos. */
    public static function inventory(int $t,int $u,int $lib):array
    {
        MerchantFilmService::library($t,$u,$lib);MerchantFilmService::sync($t,$u);$max=MerchantFinishedCatalogService::limit($t,$u,'video',$lib);$usage=MerchantFinishedCatalogService::usage($t,$u)['video'];$ready=0;
        foreach(MerchantFilmService::scope('oem_film_entry',$t,$u)->where('library_id',$lib)->column('asset_ref') as $ref){try{MerchantFilmService::asset($t,$u,$ref);$uses=(int)($usage[$ref]??0);if($max?$uses<$max:$uses===0)$ready++;}catch(Invalid){}}
        $pending=Db::name('oem_film_destination')->alias('d')->join('oem_clip_cloud_job j','j.id=d.task_id AND j.tenant_id=d.tenant_id AND j.user_id=d.user_id')->where(['d.tenant_id'=>$t,'d.user_id'=>$u,'d.library_id'=>$lib,'d.source'=>'clip','j.operation'=>'render'])->whereIn('j.state',['queued','preparing','submitting','submitted','unknown'])->count();
        return ['ready'=>$ready,'pending'=>$pending,'max_uses'=>$max];
    }
    public static function replenish(array $stock,array $c,bool $continuing=false):int
    {
        return $stock['ready']+$stock['pending']<($continuing?$c['target']:$c['threshold'])?min($c['batch'],max(0,$c['target']-$stock['ready']-$stock['pending'])):0;
    }
    private static function link(int $run,string $kind,int $id,int $cost=0):void
    {
        Db::name('oem_automation_link')->insert(['run_id'=>$run,'kind'=>$kind,'object_id'=>$id,'cost_cents'=>$cost]);
    }
    public static function reserve(int $run,string $key,int $cents):void
    {
        Db::transaction(function()use($run,$key,$cents){$r=Db::name('oem_automation_run')->where('id',$run)->lock(true)->find();if(!$r||$r['state']!=='running')throw new Invalid('自动化执行已结束');$d=json_decode($r['data_json'],true);if(isset($d['allocations'][$key])){if($d['allocations'][$key]!==$cents)throw new Invalid('原任务预算发生变化');return;}
            if($cents<0||(int)$r['allocated_cents']+$cents>(int)$r['budget_cents'])throw new Invalid('本轮剩余预算不足，已暂停后续付费步骤');
            $d['allocations'][$key]=$cents;Db::name('oem_automation_run')->where('id',$run)->update(['allocated_cents'=>(int)$r['allocated_cents']+$cents,'data_json'=>self::json($d)]);
        });
    }
    /** Called with the exact resolved model immediately before the native text request. */
    public static function authorizeText(int $job,array $upper):void
    {
        $link=Db::name('oem_automation_link')->where(['kind'=>'text','object_id'=>$job])->find();if(!$link)return;
        self::reserve((int)$link['run_id'],'text_'.$job,(int)ceil((float)$upper['user_charge_points']*100));
    }
    private static function patchRun(int $id,array $changes,array $extra=[]):void
    {
        $r=Db::name('oem_automation_run')->where('id',$id)->find();$d=json_decode($r['data_json'],true);Db::name('oem_automation_run')->where('id',$id)->update($changes+['data_json'=>self::json(array_replace($d,$extra))]);
    }
    public static function tick():bool
    {
        Db::name('oem_automation_heartbeat')->extra('IGNORE')->insert(['id'=>1,'beat_at'=>time()]);Db::name('oem_automation_heartbeat')->where('id',1)->update(['beat_at'=>time()]);
        $id=(int)Db::name('oem_automation_plan')->where('state','active')->where('next_at','<=',time())->order('next_at,id')->value('id',0);if(!$id)return false;
        try{Db::transaction(function()use($id){
            $p=Db::name('oem_automation_plan')->where(['id'=>$id,'state'=>'active'])->where('next_at','<=',time())->lock(true)->find();if(!$p)return;
            $t=(int)$p['tenant_id'];$u=(int)$p['user_id'];$c=json_decode($p['config_json'],true);
            if($p['expires_at']<=time())throw new Invalid('计划授权已到期');
            // Acquire the owner lock before any snapshot reads so concurrent plans see committed reservations.
            Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->lock(true)->find();
            $run=self::q('run',$t,$u)->where(['plan_id'=>$id,'state'=>'running'])->find();
            // Fresh quotes are needed before a new round, and Press::quote rechecks before ordering.
            // An expired listing must not interrupt polling an already-paid order or its delayed retest.
            if(Visibility::asOwner($t,$u,fn()=>self::authority($t,$u,$p['kind'],$c,!$run),$c['brand_scope']??0)!==($c['authority']??null))throw new Invalid('服务授权、企业资料或接口配置已变化，请重新核对计划');
            if(!$run){
                if((int)$p['runs']>=$c['max_runs']){Db::name('oem_automation_plan')->where('id',$id)->update(['state'=>'complete']);return;}
                $count=0;if($p['kind']==='video'){
                    $stock=self::inventory($t,$u,$c['library_id']);$last=self::q('run',$t,$u)->where('plan_id',$id)->order('id desc')->find();
                    $continuing=$last&&$last['state']==='success'&&!empty(json_decode($last['data_json'],true)['refill_pending']);
                    $count=self::replenish($stock,$c,$continuing);
                    if(!$count){if($continuing)self::patchRun((int)$last['id'],[],['refill_pending'=>false]);Db::name('oem_automation_plan')->where('id',$id)->update(['next_at'=>time()+$c['interval_minutes']*60,'update_time'=>time()]);return;}
                }
                $rid=(int)Db::name('oem_automation_run')->insertGetId(['plan_id'=>$id,'tenant_id'=>$t,'user_id'=>$u,'sequence_no'=>(int)$p['runs']+1,'budget_cents'=>$c['budget_cents']??0,'data_json'=>self::json(['count'=>$count]),'create_time'=>time()]);
                Db::name('oem_automation_plan')->where('id',$id)->update(['runs'=>(int)$p['runs']+1]);$run=Db::name('oem_automation_run')->find($rid);
            }
            Visibility::asOwner($t,$u,function()use($p,$c,$run){if($p['kind']==='video')self::video($p,$c,$run);else self::geo($p,$c,$run);},$c['brand_scope']??0);
            $current=Db::name('oem_automation_run')->find($run['id']);$next=time()+60;$state='active';
            if($current['state']==='success'){$next=time()+($p['kind']==='video'?$c['interval_minutes']*60:$c['interval_days']*86400);if((int)$run['sequence_no']>=$c['max_runs'])$state='complete';}
            Db::name('oem_automation_plan')->where('id',$id)->update(['state'=>$state,'next_at'=>$next,'update_time'=>time()]);
        });}catch(\Throwable $e){Db::name('oem_automation_plan')->where(['id'=>$id,'state'=>'active'])->update(['state'=>'blocked','last_error'=>mb_substr($e instanceof Invalid?$e->getMessage():'执行异常，已保留原任务，请管理员检查运行日志',0,500),'revision'=>Db::raw('revision+1'),'update_time'=>time()]);error_log('Automation '.$id.': '.$e->getMessage());}
        return true;
    }
    private static function video(array $p,array $c,array $r):void
    {
        $t=(int)$p['tenant_id'];$u=(int)$p['user_id'];$id=(int)$r['id'];$d=json_decode($r['data_json'],true);
        if($r['stage']==='start'){
            $doc=Clip::save($t,$u,['kind'=>'project','name'=>mb_substr($p['name'].' · 第'.$r['sequence_no'].'轮',0,100),'config'=>$c['clip_config']]);
            $plans=Clip::plan($t,$u,['id'=>$doc['id'],'revision'=>$doc['revision'],'count'=>$d['count'],'seed'=>'automation_'.$id]);
            if(!$plans['ids'])throw new Invalid('当前素材无法生成新组合，请补充素材');$jobs=[];
            foreach($plans['ids'] as $plan){$job=ClipCloudJobService::create($t,$u,'render',['id'=>$doc['id'],'revision'=>$doc['revision'],'plan_id'=>$plan]);$intent=MerchantFilmService::intent($t,$u,['source'=>'clip','library_id'=>$c['library_id']]);MerchantFilmService::bind($t,$u,$intent+['task_id'=>$job['id']]);self::link($id,'clip',(int)$job['id']);$jobs[]=(int)$job['id'];}
            self::patchRun($id,['stage'=>'render','note'=>'已提交云剪辑，完成后自动归库'],['project_id'=>$doc['id'],'jobs'=>$jobs]);return;
        }
        $jobs=Db::name('oem_clip_cloud_job')->whereIn('id',$d['jobs'])->select()->toArray();
        foreach($jobs as $j){if(in_array($j['state'],['failed','unknown'],true))throw new Invalid('剪辑任务 #'.$j['id'].' '.$j['error'].'；保留原任务，不自动重发');if($j['state']!=='success')return;}
        $stock=self::inventory($t,$u,$c['library_id']);self::patchRun($id,['state'=>'success','stage'=>'done','finish_time'=>time(),'note'=>'已补充 '.count($jobs).' 条视频到指定成片库'],['refill_pending'=>$stock['ready']+$stock['pending']<$c['target']]);
    }
    private static function projectAction(int $t,int $u,int $project,string $action,array $extra=[]):void
    {
        $r=Visibility::project($t,$u,$project);Workflow::change($t,$u,['id'=>$project,'revision'=>$r['revision'],'action'=>$action]+$extra);
    }
    private static function diagnose(int $t,int $u,int $run,int $project,string $phase):int
    {
        $quote=Visibility::preview($t,$u,$project);self::reserve($run,$phase,(int)round($quote['total']*100));
        $result=Visibility::enqueue($t,$u,['project_id'=>$project,'request_key'=>'automation_'.$run.'_'.$phase,'confirmed'=>true,'quote_key'=>$quote['quote_key']]);self::link($run,'monitor',(int)$result['id']);return (int)$result['id'];
    }
    private static function finishedMonitor(int $id):bool
    {
        $r=Db::name('oem_geo_monitor_run')->find($id);if(!$r)throw new Invalid('原诊断任务缺失');
        if($r['state']==='queued')return false;if($r['state']!=='success')throw new Invalid('诊断结果不完整或待核对，暂停自动创作及发稿，请查看原诊断记录');return true;
    }
    private static function geo(array $p,array $c,array $r):void
    {
        $t=(int)$p['tenant_id'];$u=(int)$p['user_id'];$id=(int)$r['id'];$d=json_decode($r['data_json'],true);$project=(int)($d['project_id']??0);
        if($r['stage']==='start'){
            $project=(int)Workflow::change($t,$u,['action'=>'create','request_key'=>'automation_project_'.$id,'title'=>$p['name'].' · 第'.$r['sequence_no'].'轮'])['id'];
            self::projectAction($t,$u,$project,'configure',$c['scope']);$monitor=self::diagnose($t,$u,$id,$project,'baseline');
            self::patchRun($id,['stage'=>'diagnose','note'=>'正在采集基线回答与引用证据'],['project_id'=>$project,'monitor_id'=>$monitor]);return;
        }
        if($r['stage']==='diagnose'){
            if(!self::finishedMonitor($d['monitor_id']))return;
            $cycle=Db::name('oem_geo_monitor_run')->where('id',$d['monitor_id'])->value('cycle_id');$subjects=[];
            foreach(Db::name('oem_geo_sample')->where('cycle_id',$cycle)->select()->toArray() as $s){$sample=json_decode($s['data_json'],true);if(!$sample['branded']&&!$sample['mentioned'])$subjects[$sample['question']]=$sample['question'];}
            if(!$subjects){self::patchRun($id,['state'=>'success','stage'=>'done','finish_time'=>time(),'note'=>'本轮未发现非品牌提问的未提及样本，无需新增文章和发稿']);return;}
            self::projectAction($t,$u,$project,'draftPlan');self::projectAction($t,$u,$project,'approve',['confirmed'=>true]);
            $subjects=array_slice(array_values($subjects),0,$c['articles']);$jobs=[];
            foreach($subjects as $index=>$subject){$job=GeoJobs::enqueue($t,$u,['operation'=>'write','request_key'=>'automation_write_'.$id.'_'.$index,'subject'=>$subject,'model_id'=>$c['model_id'],'style'=>'客观问答，依据企业知识库，事实不足必须标记待核实；不承诺收录、排名或效果']);self::link($id,'text',(int)$job['id']);$jobs[]=(int)$job['id'];}
            self::patchRun($id,['stage'=>'write','note'=>'根据未提及问题生成文章'],['jobs'=>$jobs]);return;
        }
        if($r['stage']==='write'){
            foreach($d['jobs'] as $job){$j=Db::name('oem_geo_job')->find($job);if(in_array($j['status'],['failed','review'],true))throw new Invalid('写作任务 #'.$job.' 未完成或费用待核对：'.$j['error']);if($j['status']!=='success')return;}
            $articles=[];foreach($d['jobs'] as $job){$import=GeoJobs::import($t,$u,$job);$article=(int)($import['ids'][0]??0);$a=GeoBrandScope::query('aigc_geo_article',$t,$u)->where('id',$article)->find();if(!$a||mb_strlen(trim($a['content']))<120||preg_match('/待核实|待补充|待确认|\[占位|TODO/u',$a['content']))throw new Invalid('生成稿件信息不足，已保留写作结果，请人工核对，未自动发稿');$articles[]=$article;}
            self::patchRun($id,['stage'=>'publish','note'=>'文章已入库，准备核价并向指定媒体投稿'],['articles'=>$articles]);return;
        }
        if($r['stage']==='publish'){
            $orders=[];foreach($d['articles'] as $article){$draft=MerchantGeoService::toPress($t,$u,$article);$payload=['draft_id'=>$draft['draft_id'],'media_ids'=>$c['media_ids']];$quote=Press::quote($t,$u,$payload);self::reserve($id,'press_'.$article,PressMoney::cents($quote['points']));
                $created=Press::create($t,$u,$payload+$quote+['request_key'=>'automation_press_'.$id.'_'.$article,'confirmed'=>true,'remark'=>'自动化计划：'.$p['name']]);foreach($created['ids'] as $order){self::link($id,'press',(int)$order);$orders[]=(int)$order;}}
            self::patchRun($id,['stage'=>'receipt','note'=>'已创建发稿订单，等待媒体真实发布回链'],['orders'=>$orders]);return;
        }
        if($r['stage']==='receipt'){
            foreach($d['orders'] as $order){$o=Db::name('press_order')->find($order);if(in_array($o['state'],['rejected','failed','blocked','unknown','cancelled'],true))throw new Invalid('媒体订单 #'.$order.' 需要处理：'.$o['failure_reason'].'；不会重复下单');if(!in_array($o['state'],['published','completed'],true)||!$o['published_url'])return;}
            self::patchRun($id,['stage'=>'wait_retest','note'=>'发布完成，等待 '.$c['retest_days'].' 天后复测'],['retest_at'=>time()+$c['retest_days']*86400]);return;
        }
        if($r['stage']==='wait_retest'){
            if(time()<$d['retest_at'])return;self::projectAction($t,$u,$project,'beginCycle');$monitor=self::diagnose($t,$u,$id,$project,'retest');self::patchRun($id,['stage'=>'retest','note'=>'按相同问题和平台复测'],['retest_id'=>$monitor]);return;
        }
        if($r['stage']==='retest'&&self::finishedMonitor($d['retest_id']))self::patchRun($id,['state'=>'success','stage'=>'done','finish_time'=>time(),'note'=>'诊断、文章、媒体回链与复测已保存，可查看本轮项目']);
    }
}
