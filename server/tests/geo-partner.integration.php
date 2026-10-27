<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantGeoService as Geo};
use app\common\service\merchant\geo\{PartnerVisibility as P,PartnerVisibilityReview,GeoVisibilityProviders as Providers,GeoVisibility as V,GeoVisibilityWorker as Worker,GeoWorkflow as W,GeoConnections as C,GeoProviderFailure,MoliVisibility};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local test DB required');
$passed=0;$failure=null;$original=app()->request;$prefix='partner'.bin2hex(random_bytes(4));
function ok(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function reject(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException|GeoProviderFailure|PartnerVisibilityReview){ok(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try {
    ok(P::origin('https://118.89.28.187/api/v1/')==='https://118.89.28.187','documented public IP and API suffix normalized');
    foreach(['http://118.89.28.187','https://127.0.0.1','https://10.0.0.1','https://100.100.100.200','https://example.com:443','https://user@example.com','https://example.com/api/v1?key=a','https://example.com/api-docs','https://[::1]'] as $url)reject(fn()=>P::origin($url),'reject unsafe origin '.$url);
    ok(Providers::code([])==='moli','existing configurations retain original protocol');
    ok(P::platform('通义千问','网页端')==='qwen'&&P::platform('通义千问','App端')==='qianwen_mobile','exact provider platform identifiers retained');
    ok(count(P::PLATFORMS['网页端'])===13&&count(P::PLATFORMS['App端'])===6,'all 19 documented platform versions represented');
    reject(fn()=>P::platform('Kimi','App端'),'unsupported mobile version never substituted');
    $connection=['settings'=>['provider'=>'geo_partner','api_origin'=>P::ORIGIN],'credentials'=>['api_key'=>'offline-partner-fixture']];
    $calls=[];$http=new P(function($method,$path,$body,$headers)use(&$calls){$calls[]=compact('method','path','body','headers');return ['status'=>202,'body'=>['id'=>'task-fixture-001','status'=>'queued']];});
    $payload=['platform'=>'通义千问','provider_platform'=>'qwen','question'=>'如何选择服务？','environment'=>['surface'=>'网页端','region'=>'全国','search_mode'=>'search']];
    $http->submit($connection,$payload,'fixed-business-key');$http->submit($connection,$payload,'fixed-business-key');
    ok($calls[0]===$calls[1]&&in_array('Idempotency-Key: fixed-business-key',$calls[0]['headers'],true),'retry uses identical body and persistent idempotency key');
    ok($calls[0]['body']['platformOptions']['qwen']['screenshot']===true&&$calls[0]['body']['collector']==='molizhishu'&&!isset($calls[0]['body']['brandId']),'direct prompt needs no brand provisioning and requests screenshots');
    reject(fn()=>$http->request($connection,'GET','/api/access-keys/prices'),'admin provider endpoints cannot be called');
    foreach([400,401,402,403,404] as $status){try{(new P(fn()=>['status'=>$status,'body'=>['error'=>'secret text must not escape']]))->submit($connection,$payload,'key');throw new RuntimeException('error accepted');}catch(GeoProviderFailure $e){ok(!$e->uncertain&&!str_contains($e->getMessage(),'secret text'),'HTTP '.$status.' is explicit rejection without raw error leak');}}
    foreach([409,429,500,200] as $status){try{(new P(fn()=>['status'=>$status,'body'=>[]]))->submit($connection,$payload,'key');throw new RuntimeException('error accepted');}catch(GeoProviderFailure $e){ok($e->uncertain,'ambiguous POST '.$status.' requires reconciliation');}}
    $receipt=['id'=>'task-fixture-001','status'=>'completed','createdAt'=>gmdate('c'),'platformRuns'=>[['id'=>'sample-001','platformId'=>'qwen','status'=>'completed','sampleIndex'=>0,'prompt'=>['text'=>$payload['question']],'answer'=>['content'=>'样本品牌提供服务。','brandMentioned'=>false,'citations'=>[['url'=>'https://example.com/cited'],['url'=>'https://example.com/cited'],['url'=>'javascript:alert(1)']],'providerResult'=>['screenshotUrl'=>null,'references'=>[['url'=>'https://example.com/reference']],'sentiment'=>'positive','mentionPosition'=>2,'competitorRankings'=>[['name'=>'其他品牌','rank'=>1]]]]]]];
    $result=P::normalize($receipt,$payload,'task-fixture-001',time());
    ok(count($result['citations'])===1&&count($result['references'])===1&&$result['url']==='','citations deduplicated separately from references and missing screenshot not fabricated');
    ok($result['time_basis']==='result_received_at'&&!isset($result['mentioned'])&&!$result['recommended'],'result receipt time and local brand evaluation are honest');
    ok($result['sentiment']==='positive'&&$result['competitor_rankings'][0]['rank']===1,'documented semantic evidence preserved');
    $noTimestamp=$receipt;unset($noTimestamp['createdAt']);ok(P::normalize($noTimestamp,$payload,'task-fixture-001',time())['requested_at']===null,'optional provider timestamp remains unknown instead of rejecting valid evidence');
    $contradictory=$receipt;$contradictory['platformRuns'][0]['errorCode']='UPSTREAM_RESULT_MISMATCH';reject(fn()=>P::normalize($contradictory,$payload,'task-fixture-001',time()),'error-bearing response cannot become successful evidence');
    foreach(['id','question','platform','count','time'] as $bad){$copy=$receipt;switch($bad){case 'id':$copy['id']='wrong-task';break;case 'question':$copy['platformRuns'][0]['prompt']['text']='另一问题';break;case 'platform':$copy['platformRuns'][0]['platformId']='doubao';break;case 'count':$copy['platformRuns'][]=$copy['platformRuns'][0];break;case 'time':$copy['createdAt']=gmdate('c',time()-86400);break;}reject(fn()=>P::normalize($copy,$payload,'task-fixture-001',time()),'mismatched '.$bad.' cannot become evidence');}
    $t=1;if(Db::name('oem_geo_job')->where('operation','visibility')->whereIn('status',['queued','submitting','polling'])->count())throw new RuntimeException('Real monitoring jobs must be idle');
    Db::name('tenant')->where('id',$t)->update(['point_balance'=>10000]);
    $mid=Directory::saveMerchant($t,['name'=>$prefix,'account'=>$prefix,'password'=>'PartnerLocal2026!']);$u=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');Db::name('user')->where(['tenant_id'=>$t,'id'=>$u])->update(['user_money'=>10000]);
    $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
    $product=Db::name('power_market_product')->find()?:[];unset($product['id']);$pid=(int)Db::name('power_market_product')->insertGetId(array_replace($product,['product_code'=>$prefix,'upstream_resource_key'=>$prefix,'resource_type'=>'app_api','upstream_app_code'=>'aigc_geo','upstream_api_code'=>'visibility_cn','status'=>1,'source_payload'=>'{}']));
    $sku=Db::name('power_market_sku')->find()?:[];unset($sku['id']);$sid=(int)Db::name('power_market_sku')->insertGetId(array_replace($sku,['product_id'=>$pid,'sku_key'=>$prefix,'status'=>1,'sale_status'=>1,'usage_unit'=>'per_call','usage_unit_size'=>1,'sale_points'=>1.25,'source_payload'=>'{}','locked_params'=>'{}']));
    $settings=['provider'=>'geo_partner','product_id'=>$pid,'sku_id'=>$sid,'api_origin'=>P::ORIGIN];$rev=(int)Db::name('oem_geo_connection')->where(['tenant_id'=>$t,'agent_id'=>0,'capability'=>'visibility_cn'])->value('revision');
    C::save($t,0,1,['capability'=>'visibility_cn','revision'=>$rev,'mode'=>'own','settings'=>$settings,'secrets'=>['api_key'=>'offline-partner-fixture']]);
    ok(V::options($t,$u)['available']&&count(V::options($t,$u)['platforms_by_surface']['App端'])===6,'configured provider drives merchant capabilities and native pricing');
    ok(!str_contains(json_encode(C::listing($t)),'offline-partner-fixture'),'admin listing never returns API Key');
    reject(fn()=>C::save($t,0,1,['capability'=>'visibility_cn','revision'=>$rev+1,'mode'=>'own','settings'=>array_replace($settings,['api_origin'=>'https://different.example.com']),'secrets'=>[]]),'changing service address cannot silently reuse previous secret');
    $inspect=new P(fn($method,$path)=>['status'=>200,'body'=>str_ends_with($path,'usage')?['balanceCents'=>12345]:[['id'=>'qwen','name'=>'千问','client'=>'web','upstreamConfigured'=>true,'pricing'=>['configured'=>true]]]]);
    ok(C::inspectVisibility($t,['revision'=>$rev+1],$inspect)['balance_cents']===12345,'admin connection check returns sanitized balance and platform catalog');
    Geo::profileSave($t,$u,['revision'=>0,'brand_name'=>'样本品牌','industry'=>'本地服务','products'=>'可核实服务','customers'=>'本地客户']);
    $enqueue=function(string $suffix,string $platform='通义千问',string $surface='网页端')use($t,$u,$prefix){$id=(int)W::change($t,$u,['action'=>'create','request_key'=>$prefix.'_project_'.$suffix])['id'];W::change($t,$u,['action'=>'configure','id'=>$id,'revision'=>1,'questions'=>['如何选择服务？'],'platforms'=>[$platform],'region'=>'全国','surface'=>$surface,'search_mode'=>'search','report_days'=>7,'aliases'=>[]]);$q=V::preview($t,$u,$id);$input=['project_id'=>$id,'request_key'=>$prefix.'_paid_'.$suffix,'quote_key'=>$q['quote_key'],'confirmed'=>true];$run=V::enqueue($t,$u,$input);ok(V::enqueue($t,$u,$input)['id']===$run['id'],'same merchant request reuses run '.$suffix);$job=Db::name('oem_geo_job')->where('user_id',$u)->order('id desc')->find();return [$id,$run['id'],$job];};
    $posts=0;$gets=0;$mode='success';$submitted=[];
    $provider=new P(function($method,$path,$body,$headers)use(&$posts,&$gets,&$mode,&$submitted){
        if($method==='POST'){$posts++;if($mode==='reject')return ['status'=>402,'body'=>[]];if($mode==='uncertain')throw new GeoProviderFailure(true,'响应未确认');$id='partner-run-'.str_pad((string)$posts,8,'0',STR_PAD_LEFT);$submitted[$id]=$body;return ['status'=>202,'body'=>['id'=>$id,'status'=>'queued']];}
        $gets++;$id=basename($path);$b=$submitted[$id];$status=$mode==='failed'?'failed':($mode==='waiting'?'running':'completed');
        return ['status'=>200,'body'=>['id'=>$id,'status'=>$status,'createdAt'=>gmdate('c'),'platformRuns'=>[['id'=>'sample-id','platformId'=>$b['platforms'][0],'prompt'=>['text'=>$b['prompt']],'status'=>$status,'answer'=>$status==='completed'?['content'=>'样本品牌提供服务。','brandMentioned'=>false,'citations'=>[['url'=>'https://example.com/cited']],'providerResult'=>['references'=>[['url'=>'https://example.com/reference']],'screenshotUrl'=>null]]:null]]]];
    });
    $worker=new Worker(new MoliVisibility(fn()=>throw new RuntimeException('Wrong protocol')),$provider);
    [$id,$run,$job]=$enqueue('success','文心一言','App端');$worker->tick();
    ok(Db::name('oem_geo_job')->where('id',$job['id'])->value('status')==='polling'&&$posts===1&&$gets===0,'202 creates polling state without treating acceptance as success');
    ok(Db::name('oem_geo_monitor_cell')->where('job_id',$job['id'])->value('next_at')>=time()+55,'query scheduled at bounded sixty-second interval');
    Db::name('oem_geo_monitor_cell')->where('job_id',$job['id'])->update(['next_at'=>0]);$worker->tick();
    $record=V::records($t,$u,['id'=>$run])['lists'][0];$view=W::view($t,$u,['id'=>$id]);
    ok($record['state']==='success'&&$record['jobs'][0]['billing_status']==='settled','successful answer settles existing native reservation');
    ok($view['samples'][0]['data']['mentioned']===true&&$view['samples'][0]['data']['provider']==='geo_partner','own brand matcher ignores unrelated supplier brand flag');
    ok($view['cycles'][0]['state']==='sealed'&&!$worker->tick()&&$posts===1,'successful report seals and never resubmits');
    reject(fn()=>V::records($t,99999999,['id'=>$run]),'foreign merchant cannot read original run');
    [$id2,$run2,$job2]=$enqueue('failed');$worker->tick();$mode='failed';Db::name('oem_geo_monitor_cell')->where('job_id',$job2['id'])->update(['next_at'=>0]);$worker->tick();
    $failed=V::records($t,$u,['id'=>$run2])['lists'][0];ok($failed['state']==='review'&&$failed['jobs'][0]['billing_status']==='reserved','accepted failure retains reservation for reconciliation rather than inventing supplier refund');
    ok(count(W::view($t,$u,['id'=>$id2])['samples'])===0,'failed sampling does not reduce brand visibility');
    $mode='reject';[$id3,$run3,$job3]=$enqueue('reject');$worker->tick();ok(V::records($t,$u,['id'=>$run3])['lists'][0]['jobs'][0]['billing_status']==='refunded','explicit rejection before acceptance refunds merchant reservation');
    $mode='uncertain';[$id4,$run4,$job4]=$enqueue('uncertain');$worker->tick();$before=$posts;ok(!$worker->tick()&&$before===$posts&&V::records($t,$u,['id'=>$run4])['lists'][0]['state']==='review','uncertain POST is quarantined without a new charged run');
    $mode='waiting';[$id5,$run5,$job5]=$enqueue('bounded');$worker->tick();$before=$gets;Db::name('oem_geo_job')->where('id',$job5['id'])->update(['result_json'=>'{"query_attempts":30}']);Db::name('oem_geo_monitor_cell')->where('job_id',$job5['id'])->update(['next_at'=>0]);$worker->tick();
    ok($gets===$before&&V::records($t,$u,['id'=>$run5])['lists'][0]['state']==='review','paid query loop stops at thirty attempts before another HTTP call');
    ok(!str_contains(json_encode(V::records($t,$u,['id'=>$run])),'offline-partner-fixture'),'merchant results contain no service secret');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getLine()."\n");exit(1);}echo "All $passed GEO Partner checks passed; all fixtures and ledger changes rolled back, no external HTTP.\n";
