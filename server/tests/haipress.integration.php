<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\press\{PressService as Press,PressConfig as Config,PressMoney as Money,HaipressClient,HaipressTransport,HaipressFailure};
use app\common\service\merchant\OemDirectoryService as Directory;
use app\common\service\merchant\MerchantAccountTables as Tables;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
if(Db::name('press_config')->count())throw new RuntimeException('Refusing to replace existing provider settings');
$passed=0;$prefix='hpqa'.bin2hex(random_bytes(4));
function hpCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function hpReject(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){hpCheck(true,$label);return;}hpCheck(false,$label);}
final class FakeHaipress implements HaipressTransport {
 public array $calls=[];public mixed $create=null;public array $receipt=['flag'=>0];public $hook=null;
 public function request(string $path,array $headers,array $body,bool $json):array {
  $this->calls[]=compact('path','headers','body','json');if($this->hook)($this->hook)($path);
  if(str_ends_with($path,'tokenON'))return ['code'=>200,'data'=>'fixtureAccess'];
  hpCheck(($headers['openToken']??'')==='fixtureAccess'&&($headers['clientType']??'')==='5','provider access headers');
  if(str_contains($path,'list'))return ['code'=>200,'data'=>['total'=>2,'list'=>[
   ['sourceid'=>'QA-live','name'=>'验收媒体','costprice'=>'12.34','flag'=>1,'deleted'=>1,'region'=>'国内'],
   ['sourceid'=>'QA-deleted','name'=>'已删除媒体','costprice'=>'3.00','flag'=>1,'deleted'=>0]]]];
  if(str_ends_with($path,'stateON'))return ['code'=>200,'data'=>['flag'=>1,'deleted'=>1]];
  if(str_ends_with($path,'createON')) {if($this->create instanceof Throwable)throw $this->create;return $this->create??['code'=>200];}
  if(str_ends_with($path,'queryON'))return ['code'=>200,'data'=>$this->receipt];
  if(str_ends_with($path,'processON'))return ['code'=>200];
  throw new RuntimeException('Unexpected transport endpoint');
 }
 public function creates():int{return count(array_filter($this->calls,fn($c)=>str_ends_with($c['path'],'createON')));}
}
$failure=null;Db::startTrans();
try{
 hpCheck(Money::cents('12.34')===1234&&Money::retail(1234,1500)===1420&&Money::points(1420)==='1420.00','integer pricing and points conversion');
 foreach(['1e4','-1','1.234','NaN'] as $invalid)hpReject(fn()=>Money::cents($invalid),'invalid monetary value '.$invalid);
 hpReject(fn()=>Config::save(['enabled'=>true,'revision'=>0],0),'cannot enable without credentials and preview domain');
 hpReject(fn()=>Config::publicBase('http://localhost:8090'),'public preview must use HTTPS public domain');
 $settings=['enabled'=>true,'revision'=>0,'markup_bps'=>1500,'token'=>$prefix.'Token','key'=>$prefix.'Secret','public_base'=>'https://press.example.com'];Config::save($settings,0);
 $serialized=json_encode(Config::listing());hpCheck(!str_contains($serialized,$settings['key'])&&!str_contains($serialized,$settings['token']),'config list never returns secrets');
 hpCheck(!str_contains(Db::name('press_config')->value('secret_cipher'),$settings['key']),'encrypted credentials at rest');
 hpReject(fn()=>Config::save($settings,0),'stale configuration save rejected');
 $tenant=Db::name('tenant')->whereNull('delete_time')->where('tactics',0)->find();if(!$tenant)throw new RuntimeException('Shared local tenant fixture required');$t=(int)$tenant['id'];
 $foreign=$tenant;unset($foreign['id']);$foreign['sn']=$prefix;$foreign['name']='Haipress isolation QA';$t2=(int)Db::name('tenant')->insertGetId($foreign);
 $a=Directory::saveAgent($t,['name'=>$prefix.'一级','level'=>1,'account'=>$prefix.'a','password'=>'TestLocal2026!']);
 $b=Directory::saveAgent($t,['name'=>$prefix.'二级','level'=>2,'parent_id'=>$a,'account'=>$prefix.'b','password'=>'TestLocal2026!']);
 $c=Directory::saveAgent($t,['name'=>$prefix.'同级','level'=>1,'account'=>$prefix.'c','password'=>'TestLocal2026!']);
 $users=[];$merchants=[];
 foreach([[$t,$a],[$t,$b],[$t,$c],[$t2,0]] as $i=>[$tt,$agent]){
  $mid=Directory::saveMerchant($tt,['name'=>$prefix.'商家'.$i,'account'=>$prefix.'m'.$i,'password'=>'TestLocal2026!','agent_id'=>$agent]);$uid=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');$users[]=[$tt,$uid];$merchants[]=$mid;
  Db::name(Tables::name($tt,'user'))->where('id',$uid)->update(['user_money'=>'100000.00']);
 }
 $fake=new FakeHaipress();$press=new Press(new HaipressClient($fake));$press->sync(1,1);hpCheck(Press::media([])['count']===1,'deleted=0 is not sellable');
 hpCheck(!array_key_exists('cost_cents',Press::media([])['lists'][0]),'merchant resources omit provider cost');$media=(int)Db::name('press_media')->where('source_id','QA-live')->value('id');
 $new=function(int $who=0)use($users,$media):array{[$tt,$uid]=$users[$who];$d=Press::draftSave($tt,$uid,['title'=>'验收 <标题>','body'=>'正文 <script>alert(1)</script>']);$p=['draft_id'=>$d['id'],'media_ids'=>[$media],'remark'=>'QA 测试 &'];return [$tt,$uid,$p+Press::quote($tt,$uid,$p)+['request_key'=>bin2hex(random_bytes(16)),'confirmed'=>true]];};
 $create=function(int $who=0)use($new):int{[$tt,$uid,$p]=$new($who);return Press::create($tt,$uid,$p)['ids'][0];};
 $balance=fn(int $who=0)=>Db::name(Tables::name($users[$who][0],'user'))->where('id',$users[$who][1])->value('user_money');
 $row=fn(int $id)=>Db::name('press_order')->where('id',$id)->find();$poll=fn(int $id)=>Db::name('press_order')->where('id',$id)->update(['lease_until'=>0,'next_poll'=>0]);
 [$tt,$uid,$p]=$new();$bad=$p;$bad['quote_hash']=str_repeat('0',64);hpReject(fn()=>Press::create($tt,$uid,$bad),'tampered quote rejected');$bad=$p;$bad['confirmed']=false;hpReject(fn()=>Press::create($tt,$uid,$bad),'explicit fee confirmation required');
 hpReject(fn()=>Press::quote($t,$users[1][1],$p),'cannot use another merchant draft');
 $id=Press::create($tt,$uid,$p)['ids'][0];hpCheck($balance()==='98580.00','reserve debits native balance exactly once');
 hpCheck(Press::create($tt,$uid,$p)['replayed']&&$balance()==='98580.00','idempotent retry does not debit again');$changed=$p;$changed['remark']='different';hpReject(fn()=>Press::create($tt,$uid,$changed),'request key cannot change payload');
 $before=$balance();$press->tick($id);hpCheck($row($id)['state']==='submitted'&&$balance()===$before,'supplier acceptance holds reservation');
 $call=array_values(array_filter($fake->calls,fn($c)=>str_ends_with($c['path'],'createON')))[0];hpCheck($call['json']&&!isset($call['body']['data'])&&$call['body']['title']===urlencode('验收 <标题>')&&$call['body']['price']==='12.34','create protocol uses direct JSON and encoded fields');
 $fake->receipt=['flag'=>5,'url'=>'https://example.com/news/qa'];$poll($id);$press->tick($id);hpCheck($row($id)['state']==='completed'&&$row($id)['billing_status']==='captured'&&$balance()===$before,'verified publication settles without second debit');
 $reject=$create();$press->tick($reject);$fake->receipt=['flag'=>2,'result'=>'退稿'];$poll($reject);$before=$balance();$press->tick($reject);hpCheck($row($reject)['state']==='rejected'&&$balance()===$before&&$row($reject)['billing_status']==='reserved','rejected supplier order does not fabricate refund');
 Press::refund($reject,0,'QA到账凭证');$after=$balance();hpCheck(Press::refund($reject,0,'QA重复凭证')['replayed']&&$balance()===$after,'confirmed refund credits once');
 $uncertain=$create();$fake->create=new HaipressFailure(true,'timeout','测试超时');$press->tick($uncertain);$count=$fake->creates();$fake->receipt=['flag'=>100];$poll($uncertain);$press->tick($uncertain);hpCheck($fake->creates()===$count&&$row($uncertain)['state']==='unknown'&&$row($uncertain)['billing_status']==='reserved','ambiguous submission and missing receipt only query original order');
 $fake->create=['code'=>400,'msgen'=>'depositLess'];$definite=$create();$before=$balance();$press->tick($definite);hpCheck($row($definite)['state']==='failed'&&Money::cents($balance())===Money::cents($before)+142000,'definite insufficient supplier deposit releases hold');$fake->create=null;
 $published=$create();$press->tick($published);$fake->receipt=['flag'=>3,'url'=>'https://example.com/awaiting'];$poll($published);$press->tick($published);hpCheck($row($published)['state']==='published','provider flag3 remains awaiting customer confirmation');
 hpReject(fn()=>Press::process($t,$users[1][1],['id'=>$published,'flag'=>5]),'foreign merchant cannot confirm publication');
 Press::process($t,$users[0][1],['id'=>$published,'flag'=>4,'note'=>'QA 反馈 &']);$press->tick($published);$pcalls=array_values(array_filter($fake->calls,fn($c)=>str_ends_with($c['path'],'processON')));hpCheck(count($pcalls)===1&&$pcalls[0]['json']&&$pcalls[0]['body']['releaseresult']===urlencode('QA 反馈 &'),'merchant feedback follows processON JSON encoding');
 $poll($published);$press->tick($published);hpCheck(count(array_filter($fake->calls,fn($c)=>str_ends_with($c['path'],'processON')))===1,'processing action never automatically repeats');
 $fake->receipt=['flag'=>4];$poll($published);$press->tick($published);$fake->receipt=['flag'=>3,'url'=>'https://example.com/revised'];$poll($published);$press->tick($published);Press::process($t,$users[0][1],['id'=>$published,'flag'=>5]);$press->tick($published);$fake->receipt=['flag'=>5,'url'=>'https://example.com/revised'];$poll($published);$press->tick($published);hpCheck($row($published)['state']==='completed'&&$row($published)['process_state']==='done','feedback revision can be confirmed to completion');
 $missing=$create();$press->tick($missing);$fake->receipt=['flag'=>5];$poll($missing);$press->tick($missing);hpCheck($row($missing)['state']==='unknown'&&$row($missing)['billing_status']==='reserved','missing publication URL never settles');
 // A late worker response after a refund must not restore captured billing.
 $race=$create();$press->tick($race);$fake->receipt=['flag'=>4];$poll($race);$press->tick($race);$fake->receipt=['flag'=>5,'url'=>'https://example.com/race'];$fake->hook=function($path)use($race){if(str_ends_with($path,'queryON'))Press::refund($race,0,'QA并发退款凭证');};$poll($race);$press->tick($race);hpCheck($row($race)['state']==='refunded'&&$row($race)['billing_status']==='refunded','refund invalidates in-flight worker lease');$fake->hook=null;
 // A replaced lease must prevent an old worker from sending createON.
 $lease=$create();$count=$fake->creates();$fake->hook=function($path)use($lease){if(str_ends_with($path,'stateON'))Db::name('press_order')->where('id',$lease)->update(['lease_token'=>'replacement']);};$press->tick($lease);hpCheck($fake->creates()===$count,'lost lease blocks external submission');$fake->hook=null;
 $expired=$create();Db::name('press_draft')->where('id',$row($expired)['draft_id'])->update(['expires_at'=>time()-1]);$count=$fake->creates();$press->tick($expired);hpCheck($row($expired)['state']==='failed'&&$row($expired)['billing_status']==='refunded'&&$fake->creates()===$count,'expired preview releases hold before external submission');
 $rotated=$settings;$rotated['revision']=1;$rotated['key']=$prefix.'Rotated';Config::save($rotated,0);$poll($uncertain);$press->tick($uncertain);hpCheck($row($uncertain)['state']==='blocked','changed provider account pauses original order');hpReject(fn()=>Press::resume($uncertain,0),'cannot resume through another account');
 $restore=$settings;$restore['revision']=2;Config::save($restore,0);Press::resume($uncertain,0);$count=$fake->creates();$fake->receipt=['flag'=>0];$press->tick($uncertain);hpCheck($fake->creates()===$count&&$row($uncertain)['state']==='submitted','restored original account resumes queries only');
 $press->sync(1,1);[$tt,$uid,$p]=$new(3);Db::name(Tables::name($tt,'user'))->where('id',$uid)->update(['user_money'=>'0.00']);$n=Db::name('press_order')->count();hpReject(fn()=>Press::create($tt,$uid,$p),'insufficient merchant points rejected');hpCheck(Db::name('press_order')->count()===$n,'insufficient funds rollback whole order');Db::name(Tables::name($tt,'user'))->where('id',$uid)->update(['user_money'=>'100000.00']);
 $scopeIds=[];foreach(range(0,3)as $who)$scopeIds[]=$create($who);
 $agent=Db::name('oem_agent')->where('id',$a)->find();$agent2=Db::name('oem_agent')->where('id',$b)->find();
 $mine=Press::orders($t,null,$agent,false,[]);$ids=array_column($mine['lists'],'id');hpCheck(in_array($scopeIds[0],$ids)&&in_array($scopeIds[1],$ids)&&!in_array($scopeIds[2],$ids)&&!in_array($scopeIds[3],$ids),'level1 scope includes own and child merchants only');
 $mine2=Press::orders($t,null,$agent2,false,[]);hpCheck($mine2['count']===1&&count($mine2['lists'])===1&&(int)$mine2['lists'][0]['id']===$scopeIds[1]&&$mine2['summary']['reserved_cents']===1420,'level2 summary and list share direct merchant scope');
 hpCheck(Press::orders($t2,null,null,false,[])['count']===1,'OEM cannot see another tenant orders');
 hpReject(fn()=>Press::detail($t,null,$agent2,false,$scopeIds[0]),'agent direct detail cannot bypass scope');hpReject(fn()=>Press::detail($t2,null,null,false,$scopeIds[1]),'cross OEM direct detail denied');hpReject(fn()=>Press::detail($t,$users[0][1],null,false,$scopeIds[1]),'merchant cannot read another merchant order');
 $forged=Press::orders($t,null,$agent2,false,['tenant_id'=>$t2,'merchant_id'=>$merchants[2]]);hpCheck($forged['count']===0,'forged tenant and merchant filters cannot widen agent scope');
 $csv=Press::export($t,null,$agent2,false,[])['csv'];hpCheck(str_contains($csv,$row($scopeIds[1])['sn'])&&!str_contains($csv,$row($scopeIds[2])['sn'])&&!str_contains($csv,'供方成本'),'export shares row scope and hides cost');
 $detail=Press::detail($t,null,$agent2,false,$scopeIds[1]);hpCheck(!isset($detail['cost_cents'],$detail['account_hash'],$detail['preview_url'],$detail['payload_hash']),'detail excludes supplier cost and internal credentials');
 Db::name('oem_merchant')->where('id',$merchants[1])->update(['agent_id'=>$c]);hpCheck(Press::orders($t,null,$agent2,false,[])['count']===0,'current merchant ownership immediately revokes historical access');
 Db::name('oem_agent')->where('id',$b)->update(['status'=>0]);hpReject(fn()=>Press::orders($t,null,$agent2,false,[]),'disabled agent cannot reuse identity snapshot');
 hpCheck(Press::orders(0,null,null,true,[])['count']===Db::name('press_order')->count(),'platform covers all scoped orders');
}catch(\Throwable $e){$failure=$e;}finally{Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' at '.$failure->getFile().':'.$failure->getLine()."\n");exit(1);}echo 'All '.$passed." checks passed; fixtures rolled back; no external transport used.\n";
