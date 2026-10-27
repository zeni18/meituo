<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\service\merchant\{MerchantGeoService as Geo,MerchantAccountTables};
use app\common\service\point\PointService;
use app\common\service\app\AppAccessService;
use InvalidArgumentException as Invalid;

/** Free previews, explicit paid runs, and finite merchant-approved recheck schedules. */
final class GeoVisibility
{
    public static function json(array $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    public static function asOwner(int $t,int $u,callable $fn,int $brandScope=0):mixed
    {
        $original=app()->request;$req=new \app\Request();$req->withServer($original->server());$req->tenantId=$t;$req->userId=$u;$req->userInfo=['tenant_id'=>$t,'user_id'=>$u];app()->instance('request',$req);try{return GeoBrandScope::with($t,$u,$brandScope,$fn);}finally{app()->instance('request',$original);}
    }
    public static function project(int $t,int $u,int $id,bool $lock=false):array
    {
        Geo::owner($t,$u);$q=GeoBrandScope::query('oem_geo_project',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$id]);if($lock)$q->lock(true);$r=$q->find();if(!$r)throw new Invalid('优化项目不存在或无访问权限');return $r;
    }
    public static function connection(int $t,int $u):array
    {
        Geo::owner($t,$u);if(AppAccessService::assertTenantCanUse($t,'merchant_marketing',$u))throw new Invalid('商家营销服务已停用');
        if(!Db::name(MerchantAccountTables::name($t,'user'))->where(['id'=>$u,'tenant_id'=>$t,'is_disable'=>0])->whereNull('delete_time')->find())throw new Invalid('商家账号已停用');
        $agent=(int)Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->value('agent_id');return GeoConnections::resolve($t,$agent,'visibility_cn')+['agent_id'=>$agent];
    }
    public static function options(int $t,int $u):array
    {
        $platforms=GeoVisibilityProviders::platforms(['provider'=>'geo_partner']);
        $out=['available'=>false,'provider'=>'GEO服务商 API','unit'=>\app\common\service\PointUnitService::unit(),'platforms'=>$platforms['网页端'],'platforms_by_surface'=>$platforms,'modes'=>['search'],'notice'=>'请在接入能力配置中填写监测服务 API Key，并配置原市场按次售价；OEM可借用平台授权。'];
        try{$r=self::connection($t,$u);$out['provider']=GeoVisibilityProviders::name($r['settings']);$out['platforms_by_surface']=GeoVisibilityProviders::platforms($r['settings']);$out['platforms']=$out['platforms_by_surface']['网页端'];$q=GeoApiBilling::quote($t,'visibility_cn',$r['settings']);$out+=['price'=>$q['user']];$out['available']=true;$out['notice']=GeoVisibilityProviders::code($r['settings'])==='geo_partner'?'按问题×平台计次，按本平台算力标准预扣。供方受理后失败或取消不自动退款，异常保留预扣待核对；返回实际回答、引用与可用截图。':'按问题×平台计次，使用平台现有算力标准；联网模式含截图，轮询不另收费。';}catch(\Throwable){}return $out;
    }
    private static function scope(array $r,array $settings):array
    {
        if(!in_array($r['state'],['diagnosis','active'],true))throw new Invalid('请先确认检测范围并继续项目');$c=json_decode($r['config_json'],true);
        if(($c['search_mode']??'')!=='search')throw new Invalid('本接入使用 search 联网模式。请新建相同核心问题、search模式的项目，原范围仍可人工采样');
        if(($c['region']??'')!=='全国')throw new Invalid('当前自动接入使用供应商随机国内节点，请以“全国”建立独立范围；指定城市范围仍可人工采样');
        $cells=[];foreach($c['questions']as $question)foreach($c['platforms']as $platform)$cells[]=['question'=>$question,'platform'=>$platform,'provider'=>GeoVisibilityProviders::code($settings),'provider_platform'=>GeoVisibilityProviders::platform($settings,$platform,$c['surface']),'environment'=>array_intersect_key($c,array_flip(['region','surface','search_mode']))];
        if(!$cells||count($cells)>150)throw new Invalid('自动诊断每轮最多150个问题×平台组合');return [$c,$cells];
    }
    private static function estimate(array $r,array $connection):array
    {
        [$c,$cells]=self::scope($r,$connection['settings']);$q=GeoApiBilling::quote((int)$r['tenant_id'],'visibility_cn',$connection['settings']);return [$c,$cells,$q];
    }
    public static function preview(int $t,int $u,int $id):array
    {
        $r=self::project($t,$u,$id);$connection=self::connection($t,$u);[$config,$cells,$q]=self::estimate($r,$connection);$cycle=Db::name('oem_geo_cycle')->where(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'state'=>'open'])->find();
        if(!$cycle)throw new Invalid('请先建立本轮诊断/复测');if(Db::name('oem_geo_monitor_run')->where('cycle_id',$cycle['id'])->find())throw new Invalid('本轮已提交自动诊断，请查看原任务，避免重复调用');
        if(Db::name('oem_geo_sample')->where('cycle_id',$cycle['id'])->count())throw new Invalid('本轮已有采样。请封存后另建纯自动复测轮次，避免混合采样影响比较');
        $hash=hash('sha256',self::json([$id,(int)$cycle['id'],$config,$q,$connection['stamp'],$connection['agent_id']]));
        return ['project_id'=>$id,'cycle_id'=>(int)$cycle['id'],'calls'=>count($cells),'price'=>$q['user'],'total'=>round(count($cells)*$q['user'],2),'unit'=>\app\common\service\PointUnitService::unit(),'quote_key'=>$hash,'surface'=>$config['surface'],'mode'=>'search','notice'=>GeoVisibilityProviders::code($connection['settings'])==='geo_partner'?'将问题发送至已配置的GEO服务商。已受理任务失败或取消时，供方不自动退款，本平台保留预扣待核对；不会自动重新付费采样。截图可能缺失或过期；范围为全国，不代表指定城市。':'将检测问题、品牌名称与别名发送至已配置监测服务。全国范围为供应商随机国内节点；失败样本退回预扣，未知状态留待核对。'];
    }
    public static function enqueue(int $t,int $u,array $p):array
    {
        $id=(int)($p['project_id']??0);$key=(string)($p['request_key']??'');if(!preg_match('/^[A-Za-z0-9_-]{16,80}$/D',$key))throw new Invalid('请求键格式不正确');if(($p['confirmed']??false)!==true)throw new Invalid('请确认本轮采样及费用');
        return Db::transaction(function()use($t,$u,$p,$id,$key){self::project($t,$u,$id,true);$old=GeoBrandScope::query('oem_geo_monitor_run',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'request_key'=>$key])->find();if($old){if((int)$old['project_id']!==$id)throw new Invalid('请求键已用于其他项目');return ['id'=>(int)$old['id'],'replayed'=>true];}
            $preview=self::preview($t,$u,$id);if(!hash_equals($preview['quote_key'],(string)($p['quote_key']??'')))throw new Invalid('范围、授权或现有市场价格已变化，请重新预览确认');return self::insert($t,$u,$id,$key,$preview);
        });
    }
    private static function insert(int $t,int $u,int $id,string $key,array $preview):array
    {
        $r=self::project($t,$u,$id);$connection=self::connection($t,$u);[$config,$cells,$quote]=self::estimate($r,$connection);
        if(Db::name('oem_geo_sample')->where(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id])->count()+count($cells)>3000)throw new Invalid('项目采样将超过3000条，请新建项目');
        Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u])->lock(true)->find();
        if(Db::name('oem_geo_job')->where(['tenant_id'=>$t,'user_id'=>$u,'operation'=>'visibility'])->whereIn('status',['queued','submitting','polling'])->count()+count($cells)>150)throw new Invalid('请等待当前自动诊断完成');
        PointService::assertCanConsumeAmounts($t,$u,round($quote['tenant']*count($cells),2),round($quote['user']*count($cells),2));
        $run=(int)Db::name('oem_geo_monitor_run')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'cycle_id'=>$preview['cycle_id'],'request_key'=>$key,'expected'=>count($cells),'create_time'=>time()]);
        foreach($cells as $cell){$payload=$cell+['subject'=>$cell['question'],'project_id'=>$id,'cycle_id'=>$preview['cycle_id'],'run_id'=>$run,'quote'=>$quote,'brand'=>$config['profile']['brand_name'],'aliases'=>$config['aliases']];$job=(int)Db::name('oem_geo_job')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'brand_id'=>GeoBrandScope::id($t,$u),'request_key'=>'vis_'.hash('sha256',$run.self::json($cell)),'input_hash'=>hash('sha256',self::json($payload)),'operation'=>'visibility','payload_json'=>self::json($payload),'authority_json'=>self::json(['agent_id'=>$connection['agent_id'],'stamp'=>$connection['stamp']]),'result_json'=>'{}','create_time'=>time(),'update_time'=>time()]);Db::name('oem_geo_monitor_cell')->insert(['job_id'=>$job,'run_id'=>$run]);
            // Reserve the entire confirmed run atomically; other spending cannot partially exhaust its budget.
            $jobRow=Db::name('oem_geo_job')->where('id',$job)->find();GeoApiBilling::reserve($jobRow,$quote);
        }
        return ['id'=>$run,'replayed'=>false];
    }
    public static function schedule(int $t,int $u,array $p):array
    {
        $id=(int)($p['project_id']??0);return Db::transaction(function()use($t,$u,$p,$id){$r=self::project($t,$u,$id,true);$old=Db::name('oem_geo_monitor_schedule')->where(['project_id'=>$id,'tenant_id'=>$t,'user_id'=>$u])->lock(true)->find();if(!isset($p['revision'])||(int)$p['revision']!==(int)($old['revision']??0))throw new Invalid('复测设置已变化，请刷新');$enabled=($p['enabled']??false)===true;
            if(!$enabled){if($old)Db::name('oem_geo_monitor_schedule')->where('id',$old['id'])->update(['enabled'=>0,'revision'=>(int)$old['revision']+1,'update_time'=>time()]);return ['enabled'=>false];}
            if(($p['confirmed']??false)!==true||$r['state']!=='active'||!$r['active_plan_id'])throw new Invalid('请先确认优化计划，并明确确认定期复测预算');
            $connection=self::connection($t,$u);[$config,$cells,$quote]=self::estimate($r,$connection);$days=(int)($p['interval_days']??0);$runs=(int)($p['remaining_runs']??0);$max=$p['max_user_points']??null;
            if(!in_array($days,[1,7,14,30],true)||$runs<1||$runs>52||!is_numeric($max)||(float)$max<0||(float)$max>1000000)throw new Invalid('请填写有效周期、1至52轮及每轮费用上限');if($runs*$days>366)throw new Invalid('授权的复测总周期不能超过366天，请减少轮数');$max=round((float)$max,2);if($max<round(count($cells)*$quote['user'],2))throw new Invalid('每轮费用上限低于当前市场预估');
            $data=['enabled'=>1,'interval_days'=>$days,'remaining_runs'=>$runs,'max_user_points'=>$max,'authority_stamp'=>hash('sha256',$connection['stamp'].':'.$connection['agent_id']),'plan_id'=>$r['active_plan_id'],'next_at'=>time()+$days*86400,'expires_at'=>time()+min(366,$runs*$days+1)*86400,'last_error'=>'','revision'=>(int)($old['revision']??0)+1,'update_time'=>time()];
            if($old)Db::name('oem_geo_monitor_schedule')->where('id',$old['id'])->update($data);else Db::name('oem_geo_monitor_schedule')->insert($data+['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id]);return ['enabled'=>true];});
    }
    public static function scheduleView(int $t,int $u,int $id):?array
    {
        self::project($t,$u,$id);$r=GeoBrandScope::query('oem_geo_monitor_schedule',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id])->find();if($r)unset($r['authority_stamp']);return $r;
    }
    public static function tickSchedules():int
    {
        $rows=Db::name('oem_geo_monitor_schedule')->where('enabled',1)->where('next_at','<=',time())->order('next_at')->limit(5)->select()->toArray();$count=0;
        foreach($rows as $row){$scope=(int)Db::name('oem_geo_project')->where(['id'=>$row['project_id'],'tenant_id'=>$row['tenant_id'],'user_id'=>$row['user_id']])->value('brand_id');self::asOwner((int)$row['tenant_id'],(int)$row['user_id'],function()use($row,&$count){Db::transaction(function()use($row,&$count){$t=(int)$row['tenant_id'];$u=(int)$row['user_id'];$id=(int)$row['project_id'];$r=GeoBrandScope::query('oem_geo_project',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$id])->lock(true)->find();$s=Db::name('oem_geo_monitor_schedule')->where('id',$row['id'])->lock(true)->find();if(!$s['enabled']||(int)$s['next_at']>time())return;
            try{if(!$r||$r['state']!=='active'||(int)$r['active_plan_id']!==(int)$s['plan_id'])throw new Invalid('项目暂停或优化计划变化，请重新确认定期复测');Geo::owner($t,$u);if((int)$s['remaining_runs']<=0||(int)$s['expires_at']<time())throw new Invalid('确认的复测次数已用完或授权周期已到期');
                $c=self::connection($t,$u);if(!hash_equals($s['authority_stamp'],hash('sha256',$c['stamp'].':'.$c['agent_id'])))throw new Invalid('监测授权或配置发生变化，请重新确认');[$config,$cells,$quote]=self::estimate($r,$c);if(round(count($cells)*$quote['user'],2)>(float)$s['max_user_points'])throw new Invalid('当前市场预估超过已确认的每轮费用上限');
                if(Db::name('oem_geo_cycle')->where(['project_id'=>$id,'state'=>'open'])->find())throw new Invalid('已有未封存轮次，请完成后重新启用复测');
                // Nested transaction/savepoint rolls the new cycle back if reservation fails.
                Db::transaction(function()use($t,$u,$r,$s){GeoWorkflow::change($t,$u,['id'=>$r['id'],'revision'=>$r['revision'],'action'=>'beginCycle']);$preview=self::preview($t,$u,(int)$r['id']);self::insert($t,$u,(int)$r['id'],'schedule_'.$s['id'].'_'.$s['revision'].'_'.$s['next_at'],$preview);});
                $left=(int)$s['remaining_runs']-1;Db::name('oem_geo_monitor_schedule')->where('id',$s['id'])->update(['remaining_runs'=>$left,'enabled'=>$left>0?1:0,'next_at'=>time()+(int)$s['interval_days']*86400,'last_error'=>'','revision'=>(int)$s['revision']+1,'update_time'=>time()]);$count++;
            }catch(\Throwable $e){Db::name('oem_geo_monitor_schedule')->where('id',$s['id'])->update(['enabled'=>0,'last_error'=>$e instanceof Invalid?mb_substr($e->getMessage(),0,500):'复测未启动，请检查余额和监测服务后重新启用','revision'=>(int)$s['revision']+1,'update_time'=>time()]);}
        });},$scope);}return $count;
    }
    public static function records(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$q=GeoBrandScope::query('oem_geo_monitor_run',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u]);if(!empty($p['project_id'])){self::project($t,$u,(int)$p['project_id']);$q->where('project_id',(int)$p['project_id']);}if(!empty($p['id']))$q->where('id',(int)$p['id']);$count=(clone $q)->count();$rows=$q->order('id desc')->page(max(1,(int)($p['page']??1)),20)->select()->toArray();
        foreach($rows as &$r){$jobs=Db::name('oem_geo_monitor_cell')->alias('c')->join('oem_geo_job j','j.id=c.job_id')->where(['c.run_id'=>$r['id'],'j.tenant_id'=>$t,'j.user_id'=>$u])->field(empty($p['id'])?'j.id,j.status':'j.*')->order('j.id')->select()->toArray();$r['jobs']=empty($p['id'])?$jobs:array_map(fn($j)=>GeoJobs::publicRow($j),$jobs);$r['success']=count(array_filter($jobs,fn($j)=>$j['status']==='success'));$r['failed']=count(array_filter($jobs,fn($j)=>$j['status']==='failed'));}return ['lists'=>$rows,'count'=>$count];
    }
    public static function finishRun(int $run):void
    {
        $r=Db::name('oem_geo_monitor_run')->where('id',$run)->find();if(!$r)return;$jobs=Db::name('oem_geo_monitor_cell')->alias('c')->join('oem_geo_job j','j.id=c.job_id')->where('c.run_id',$run)->field('j.status')->select()->toArray();$statuses=array_column($jobs,'status');if(array_diff($statuses,['success','failed','review']))return;
        $state=in_array('review',$statuses,true)?'review':(in_array('success',$statuses,true)?(in_array('failed',$statuses,true)?'partial':'success'):'failed');
        Db::transaction(function()use($r,$state){$project=Db::name('oem_geo_project')->where(['id'=>$r['project_id'],'tenant_id'=>$r['tenant_id'],'user_id'=>$r['user_id']])->lock(true)->find();Db::name('oem_geo_monitor_run')->where('id',$r['id'])->update(['state'=>$state,'finish_time'=>time()]);if($project&&in_array($state,['success','partial'],true)){try{Geo::owner((int)$r['tenant_id'],(int)$r['user_id']);}catch(Invalid){return;}GeoBrandScope::with((int)$project['tenant_id'],(int)$project['user_id'],(int)$project['brand_id'],fn()=>GeoWorkflow::sealAutomatic($project,(int)$r['cycle_id']));}});
    }
    /** Admin binds the already-created supplier receipt. This never resubmits or charges again. */
    public static function recover(int $tenant,int $actor,array $p):array
    {
        return Db::transaction(function()use($tenant,$actor,$p){$q=Db::name('oem_geo_job')->where(['id'=>(int)($p['job_id']??0),'operation'=>'visibility','status'=>'review']);if($tenant)$q->where('tenant_id',$tenant);$j=$q->lock(true)->find();if(!$j)throw new Invalid('待核对任务不存在或无权限');$t=(int)$j['tenant_id'];$u=(int)$j['user_id'];$cell=Db::name('oem_geo_monitor_cell')->where('job_id',$j['id'])->find();$task=trim((string)($p['provider_task_id']??$cell['provider_task_id']));
            if(!preg_match('/^[A-Za-z0-9_-]{8,64}$/D',$task)||mb_strlen(trim((string)($p['note']??'')))<10)throw new Invalid('请填写已核对的供应商原任务ID及至少10字核对说明');if($cell['provider_task_id']!==''&&$cell['provider_task_id']!==$task)throw new Invalid('不得替换已保存的供应商任务ID');if((int)$j['started_at']<time()-86400)throw new Invalid('任务已超过自动取回窗口，请按原消费单人工对账处理');
            self::asOwner($t,$u,function()use($j,$t,$u){$r=self::connection($t,$u);$a=json_decode($j['authority_json'],true);if((int)$a['agent_id']!==(int)$r['agent_id']||!hash_equals($a['stamp'],$r['stamp']))throw new Invalid('原授权或配置已变化，须人工对账，不能使用新账号查询旧任务');$c=Db::name('ai_consumption_log')->where(['id'=>$j['consumption_id'],'tenant_id'=>$t,'user_id'=>$u])->find();if(!$c||$c['billing_status']!=='reserved')throw new Invalid('原消费单已处理，请勿重复结算');});
            Db::name('oem_geo_monitor_cell')->where('job_id',$j['id'])->update(['provider_task_id'=>$task,'next_at'=>0,'lease_until'=>0,'lease_token'=>'']);Db::name('oem_geo_job')->where('id',$j['id'])->update(['status'=>'polling','result_json'=>'{}','error'=>'管理员已绑定原任务回执，正在取回结果','finish_time'=>0,'update_time'=>time()]);Db::name('oem_geo_monitor_run')->where('id',$cell['run_id'])->update(['state'=>'queued','finish_time'=>0]);$summary=json_decode((string)Db::name('ai_consumption_log')->where('id',$j['consumption_id'])->value('response_summary'),true)?:[];$summary['geo_receipt_recovery']=['admin_tenant_id'=>$tenant,'actor_id'=>$actor,'note'=>mb_substr(trim((string)$p['note']),0,500),'provider_task_id'=>$task,'at'=>time()];Db::name('ai_consumption_log')->where(['id'=>$j['consumption_id'],'tenant_id'=>$t,'user_id'=>$u])->update(['response_summary'=>self::json($summary)]);Db::name('oem_geo_audit')->insert(['tenant_id'=>$t,'agent_id'=>0,'capability'=>'visibility_cn','action'=>'recover_receipt','actor_id'=>$actor,'revision'=>$j['id'],'create_time'=>time()]);return ['id'=>(int)$j['id']];});
    }
}
