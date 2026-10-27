<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use think\facade\Db;
use app\common\service\merchant\MerchantGeoService as Geo;
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;

/** Project orchestration only. Provider keys, paid generation and publishing stay in the original services. */
final class GeoWorkflow
{
    private const PLATFORMS=['DeepSeek','豆包','腾讯元宝','通义千问','文心一言','纳米AI','Kimi','智谱AI','蚂蚁阿福','夸克','微博智搜','抖音AI','ChatGPT','Google AI','Bing AI','小红书点点'];
    private static function json(array $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    private static function decode(string $v):array{return json_decode($v,true)?:[];}
    private static function q(string $table,int $t,int $u){Geo::owner($t,$u);return GeoBrandScope::query('oem_geo_'.$table,$t,$u);}
    private static function project(int $t,int $u,int $id,bool $lock=false):array{$q=self::q('project',$t,$u)->where('id',$id);if($lock)$q->lock(true);$r=$q->find();if(!$r)throw new Invalid('优化项目不存在或无访问权限');return $r;}
    private static function row(string $table,int $t,int $u,int $id,int $project):array{$r=self::q($table,$t,$u)->where(['id'=>$id,'project_id'=>$project])->find();if(!$r)throw new Invalid('关联记录不存在或无访问权限');return $r;}
    private static function lines(mixed $v,int $max=30):array{if(!is_array($v)||!array_is_list($v)||!$v||count($v)>$max)throw new Invalid('请填写1至'.$max.'条内容');$out=[];foreach($v as $s)$out[]=Press::text($s,500,true);return array_values(array_unique($out));}
    private static function contains(string $text,array $names):bool{foreach($names as $name)if($name!==''&&mb_stripos($text,$name)!==false)return true;return false;}
    private static function touch(array $r,array $changes=[]):array{$changes+=['revision'=>(int)$r['revision']+1,'update_time'=>time()];Db::name('oem_geo_project')->where(['id'=>$r['id'],'tenant_id'=>$r['tenant_id'],'user_id'=>$r['user_id']])->update($changes);return array_replace($r,$changes);}
    public static function view(int $t,int $u,array $p):array
    {
        $id=(int)($p['id']??0);if(!$id){$page=max(1,(int)($p['page']??1));$q=self::q('project',$t,$u);return ['lists'=>$q->field('id,title,state,revision,active_plan_id,draft_plan_id,next_report_at,create_time,update_time')->order('id desc')->page($page,20)->select()->toArray(),'count'=>self::q('project',$t,$u)->count(),'page'=>$page];}
        $r=self::project($t,$u,$id);$r['config']=self::decode($r['config_json']);unset($r['config_json'],$r['request_key']);
        $cycles=self::q('cycle',$t,$u)->where('project_id',$id)->order('cycle_no desc')->select()->toArray();foreach($cycles as &$c){$c['report']=self::decode($c['report_json']);unset($c['report_json']);}unset($c);
        $plans=self::q('plan',$t,$u)->where('project_id',$id)->order('version desc')->select()->toArray();foreach($plans as &$plan){$plan['data']=self::decode($plan['data_json']);unset($plan['data_json']);}unset($plan);
        $actions=self::q('action',$t,$u)->where(['project_id'=>$id,'plan_id'=>$r['active_plan_id']])->order('id')->select()->toArray();foreach($actions as &$a){$a['data']=self::decode($a['data_json']);unset($a['data_json']);$a['links']=self::links($t,$u,(int)$a['id']);}unset($a);
        $sampleTotal=self::q('sample',$t,$u)->where('project_id',$id)->count();$samples=self::q('sample',$t,$u)->where('project_id',$id)->order('id desc')->limit(300)->select()->toArray();foreach($samples as &$s){$s['data']=self::decode($s['data_json']);unset($s['data_json']);}unset($s);
        $reports=self::q('progress_report',$t,$u)->where('project_id',$id)->order('id desc')->limit(20)->select()->toArray();foreach($reports as &$report){$report['data']=self::decode($report['data_json']);unset($report['data_json']);}
        return ['project'=>$r,'cycles'=>$cycles,'plans'=>$plans,'actions'=>$actions,'samples'=>$samples,'sample_total'=>$sampleTotal,'reports'=>$reports,'monitoring'=>GeoVisibility::options($t,$u),'schedule'=>GeoVisibility::scheduleView($t,$u,$id)];
    }
    public static function change(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){
            $op=(string)($p['action']??'');
            if($op==='create'){
                Geo::owner($t,$u);$key=Press::text($p['request_key']??'',80,true);if(!preg_match('/^[a-zA-Z0-9_-]{16,80}$/D',$key))throw new Invalid('请求键无效');
                // Serialize creation per merchant, including retries from multiple tabs.
                Db::name('oem_merchant')->where(['tenant_id'=>$t,'user_id'=>$u])->lock(true)->find();$old=self::q('project',$t,$u)->where('request_key',$key)->find();if($old)return ['id'=>$old['id'],'replayed'=>true];
                if(self::q('project',$t,$u)->count()>=50)throw new Invalid('最多保留50个优化项目');$profile=Geo::profile($t,$u);$title=Press::text($p['title']??(($profile['brand_name']?:'品牌').' GEO优化'),255,true);
                $id=Db::name('oem_geo_project')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'brand_id'=>GeoBrandScope::id($t,$u),'request_key'=>$key,'title'=>$title,'config_json'=>'{}','create_time'=>time(),'update_time'=>time()]);return ['id'=>$id];
            }
            $r=self::project($t,$u,(int)($p['id']??0),true);if((int)($p['revision']??0)!==(int)$r['revision'])throw new Invalid('项目已更新，请刷新后重试');$id=(int)$r['id'];$config=self::decode($r['config_json']);
            if($op==='configure'){
                if($r['state']!=='setup')throw new Invalid('诊断范围已确认，需新建项目改变基线');$profile=Geo::profile($t,$u);$diagnosisOnly=($p['diagnosis_only']??false)===true;foreach($diagnosisOnly?['brand_name']:['brand_name','industry','products','customers']as $field)if(empty(trim((string)$profile[$field])))throw new Invalid($diagnosisOnly?'请先填写品牌名称':'请先完善品牌名称、行业、产品服务和目标客户');
                $questions=self::lines($p['questions']??[]);$platforms=self::lines($p['platforms']??[],16);foreach($platforms as $v)if(!in_array($v,self::PLATFORMS,true))throw new Invalid('目标平台无效');
                $aliases=isset($p['aliases'])&&$p['aliases']?self::lines($p['aliases'],10):[];$aliases=array_values(array_unique([$profile['brand_name'],...$aliases]));$days=(int)($p['report_days']??7);if(!in_array($days,[7,14,30],true))throw new Invalid('报告周期无效');
                $config=['profile'=>array_intersect_key($profile,array_flip(['brand_name','website','industry','intro','products','customers','competitors','revision'])),'questions'=>$questions,'platforms'=>$platforms,'aliases'=>$aliases,'region'=>Press::text($p['region']??'全国',80,true),'surface'=>in_array($p['surface']??'',['网页端','App端'],true)?$p['surface']:'网页端','search_mode'=>Press::text($p['search_mode']??'默认模式',80,true),'report_days'=>$days];
                if($diagnosisOnly)$config['diagnosis_only']=true;
                $r=self::touch($r,['config_json'=>self::json($config),'state'=>'diagnosis']);self::newCycle($t,$u,$id,1);
            }elseif($op==='sample'){
                self::assertNoMonitor($t,$u,$id,(int)($p['cycle_id']??0));
                if(self::q('sample',$t,$u)->where('project_id',$id)->count()>=3000)throw new Invalid('此项目已达到3000条采样上限，请新建项目');
                if(!in_array($r['state'],['diagnosis','active'],true))throw new Invalid('当前阶段不能采样');$cycle=self::row('cycle',$t,$u,(int)($p['cycle_id']??0),$id);if($cycle['state']!=='open')throw new Invalid('本轮诊断已封存，请新建复测');
                $question=Press::text($p['question']??'',500,true);$platform=Press::text($p['platform']??'',80,true);if(!in_array($question,$config['questions'],true)||!in_array($platform,$config['platforms'],true))throw new Invalid('问题或平台不在已确认范围内');
                $at=(int)($p['observed_at']??0);if((int)$cycle['cycle_no']>1){$plan=self::row('plan',$t,$u,(int)$r['active_plan_id'],$id);if($at<(int)$plan['approved_at'])throw new Invalid('复测必须使用计划确认后的观察结果');}
                $answer=Press::text($p['answer']??'',30000,true);$url=Press::text($p['url']??'',2048,true);$hash=hash('sha256',self::json([$question,$platform,$at,$answer,$url]));if(self::q('sample',$t,$u)->where(['cycle_id'=>$cycle['id'],'sample_hash'=>$hash])->find())throw new Invalid('这条采样已保存');
                $e=Geo::save($t,$u,['kind'=>'evidence','question'=>$question,'platform'=>$platform,'answer'=>$answer,'url'=>$url,'observed_at'=>$at]);$mentioned=self::contains($answer,$config['aliases']);$accuracy=(string)($p['accuracy']??'unknown');if(!in_array($accuracy,['correct','incorrect','unknown'],true))throw new Invalid('核对状态无效');
                $data=['question'=>$question,'platform'=>$platform,'observed_at'=>$at,'answer'=>$answer,'url'=>$url,'mentioned'=>$mentioned,'branded'=>self::contains($question,$config['aliases']),'recommended'=>$mentioned&&!empty($p['recommended']),'accuracy'=>$accuracy,'method'=>'manual','environment'=>array_intersect_key($config,array_flip(['region','surface','search_mode']))];
                Db::name('oem_geo_sample')->insert(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'cycle_id'=>$cycle['id'],'evidence_id'=>$e['id'],'sample_hash'=>$hash,'data_json'=>self::json($data),'create_time'=>time()]);$r=self::touch($r);
            }elseif($op==='closeCycle'){
                if(!in_array($r['state'],['diagnosis','active'],true))throw new Invalid('请先继续项目后再封存诊断');
                self::assertNoMonitor($t,$u,$id,(int)($p['cycle_id']??0));
                $cycle=self::row('cycle',$t,$u,(int)($p['cycle_id']??0),$id);if($cycle['state']!=='open')throw new Invalid('本轮已封存');$report=self::cycleReport($t,$u,$r,$cycle);if(!$report['samples'])throw new Invalid('至少保存一条真实采样后才能诊断');if($report['missing']&&!isset($p['accept_partial']))throw new Invalid('采样范围未覆盖完整，请确认按部分样本生成');if($report['missing']&&empty($p['accept_partial']))throw new Invalid('请确认部分样本范围');
                self::q('cycle',$t,$u)->where('id',$cycle['id'])->update(['state'=>'sealed','report_json'=>self::json($report),'close_time'=>time()]);$r=self::touch($r);if((int)$cycle['cycle_no']>1)self::progress($r,time());
            }elseif($op==='draftPlan'){
                if(self::q('plan',$t,$u)->where('project_id',$id)->count()>=50)throw new Invalid('此项目已达到50个计划版本，请新建项目');
                if($r['draft_plan_id'])throw new Invalid('已有待确认计划，请先修改或确认');if($r['state']==='paused'||$r['state']==='setup')throw new Invalid('当前阶段不能生成计划');$cycle=self::q('cycle',$t,$u)->where(['project_id'=>$id,'state'=>'sealed'])->order('cycle_no desc')->find();if(!$cycle)throw new Invalid('请先完成真实诊断');
                $samples=self::q('sample',$t,$u)->where('cycle_id',$cycle['id'])->select()->toArray();$items=[];$evidence=array_column($samples,'id');
                $incorrect=array_filter($samples,fn($s)=>(self::decode($s['data_json'])['accuracy']??'')==='incorrect');
                if($incorrect)$items[]=['kind'=>'facts','title'=>'核对并修正品牌公开信息','detail'=>'对照已批准的品牌事实，核对回答中的错误信息，整理可核实来源并更新对应页面。','why'=>'本轮有人工标记的信息不准确样本；具体原因需要核验来源。','due_days'=>7,'evidence_ids'=>array_values(array_column($incorrect,'id'))];
                $gaps=[];foreach($samples as $s){$d=self::decode($s['data_json']);if(!$d['branded']&&!$d['mentioned'])$gaps[$d['question']][]=(int)$s['id'];}
                foreach(array_slice($gaps,0,3,true)as $question=>$ids)$items[]=['kind'=>'content','title'=>mb_substr('补充内容：'.$question,0,255),'detail'=>'围绕该问题整理有案例、来源和适用范围的内容，审核事实后入库。','why'=>'本轮该非品牌问题存在未提及样本。内容缺口是待验证假设，不能据此断言AI遗漏的原因。','due_days'=>7,'evidence_ids'=>$ids];
                if(!$gaps)$items[]=['kind'=>'content','title'=>'补充可核查的服务场景与客户问答','detail'=>'根据本轮问题整理事实、案例和FAQ，人工审核后入库。','why'=>'基于本轮观察维护内容；现有样本不支持保证新增曝光的结论。','due_days'=>7,'evidence_ids'=>$evidence];
                $items[]=['kind'=>'publish','title'=>'选择适合的媒体并确认发布','detail'=>'从已授权真实媒体资源选择渠道，核对稿件和现有报价，再手动确认发稿。','why'=>'用于验证内容分发的效果，发布不代表被AI引用；通道未开通时可标记阻塞。','due_days'=>14,'evidence_ids'=>$evidence];
                $items[]=['kind'=>'verify','title'=>'按已确认问题进行阶段复测','detail'=>'保持相同问题、平台、地区和模式，采集计划确认后的实际回答并封存本轮报告。','why'=>'通过同范围复测观察变化，不以一次回答或发稿完成推断效果。','due_days'=>14,'evidence_ids'=>$evidence];
                $data=['source'=>'evidence_rules','note'=>'按真实采样生成的规则建议，可编辑；不产生AI调用或发布费用。','scope'=>'内容、发布和复测均逐项执行；费用沿用平台现有标准。','items'=>$items];$version=1+(int)self::q('plan',$t,$u)->where('project_id',$id)->max('version');
                $plan=Db::name('oem_geo_plan')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'version'=>$version,'cycle_id'=>$cycle['id'],'data_json'=>self::json($data),'create_time'=>time()]);$r=self::touch($r,['draft_plan_id'=>$plan]);
            }elseif(in_array($op,['savePlan','approve'],true)){
                $plan=self::row('plan',$t,$u,(int)$r['draft_plan_id'],$id);if($plan['state']!=='draft')throw new Invalid('计划已确认，不可覆盖');$data=self::decode($plan['data_json']);
                if($op==='savePlan'){$data['scope']=Press::text($p['scope']??'',2000,true);$items=$p['items']??null;if(!is_array($items)||!array_is_list($items)||!$items||count($items)>20)throw new Invalid('计划保留1至20项任务');$clean=[];foreach($items as $item){if(!is_array($item)||!in_array($item['kind']??'',['facts','content','publish','verify'],true))throw new Invalid('任务类型无效');$refs=$item['evidence_ids']??[];if(!is_array($refs)||count($refs)>1000)throw new Invalid('诊断依据无效');$valid=[];foreach(array_unique($refs)as $ref){$sample=self::row('sample',$t,$u,(int)$ref,$id);if((int)$sample['cycle_id']!==(int)$plan['cycle_id'])throw new Invalid('依据不属于本轮诊断');$valid[]=(int)$ref;}$clean[]=['kind'=>$item['kind'],'title'=>Press::text($item['title']??'',255,true),'detail'=>Press::text($item['detail']??'',3000,true),'why'=>Press::text($item['why']??'',2000,true),'due_days'=>max(1,min(90,(int)($item['due_days']??7))),'evidence_ids'=>$valid];}$data['items']=$clean;self::q('plan',$t,$u)->where('id',$plan['id'])->update(['data_json'=>self::json($data)]);$r=self::touch($r);
                }else{if(empty($p['confirmed']))throw new Invalid('请明确确认计划后执行');if($r['state']==='paused')throw new Invalid('项目已暂停');if(self::q('cycle',$t,$u)->where(['project_id'=>$id,'state'=>'open'])->find())throw new Invalid('请先封存当前采样轮次，再确认新的计划版本');self::q('plan',$t,$u)->where('id',$plan['id'])->update(['state'=>'approved','approved_at'=>time()]);foreach($data['items']as $item)Db::name('oem_geo_action')->insert(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'plan_id'=>$plan['id'],'kind'=>$item['kind'],'title'=>$item['title'],'note'=>'','data_json'=>self::json($item),'update_time'=>time()]);$r=self::touch($r,['active_plan_id'=>$plan['id'],'draft_plan_id'=>0,'state'=>'active','next_report_at'=>time()+$config['report_days']*86400]);self::progress($r,time());}
            }elseif($op==='beginCycle'){
                if($r['state']!=='active'||!$r['active_plan_id'])throw new Invalid('请先确认优化计划');if(self::q('cycle',$t,$u)->where(['project_id'=>$id,'state'=>'open'])->find())throw new Invalid('已有进行中的采样');$no=1+(int)self::q('cycle',$t,$u)->where('project_id',$id)->max('cycle_no');self::newCycle($t,$u,$id,$no,(int)$r['active_plan_id']);$r=self::touch($r);
            }elseif(in_array($op,['task','link'],true)){
                $a=self::action($t,$u,$r,(int)($p['task_id']??0));
                if($op==='link'){self::attach($t,$u,$a,(string)($p['kind']??''),(int)($p['object_id']??0));$r=self::touch($r);}
                else{$state=(string)($p['state']??'');if(!in_array($state,['todo','doing','done','blocked'],true))throw new Invalid('任务状态无效');$note=Press::text($p['note']??'',3000);if($state==='done')self::canComplete($t,$u,$r,$a,$note);self::q('action',$t,$u)->where('id',$a['id'])->update(['state'=>$state,'note'=>$note,'update_time'=>time()]);$r=self::touch($r);}
            }elseif(in_array($op,['pause','resume'],true)){
                if(!in_array($r['state'],['active','paused'],true))throw new Invalid('确认计划后才能暂停或继续');$r=self::touch($r,['state'=>$op==='pause'?'paused':'active','next_report_at'=>$op==='pause'?0:time()+$config['report_days']*86400]);
            }elseif($op==='report'){if(!$r['active_plan_id'])throw new Invalid('确认计划后可生成进度报告');self::progress($r,time());$r=self::touch($r);
            }else throw new Invalid('不支持的项目操作');
            return ['id'=>$id,'revision'=>$r['revision']];
        });
    }
    private static function newCycle(int $t,int $u,int $id,int $no,int $plan=0):void{Db::name('oem_geo_cycle')->insert(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'cycle_no'=>$no,'report_json'=>self::json(['plan_id'=>$plan]),'create_time'=>time()]);}
    private static function cycleReport(int $t,int $u,array $r,array $cycle):array
    {
        $config=self::decode($r['config_json']);$rows=self::q('sample',$t,$u)->where('cycle_id',$cycle['id'])->select()->toArray();$groups=['brand'=>['samples'=>0,'mentions'=>0,'recommendations'=>0],'discovery'=>['samples'=>0,'mentions'=>0,'recommendations'=>0]];$covered=[];$incorrect=0;$automatic=0;
        foreach($rows as $row){$d=self::decode($row['data_json']);$automatic+=(int)(($d['method']??'manual')==='automatic');$key=$d['branded']?'brand':'discovery';$groups[$key]['samples']++;$groups[$key]['mentions']+=(int)$d['mentioned'];$groups[$key]['recommendations']+=(int)$d['recommended'];$covered[$d['platform']."\n".$d['question']]=true;$incorrect+=(int)($d['accuracy']==='incorrect');}
        foreach($groups as &$group)$group['mention_rate']=$group['samples']?round($group['mentions']/$group['samples']*100,2):null;
        return ['plan_id'=>(int)(self::decode($cycle['report_json'])['plan_id']??0),'method'=>$automatic?($automatic===count($rows)?'automatic':'mixed'):'manual','samples'=>count($rows),'covered'=>count($covered),'expected'=>count($config['questions'])*count($config['platforms']),'missing'=>count($config['questions'])*count($config['platforms'])-count($covered),'groups'=>$groups,'incorrect'=>$incorrect,'automatic_samples'=>$automatic,'automatic_visibility'=>null,'note'=>$automatic?'保存供应商实际回答与引用证据；失败或缺失样本不计入提及率分母。结果仅代表本轮样本，提及不代表推荐或全网曝光率。':'真实人工采样，非自动监测；按品牌问题/非品牌问题分组，仅代表本轮样本，不是全网曝光率。'];
    }
    private static function assertNoMonitor(int $t,int $u,int $project,int $cycle):void
    {
        $run=GeoBrandScope::query('oem_geo_monitor_run',$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$project,'cycle_id'=>$cycle])->find();if($run&&in_array($run['state'],['queued','review'],true))throw new Invalid('本轮有执行中或待核对的自动采样，请先处理原任务');
    }
    public static function recordAutomatic(int $t,int $u,array $p,array $data,int $job):void
    {
        $r=self::project($t,$u,(int)$p['project_id'],true);$cycle=self::row('cycle',$t,$u,(int)$p['cycle_id'],(int)$r['id']);$hash=hash('sha256','automatic-job:'.$job);if(self::q('sample',$t,$u)->where(['cycle_id'=>$cycle['id'],'sample_hash'=>$hash])->find())return;if($cycle['state']!=='open')throw new Invalid('原诊断轮次已封存，结果待核对');$config=self::decode($r['config_json']);
        $data['mentioned']=self::contains($data['answer'],$config['aliases']);$data['branded']=self::contains($data['question'],$config['aliases']);
        $e=Db::name('aigc_geo_diagnosis')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'brand_id'=>GeoBrandScope::id($t,$u),'question'=>$data['question'],'platform'=>$data['platform'],'answer'=>$data['answer'],'rank_value'=>0,'mentioned'=>(int)$data['mentioned'],'status'=>'recorded_auto','error'=>'','sources_json'=>self::json(['method'=>'automatic','job_id'=>$job,'url'=>$data['url'],'observed_at'=>$data['observed_at'],'references'=>$data['references'],'citations'=>$data['citations']]),'create_time'=>time()]);
        Db::name('oem_geo_sample')->insert(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$r['id'],'cycle_id'=>$cycle['id'],'evidence_id'=>$e,'sample_hash'=>$hash,'data_json'=>self::json($data),'create_time'=>time()]);self::touch($r);
    }
    public static function sealAutomatic(array $r,int $cycleId):void
    {
        $t=(int)$r['tenant_id'];$u=(int)$r['user_id'];$cycle=self::row('cycle',$t,$u,$cycleId,(int)$r['id']);if($cycle['state']!=='open')return;$report=self::cycleReport($t,$u,$r,$cycle);if(!$report['samples'])return;self::q('cycle',$t,$u)->where('id',$cycleId)->update(['state'=>'sealed','report_json'=>self::json($report),'close_time'=>time()]);self::touch($r);if((int)$cycle['cycle_no']>1)self::progress($r,time());
    }
    private static function action(int $t,int $u,array $r,int $id):array{$a=self::row('action',$t,$u,$id,(int)$r['id']);if($r['state']!=='active'||(int)$a['plan_id']!==(int)$r['active_plan_id'])throw new Invalid('任务不属于当前已确认且运行中的计划');return $a;}
    private static function object(int $t,int $u,string $kind,int $id):array
    {
        $table=match($kind){'job'=>'oem_geo_job','article'=>'aigc_geo_article','order'=>'press_order','material'=>'oem_geo_material','cycle'=>'oem_geo_cycle',default=>throw new Invalid('关联类型无效')};$q=GeoBrandScope::query($table,$t,$u)->where(['tenant_id'=>$t,'user_id'=>$u,'id'=>$id]);if(in_array($kind,['article','material'],true))$q->where('delete_time',0);$r=$q->find();if(!$r)throw new Invalid('关联记录不存在或无访问权限');return $r;
    }
    private static function attach(int $t,int $u,array $a,string $kind,int $id):void{$object=self::object($t,$u,$kind,$id);if($kind==='cycle'&&(int)$object['project_id']!==(int)$a['project_id'])throw new Invalid('复测不属于此项目');$where=['tenant_id'=>$t,'user_id'=>$u,'action_id'=>$a['id'],'kind'=>$kind,'object_id'=>$id];if(!self::q('action_link',$t,$u)->where($where)->find())Db::name('oem_geo_action_link')->insert($where);}
    private static function links(int $t,int $u,int $id):array{$rows=self::q('action_link',$t,$u)->where('action_id',$id)->select()->toArray();foreach($rows as &$r){try{$o=self::object($t,$u,$r['kind'],(int)$r['object_id']);$r['title']=$o['title']??('记录 #'.$r['object_id']);$r['state']=$o['status']??$o['state']??'draft';if($r['kind']==='job'){$pub=GeoJobs::publicRow($o);$r['title']=$pub['subject'];$r['billing_status']=$pub['billing_status'];$r['consumption_id']=$pub['consumption_id'];$r['user_points']=$pub['user_points'];$r['imported_ids']=$pub['result']['imported_ids']??[];}}catch(Invalid){$r['state']='unavailable';$r['title']='关联记录已不可用';}}return $rows;}
    private static function canComplete(int $t,int $u,array $r,array $a,string $note):void
    {
        $links=self::q('action_link',$t,$u)->where('action_id',$a['id'])->select()->toArray();foreach($links as $link){$o=self::object($t,$u,$link['kind'],(int)$link['object_id']);if($a['kind']==='publish'&&$link['kind']==='order'&&$o['state']==='published')return;if($a['kind']==='content'&&$link['kind']==='article')return;if($a['kind']==='verify'&&$link['kind']==='cycle'&&(int)$o['cycle_no']>1&&$o['state']==='sealed'&&(int)(self::decode($o['report_json'])['plan_id']??0)===(int)$r['active_plan_id'])return;}
        if($a['kind']==='facts'&&mb_strlen($note)>=10)return;throw new Invalid(match($a['kind']){'publish'=>'请先关联实际已发布的订单回执','content'=>'请先关联已审核入库的文章','verify'=>'请先关联本项目已封存的复测轮次',default=>'请填写至少10字的人工核验说明'});
    }
    public static function generate(int $t,int $u,array $p):array
    {
        return Db::transaction(function()use($t,$u,$p){$r=self::project($t,$u,(int)($p['project_id']??0),true);$a=self::action($t,$u,$r,(int)($p['task_id']??0));if($a['kind']!=='content'||($p['operation']??'')!=='write')throw new Invalid('此任务不能创建文章生成');$result=GeoJobs::enqueue($t,$u,$p);self::attach($t,$u,$a,'job',(int)$result['id']);self::q('action',$t,$u)->where('id',$a['id'])->update(['state'=>'doing','update_time'=>time()]);self::touch($r);return $result;});
    }
    private static function progress(array $r,int $due):void
    {
        $t=(int)$r['tenant_id'];$u=(int)$r['user_id'];$id=(int)$r['id'];$existing=self::q('progress_report',$t,$u)->where(['project_id'=>$id,'due_at'=>$due])->find();if($existing){if((int)(self::decode($existing['data_json'])['plan_id']??0)===(int)$r['active_plan_id'])return;$due=1+max($due,(int)self::q('progress_report',$t,$u)->where('project_id',$id)->max('due_at'));}
        $actions=self::q('action',$t,$u)->where(['project_id'=>$id,'plan_id'=>$r['active_plan_id']])->select()->toArray();$baseline=self::q('cycle',$t,$u)->where(['project_id'=>$id,'cycle_no'=>1,'state'=>'sealed'])->find();$latest=self::q('cycle',$t,$u)->where(['project_id'=>$id,'state'=>'sealed'])->order('cycle_no desc')->find();
        $data=['plan_id'=>(int)$r['active_plan_id'],'total'=>count($actions),'done'=>count(array_filter($actions,fn($a)=>$a['state']==='done')),'blocked'=>count(array_filter($actions,fn($a)=>$a['state']==='blocked')),'baseline'=>$baseline?self::decode($baseline['report_json']):null,'latest'=>$latest?self::decode($latest['report_json']):null,'has_retest'=>$latest&&(int)$latest['cycle_no']>1&&(int)(self::decode($latest['report_json'])['plan_id']??0)===(int)$r['active_plan_id'],'latest_cycle_no'=>(int)($latest['cycle_no']??0),'automatic_monitoring'=>$latest&&(self::decode($latest['report_json'])['method']??'')==='automatic','notice'=>'按实际任务和封存样本汇总；人工与自动采样分开标识，覆盖或采样方法不同不可直接归因优化效果。无复测时不推断提升。'];
        Db::name('oem_geo_progress_report')->insert(['tenant_id'=>$t,'user_id'=>$u,'project_id'=>$id,'due_at'=>$due,'data_json'=>self::json($data),'create_time'=>time()]);
    }
    /** Free internal progress summaries only. Never invokes models, monitoring or publishing. */
    public static function tickReports():int
    {
        $rows=Db::name('oem_geo_project')->where('state','active')->where('next_report_at','>',0)->where('next_report_at','<=',time())->order('next_report_at')->limit(10)->select()->toArray();$count=0;
        foreach($rows as $row){try{GeoBrandScope::with((int)$row['tenant_id'],(int)$row['user_id'],(int)$row['brand_id'],fn()=>Db::transaction(function()use($row,&$count){$t=(int)$row['tenant_id'];$u=(int)$row['user_id'];Geo::owner($t,$u);if(\app\common\service\app\AppAccessService::assertTenantCanUse($t,'merchant_marketing',$u))return;$r=self::project($t,$u,(int)$row['id'],true);if($r['state']!=='active'||!(int)$r['next_report_at']||(int)$r['next_report_at']>time())return;self::progress($r,(int)$r['next_report_at']);$c=self::decode($r['config_json']);self::touch($r,['next_report_at'=>time()+$c['report_days']*86400]);$count++;}));}catch(Invalid){continue;}}
        return $count;
    }
}
