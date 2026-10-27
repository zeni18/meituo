<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\press\{PressConfig as Config,PressService as Press,PressMediaDirectory as Directory,PressResourceSync as Sync,HaipressClient,HaipressTransport};
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
use app\common\service\merchant\geo\GeoBrandScope as Scope;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local test database required');
$checks=0;
function mc(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;echo "PASS $label\n";}
function mr(callable $fn,string $label, string $message=''):void{try{$fn();}catch(InvalidArgumentException $e){mc($message===''||str_contains($e->getMessage(),$message),$label);return;}throw new RuntimeException($label);}
final class MarkupTransport implements HaipressTransport {
    public $hook=null;public int $calls=0;
    public function request(string $path,array $headers,array $body,bool $json):array {
        if(str_ends_with($path,'tokenON'))return ['code'=>200,'data'=>'offline-access'];
        if(!preg_match('#/resources/list([0-9]+)ON$#',$path,$m))throw new RuntimeException('Unexpected provider call');
        $this->calls++;if($this->hook){$hook=$this->hook;$this->hook=null;$hook();}
        return ['code'=>200,'data'=>['total'=>1,'list'=>[['sourceid'=>'markup-sync-'.$m[1],'name'=>'同步验收','costprice'=>'10.00','flag'=>1,'deleted'=>1]]]];
    }
}
Db::startTrans();
try {
    $initial=Db::name('press_config')->where('id',1)->lock(true)->find();
    if(!$initial)throw new RuntimeException('Existing local settings required');
    $revision=2000000+(int)$initial['revision'];$keys=['token'=>'markup-test-token','key'=>'markup-test-key'];
    Db::name('press_config')->where('id',1)->update(['revision'=>$revision,'enabled'=>1,'markup_bps'=>0,'public_base'=>'https://press.example.com','secret_cipher'=>Vault::seal($keys,0,'haipress_media'),'account_hash'=>hash('sha256',json_encode($keys,JSON_THROW_ON_ERROR))]);
    Db::name('press_resource_sync')->where('id',1)->update(['state'=>'idle','config_revision'=>$revision,'lease_token'=>'','lease_until'=>0]);
    $save=function(array $extra=[])use($keys){return Config::save(array_replace(['revision'=>Config::listing()['revision'],'enabled'=>true,'markup_bps'=>1000,'public_base'=>'https://press.example.com','replace_credentials'=>true]+$keys,$extra),0);};
    $insert=function(int $kind,int $active=1,?int $rev=null,?int $time=null)use($revision){return (int)Db::name('press_media')->insertGetId(['source_id'=>'markup-qa-'.bin2hex(random_bytes(8)),'kind'=>$kind,'name'=>'加价验收媒体','region'=>'全国','category'=>'IT科技','cost_cents'=>1234,'active'=>$active,'remark'=>'测试','case_url'=>'https://example.com/case','config_revision'=>$rev??$revision,'sync_time'=>$time??time(),'details_json'=>'{"pcweight":2}','sync_batch'=>'markup-fixture']);};
    $a=$insert(1);$b=$insert(2);$off=$insert(1,0);$other=$insert(3);$expired=$insert(1,1,null,time()-90000);$foreign=$insert(1,1,$revision-1);
    $before=Db::name('press_media')->where('id',$a)->find();
    $owner=Db::name('oem_merchant')->where('status',1)->find();$t=(int)$owner['tenant_id'];$u=(int)$owner['user_id'];
    Scope::with($t,$u,999994,function()use($t,$u,$a,$b,$off,$other,$expired,$foreign,$revision,$before,$save){
        Directory::favorite($t,$u,['media_id'=>$a,'favorite'=>true]);
        $draft=Press::draftSave($t,$u,['title'=>'报价回归测试','body'=>'仅本地回滚测试']);$request=['draft_id'=>$draft['id'],'media_ids'=>[$a]];
        $quote=Press::quote($t,$u,$request);$orders=Db::name('press_order')->count();
        mc(Directory::listing($t,$u,[])['count']===3,'baseline has supported active media');
        $next=$save();mc($next['revision']===$revision+1,'config version still advances for stale editor and quote protection');
        mc(Directory::listing($t,$u,[])['count']===3,'saving 10 percent keeps website and self-media visible');
        $after=Db::name('press_media')->where('id',$a)->find();$expected=$before;$expected['config_revision']=$next['revision'];
        mc($after===$expected,'markup save preserves media IDs supplier prices metrics state and sync age');
        mc(Press::media(['kind'=>2])['lists'][0]['retail_cents']===1358,'legacy catalog recalculates rounded 10 percent retail price');
        mc(Directory::listing($t,$u,['favorites'=>1])['lists'][0]['retail_cents']===1358,'favorites survive and display new retail price');
        mc(Directory::caseUrl($t,$u,$a)==='https://example.com/case','case links remain available');
        mc(in_array('IT科技',Directory::options($t,$u,['kind'=>1])['categories'],true),'filter options remain available');
        mc(Directory::listing($t,$u,['price'=>'custom','min_price'=>'13.58','max_price'=>'13.58'])['count']===3,'custom price filter uses updated rounded retail price');
        mc(Press::quote($t,$u,$request)['total_cents']===1358,'checkout quotation agrees with catalog price');
        mr(fn()=>Press::create($t,$u,$request+$quote+['request_key'=>bin2hex(random_bytes(16)),'confirmed'=>true]),'old-price quote cannot create an order','报价已失效');
        mc(Db::name('press_order')->count()===$orders,'stale quote creates no orders');
        mr(fn()=>Press::quote($t,$u,['draft_id'=>$draft['id'],'media_ids'=>[$expired]]),'saving markup cannot renew expired supplier prices','报价已过期');
        mc((int)Db::name('press_media')->where('id',$foreign)->value('config_revision')===$revision-1,'unrelated old-account catalog is never carried forward');
        mc((int)Db::name('press_media')->where('id',$off)->value('active')===0,'offline media stay offline');
        mc(Press::media(['kind'=>3],true)['count']===1&&Press::media(['kind'=>3])['count']===0,'all resource categories remain available only in their permitted surfaces');
        $save(['markup_bps'=>0,'public_base'=>'https://another.example.com']);
        mc(Press::quote($t,$u,$request)['total_cents']===1234,'returning to zero and changing preview domain retain catalog');
        mr(fn()=>Config::save(['revision'=>$revision,'enabled'=>true,'markup_bps'=>1000],0),'stale configuration form still rejected');
    });
    $fake=new MarkupTransport();$worker=new Sync(new HaipressClient($fake));
    $job=Sync::start();$fake->hook=fn()=>$save(['markup_bps'=>2000]);$worker->tick();
    $state=Sync::status();mc(in_array($state['state'],['queued','running'],true),'markup save during a provider fetch keeps sync resumable');
    mc($state['batch']===$job['batch']&&$state['synced']===0,'in-flight old lease cannot commit or inflate progress');
    mc($state['config_revision']===Config::listing()['revision'],'unfinished sync follows same-account configuration');
    for($i=0;$i<15;$i++)$worker->tick();
    mc(Sync::status()['state']==='completed'&&Sync::status()['synced']===15,'interrupted page retries and all categories finish');
    $completed=Sync::status();$save();$saved=Sync::status();
    mc($saved['state']==='completed'&&$saved['batch']===$completed['batch']&&$saved['finished_at']===$completed['finished_at'],'completed batch preserved without pretending resources were resynced');
    $count=Press::media([])['count'];$save(['enabled'=>false]);mr(fn()=>Config::resolve(),'disabled service still prevents publishing');$save();
    mc(Press::media([])['count']===$count,'disable then re-enable same account retains catalog');
    Sync::start();$save(['enabled'=>false]);$paused=Sync::status();
    mc($paused['state']==='blocked'&&!$worker->tick(),'disabling during sync stops all provider work');$save();
    $save(['key'=>'different-test-account']);mc(Press::media([])['count']===0,'changed provider credentials invalidate previous account catalog');
    mc(Directory::listing($t,$u,[])['count']===0,'rich directory also isolates changed provider account');
    echo "All $checks markup integration checks passed; rolled back, no external HTTP or orders.\n";
} finally {Db::rollback();}
