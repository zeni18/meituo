<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use InvalidArgumentException as Invalid;

/** Durable async polling. POST uncertainty is quarantined, GET polling is recoverable. */
final class GeoVisibilityWorker
{
    public function __construct(private readonly MoliVisibility $provider=new MoliVisibility(),private readonly PartnerVisibility $partner=new PartnerVisibility()){}
    public function tick():bool
    {
        // Repair a crash after the last native settlement committed but before the batch was sealed.
        $completed=Db::name('oem_geo_monitor_run')->alias('repair_r')->where('repair_r.state','queued')->whereNotExists(function($q){$q->name('oem_geo_monitor_cell')->alias('repair_c')->join('oem_geo_job repair_j','repair_j.id=repair_c.job_id')->whereRaw('repair_c.run_id=repair_r.id')->whereNotIn('repair_j.status',['success','failed','review']);})->limit(10)->column('repair_r.id');foreach($completed as $id)GeoVisibility::finishRun((int)$id);
        $stale=Db::name('oem_geo_monitor_cell')->alias('c')->join('oem_geo_job j','j.id=c.job_id')->where('j.status','submitting')->where('c.lease_until','<',time())->field('j.id,c.run_id')->limit(10)->select()->toArray();
        foreach($stale as $s){Db::name('oem_geo_job')->where(['id'=>$s['id'],'status'=>'submitting'])->update(['status'=>'review','error'=>'提交进程中断，预扣保留待管理端核对；不会自动重复提交','update_time'=>time()]);GeoVisibility::finishRun((int)$s['run_id']);}
        $lease=bin2hex(random_bytes(16));$job=Db::transaction(function()use($lease){$c=Db::name('oem_geo_monitor_cell')->alias('c')->join('oem_geo_job j','j.id=c.job_id')->whereIn('j.status',['queued','polling'])->where('c.next_at','<=',time())->where('c.lease_until','<',time())->field('c.*')->order('c.next_at,c.job_id')->lock(true)->find();if(!$c)return null;$j=Db::name('oem_geo_job')->where('id',$c['job_id'])->find();Db::name('oem_geo_monitor_cell')->where('job_id',$j['id'])->update(['lease_until'=>time()+90,'lease_token'=>$lease]);if($j['status']==='queued')Db::name('oem_geo_job')->where('id',$j['id'])->update(['status'=>'submitting','started_at'=>time(),'update_time'=>time()]);return $j+['cell'=>$c];});if(!$job)return false;
        $original=app()->request;$req=new \app\Request();$req->withServer($original->server());$req->tenantId=(int)$job['tenant_id'];$req->userId=(int)$job['user_id'];$req->userInfo=['tenant_id'=>$req->tenantId,'user_id'=>$req->userId];app()->instance('request',$req);$req->geoBrandScope=['tenant'=>$req->tenantId,'user'=>$req->userId,'scope'=>(int)($job['brand_id']??0)];
        $p=json_decode($job['payload_json'],true);$connection=null;$attempted=false;$poll=$job['status']==='polling';$consumption=(int)$job['consumption_id'];
        try{
            $r=GeoVisibility::project($req->tenantId,$req->userId,(int)$p['project_id']);$connection=GeoVisibility::connection($req->tenantId,$req->userId);$authority=json_decode($job['authority_json'],true);if((int)$connection['agent_id']!==(int)$authority['agent_id']||!hash_equals($authority['stamp'],$connection['stamp']))throw new Invalid('监测授权、配置或商家归属已变化');
            $partner=GeoVisibilityProviders::code($connection['settings'])==='geo_partner';
            if(($p['provider']??'moli')!==GeoVisibilityProviders::code($connection['settings']))throw new Invalid('任务接入协议与原配置不一致');
            if(!$poll){if(!in_array($r['state'],['diagnosis','active'],true))throw new Invalid('项目已暂停，未启动的采样已取消');$cycle=Db::name('oem_geo_cycle')->where(['id'=>$p['cycle_id'],'project_id'=>$r['id'],'state'=>'open'])->find();if(!$cycle)throw new Invalid('诊断轮次已封存');GeoApiBilling::quote($req->tenantId,'visibility_cn',$connection['settings']);
                if(!$consumption)throw new Invalid('未找到原生算力预扣，拒绝付费调用');
                $body=['prompts'=>[$p['question']],'platforms'=>[['platform'=>$p['provider_platform'],'mode'=>'search','screenshot'=>1]],'consumerTaskId'=>hash('sha256','geo:'.$req->tenantId.':'.$job['id'].':'.$job['input_hash']),'monitorKeywords'=>$p['brand'],'monitorKeywordAliases'=>$p['aliases']];$attempted=true;
                if($partner)$task=$this->partner->submit($connection,$p,$body['consumerTaskId']);
                else{$data=$this->provider->request($connection,'POST','/api/business/monitor/task/batch/shared',$body);$task=$data['taskId']??'';if(!is_string($task)||!preg_match('/^[a-zA-Z0-9-]{8,64}$/D',$task)||(int)($data['totalTask']??0)!==1)throw new GeoProviderFailure(true,'供应商提交回执缺少正确任务ID或计量数量');}
                $this->cell($job,$lease,['provider_task_id'=>$task,'next_at'=>time()+($partner?60:10)]);$this->job($job,'polling',[],'');
            }else{
                if((int)$job['started_at']<time()-86400)throw new Invalid('采样超过24小时，原预扣待管理端核对');$task=(string)$job['cell']['provider_task_id'];
                if($partner){$queries=(int)(json_decode($job['result_json'],true)['query_attempts']??0);if($queries>=30)throw new PartnerVisibilityReview('已达到30次结果查询上限，停止自动查询；请管理员核对原任务及供方费用');$this->job($job,'polling',['query_attempts'=>$queries+1],'');$data=$this->partner->request($connection,'GET','/api/v1/runs/'.PartnerVisibility::taskId($task));$result=PartnerVisibility::normalize($data,$p,$task,(int)$job['started_at']);}
                else{$data=$this->provider->request($connection,'GET','/api/business/monitor/task/result/'.$task);$result=MoliVisibility::normalize($data,$p,$task,(int)$job['started_at']);}
                if($result===null){$this->cell($job,$lease,['next_at'=>time()+($partner?60:15)]);return true;}
                Db::transaction(function()use($job,$p,$result,$consumption){GeoWorkflow::recordAutomatic((int)$job['tenant_id'],(int)$job['user_id'],$p,$result,(int)$job['id']);GeoApiBilling::finish($consumption,true);$this->job($job,'success',$result,'');});
            }
        }catch(PartnerVisibilityReview $e){$this->job($job,'review',json_decode($job['result_json'],true)?:[],$e->getMessage());
        }catch(GeoProviderFailure $e){
            if($poll&&$e->uncertain){$this->cell($job,$lease,['next_at'=>time()+60]);Db::name('oem_geo_job')->where('id',$job['id'])->update(['error'=>($partner?'供应商结果暂不可用，继续查询原任务；查询可能产生供方费用，不重新提交采样':'供应商结果暂不可用，继续查询原任务，不重复提交或计费'),'update_time'=>time()]);}
            elseif($poll&&!$e->uncertain){
                // Only a validated matching terminal subtask can justify a refund after acceptance.
                if($e->getMessage()==='该问题采样失败，未计为品牌未提及'){GeoApiBilling::finish($consumption,false);$this->job($job,'failed',[],$e->getMessage());}else $this->job($job,'review',[],'已提交的采样查询被拒绝，预扣保留待核对');
            }else{if(!$e->uncertain)GeoApiBilling::finish($consumption,false);$this->job($job,$e->uncertain?'review':'failed',[],$e->getMessage());}
        }catch(\Throwable $e){if(!$poll&&!$attempted){GeoApiBilling::finish($consumption,false);$this->job($job,'failed',[],$e instanceof Invalid?$e->getMessage():'采样未启动，预扣已退回');}else $this->job($job,'review',[],$e instanceof Invalid?$e->getMessage():'监测结果或结算待核对，原预扣保留');}
        finally{$this->cell($job,$lease,['lease_until'=>0,'lease_token'=>'']);app()->instance('request',$original);GeoVisibility::finishRun((int)$job['cell']['run_id']);}
        return true;
    }
    private function job(array $j,string $status,array $result,string $error):void{Db::name('oem_geo_job')->where('id',$j['id'])->update(['status'=>$status,'result_json'=>GeoVisibility::json($result),'error'=>$error,'update_time'=>time(),'finish_time'=>in_array($status,['success','failed','review'],true)?time():0]);}
    private function cell(array $j,string $lease,array $values):void{Db::name('oem_geo_monitor_cell')->where(['job_id'=>$j['id'],'lease_token'=>$lease])->update($values);}
}
