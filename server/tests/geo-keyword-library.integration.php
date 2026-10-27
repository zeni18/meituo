<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantGeoService as Geo};
use app\common\service\merchant\geo\{GeoKeywordLibrary as Library,GeoWorkspace as Workspace,GeoBrandScope as Scope};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
$passed=0;$failure=null;$original=app()->request;$prefix='wl'.bin2hex(random_bytes(5));
function wl(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function wlReject(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){wl(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try{
 $t=1;$mid=Directory::saveMerchant($t,['name'=>$prefix,'account'=>$prefix,'password'=>'WordListFixture2026!']);$u=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');
 $m2=Directory::saveMerchant($t,['name'=>$prefix.'b','account'=>$prefix.'b','password'=>'WordListFixture2026!']);$u2=(int)Db::name('oem_merchant')->where('id',$m2)->value('user_id');
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 $a=Workspace::save($t,$u,['kind'=>'keyword','title'=>'产品词表','content'=>'门店营销软件','enabled'=>true]);$b=Workspace::save($t,$u,['kind'=>'keyword','title'=>'场景词表']);
 wlReject(fn()=>Library::add($t,$u,['topics'=>[['text'=>'无词表']]]),'new terms require an owned named list');
 wlReject(fn()=>Library::add($t,$u2,['keyword_group_id'=>$a['id'],'topics'=>[['text'=>'越权']]]),'another merchant cannot add to this list');
 wlReject(fn()=>Scope::with($t,$u,91234,fn()=>Library::view($t,$u,['group_id'=>$a['id']])),'another brand cannot read the list');
 wlReject(fn()=>Scope::with($t,$u,91234,fn()=>Library::add($t,$u,['keyword_group_id'=>$a['id'],'topics'=>[['text'=>'串品牌']]])),'another brand cannot write to the list');
 $p=['keyword_group_id'=>$a['id'],'topics'=>[['text'=>'门店软件怎么选？'],['text'=>'门店软件怎么选？'],['text'=>'适合餐饮的营销工具']]];$r=Library::add($t,$u,$p);wl(count($r['ids'])===2,'same list deduplicates repeated terms');wl(Library::add($t,$u,$p)['ids']===$r['ids'],'manual import replay does not duplicate words');
 $copy=Library::add($t,$u,['keyword_group_id'=>$b['id'],'topics'=>[['text'=>'门店软件怎么选？']]]);wl($copy['ids'][0]!==$r['ids'][0],'same term can exist in two different lists');
 $old=Geo::save($t,$u,['kind'=>'questions','question'=>'历史未分组问题']);$view=Library::view($t,$u,['group_id'=>$a['id']]);wl($view['count']===2&&count($view['groups'])===2&&$view['unfiled_count']===1,'brand overview counts named lists and historical unfiled words');
 wl(Library::view($t,$u,['group_id'=>0])['lists'][0]['id']===$old['id'],'unfiled view does not include other active lists');
 wl(Library::view($t,$u,['group_id'=>$a['id'],'keyword'=>'餐饮'])['count']===1,'search stays inside the chosen list');
 wl(Library::view($t,$u,['group_id'=>$a['id'],'keyword'=>'%'])['count']===0,'search wildcards are escaped');
 $foreign=Library::view($t,$u2,[]);wl($foreign['groups']===[]&&$foreign['lists']===[],'brand list and word counts remain merchant isolated');
 $brand=Scope::with($t,$u,91234,function()use($t,$u){$g=Workspace::save($t,$u,['kind'=>'keyword','title'=>'另一品牌']);Library::add($t,$u,['keyword_group_id'=>$g['id'],'topics'=>[['text'=>'另一品牌选题']]]);return Library::view($t,$u,['group_id'=>$g['id']]);});wl(count($brand['groups'])===1&&$brand['count']===1&&count(Library::view($t,$u,[])['groups'])===2,'same merchant brands have independent list trees');
 $row=$view['lists'][0];wlReject(fn()=>Library::update($t,$u2,['id'=>$row['id'],'question'=>'越权','intent'=>'选型','expected_hash'=>$row['expected_hash']]),'word editing cannot cross merchant ownership');
 wlReject(fn()=>Library::update($t,$u,['id'=>$row['id'],'question'=>'修改','intent'=>'选型','expected_hash'=>'stale']),'stale word edits are rejected');
 Library::update($t,$u,['id'=>$row['id'],'question'=>'已核实的门店软件问题','intent'=>'产品选型','keyword_group_id'=>$a['id'],'expected_hash'=>$row['expected_hash']]);$updated=Library::view($t,$u,['group_id'=>$a['id']])['lists'][0];wl($updated['question']==='已核实的门店软件问题'&&$updated['intent']==='产品选型','word and intent edits persist in their list');
 wlReject(fn()=>Library::update($t,$u,['id'=>$updated['id'],'question'=>'门店软件怎么选？','intent'=>'选型','keyword_group_id'=>$a['id'],'expected_hash'=>$updated['expected_hash']]),'word edits cannot introduce a same-list duplicate');
 $raw=Db::name('aigc_geo_keyword')->where('id',$updated['id'])->find();Db::name('aigc_geo_keyword')->where('id',$raw['id'])->update(['source'=>'ai_generated','metadata_json'=>json_encode(['keyword_group_id'=>$a['id'],'geo_job_id'=>123])]);$ai=Library::view($t,$u,['group_id'=>$a['id']])['lists'][0];Library::update($t,$u,['id'=>$ai['id'],'question'=>'人工改写过的客户问题','intent'=>'内容选题','keyword_group_id'=>$a['id'],'expected_hash'=>$ai['expected_hash']]);$manual=Library::view($t,$u,['group_id'=>$a['id']])['lists'][0];wl($manual['source']==='manual'&&!isset($manual['metadata_json']['geo_job_id']),'changed text no longer claims unmodified AI provenance');
 Workspace::recycle($t,$u,['kind'=>'keyword','id'=>$b['id'],'revision'=>$b['revision']]);$unfiled=Library::view($t,$u,[]);wl($unfiled['count']===2&&$unfiled['unfiled_count']===2,'archived list terms remain available as unfiled historical data');
 wlReject(fn()=>Library::view($t,$u,['group_id'=>$b['id']]),'archived lists cannot be selected for writing');
 wlReject(fn()=>Library::view($t,$u,['page_size'=>5000]),'unbounded word exports are rejected');
 wl(Db::name('oem_geo_job')->where('user_id',$u)->count()===0&&Db::name('oem_geo_monitor_run')->where('user_id',$u)->count()===0,'list management creates no paid model or diagnosis jobs');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getLine()."\n");exit(1);}echo "All $passed brand word-list checks passed; fixtures rolled back, no external calls.\n";
