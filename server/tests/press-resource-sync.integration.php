<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\press\{PressResourceSync as Sync,PressResourceCatalog as Catalog,PressService,HaipressClient,HaipressTransport,HaipressFailure};
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local test database required');
$checks=0;
function sc(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;echo "PASS $message\n";}
function sr(callable $fn,string $message):void{try{$fn();}catch(InvalidArgumentException){sc(true,$message);return;}throw new RuntimeException($message);}
function due():void{$row=Db::name('press_resource_sync')->where('id',1)->find();$p=json_decode($row['progress_json'],true);foreach($p as &$v)$v['retry_at']=0;unset($v);Db::name('press_resource_sync')->where('id',1)->update(['progress_json'=>json_encode($p),'lease_until'=>0]);}
function item(int $kind):array{return array_values(array_filter(Sync::status()['categories'],fn($c)=>$c['kind']===$kind))[0];}
final class SyncTransport implements HaipressTransport {
    public array $calls=[],$fail=[];public $hook=null;public bool $empty=false;public bool $repeat=false;public int $total=501;
    public function request(string $path,array $headers,array $body,bool $json):array {
        if(!preg_match('#/resources/list([0-9]+)ON$#',$path,$m))throw new RuntimeException('Unexpected API: '.$path);
        $kind=(int)$m[1];$page=(int)$body['page'];$limit=(int)$body['limit'];$this->calls[]=[$kind,$page,$limit];
        if($this->hook){$hook=$this->hook;$this->hook=null;$hook();}
        if(in_array($kind,$this->fail,true))throw new HaipressFailure(true,'transport','Offline fixture failure');
        $total=$kind===1?$this->total:1;$rows=[];
        if(!$this->empty)for($i=($page-1)*$limit;$i<min($total,$page*$limit);$i++){
            $n=$this->repeat?$i%$limit:$i;$row=['sourceid'=>'sync-qa-'.$kind.'-'.$n,'name'=>'测试媒体 '.$kind.' '.$n,'costprice'=>'12.34','flag'=>1,'deleted'=>1,'cost2_price'=>'20.00','fans'=>100,'token'=>'do-not-store'];
            if($kind===9){unset($row['name']);$row['proficient_field']='品牌文案';}
            if($kind===13)$row['costprice']=-1;
            if($kind===3)$row['deleted']=0;
            $rows[]=$row;
        }
        return ['code'=>200,'data'=>['total'=>$total,'list'=>$rows]];
    }
}
Db::startTrans();
try {
    $config=Db::name('press_config')->where('id',1)->lock(true)->find();if(!$config)throw new RuntimeException('Existing local config fixture required');
    $revision=(int)$config['revision']+100;
    Db::name('press_config')->where('id',1)->update(['enabled'=>1,'revision'=>$revision,'access_expiry'=>time()+7200,'access_cipher'=>Vault::seal(['access'=>'offline-fixture'],0,'haipress_access')]);
    Db::name('press_resource_sync')->where('id',1)->update(['state'=>'idle','lease_token'=>'','lease_until'=>0]);
    $fake=new SyncTransport();$worker=new Sync(new HaipressClient($fake));
    $first=Sync::start(0,$revision);sc(count($first['categories'])===15,'all 15 categories queued');
    sc(Sync::start(0,$revision)['batch']===$first['batch'],'repeated start joins active job');
    sr(fn()=>Sync::start(0,$revision-1),'stale page configuration rejected');
    $fake->hook=function()use($worker){sc(!$worker->tick(),'second consumer cannot steal a live lease');};
    sc($worker->tick(),'first page consumed');sc(item(1)['page']===2&&item(1)['synced']===500,'cursor and rows commit together');
    $id=Db::name('press_media')->where(['kind'=>1,'source_id'=>'sync-qa-1-0'])->value('id');
    for($i=0;$i<15;$i++)$worker->tick();
    $done=Sync::status();sc($done['state']==='completed'&&$done['completed']===15&&$done['synced']===515,'pagination across all categories completes');
    sc(count($fake->calls)===16,'only expected pages requested');
    sc(!$worker->tick(),'completed job does not repeat');
    sc(Db::name('press_media')->where('source_id','sync-qa-9-0')->value('name')==='品牌文案','copywriting uses proficient field as name');
    $we=Db::name('press_media')->where('source_id','sync-qa-13-0')->find();sc((int)$we['cost_cents']===0&&(int)$we['active']===0&&json_decode($we['details_json'],true)['cost2_price']==='20.00','unsupported primary price retains alternate tier');
    sc(!str_contains($we['details_json'],'do-not-store'),'credential fields excluded from resource metadata');
    sc((int)Db::name('press_media')->where('source_id','sync-qa-3-0')->value('active')===0,'provider deleted resources not sellable');
    sc(PressService::media(['kind'=>9])['count']===0,'unadapted resource categories excluded from merchant checkout catalog');
    sc(PressService::media(['kind'=>9],true)['count']===1,'platform can read all synchronized categories');

    $fake->total=500;$fake->fail=[2];$next=Sync::start();sc($next['batch']!==$first['batch'],'completed job allows a new batch');
    for($i=0;$i<18;$i++){due();$worker->tick();}
    sc(Sync::status()['state']==='partial'&&Sync::status()['failed']===1,'failing category retries three times and others finish');
    sc(item(2)['attempts']===3&&item(2)['page']===1,'failed page retained for resume');
    sc((int)Db::name('press_media')->where('source_id','sync-qa-2-0')->value('active')===1,'failed category does not retire old resources');
    sc((int)Db::name('press_media')->where('source_id','sync-qa-1-500')->value('active')===0,'successful category retires resources missing from complete batch');
    sc(Db::name('press_media')->where('source_id','sync-qa-1-0')->value('id')===$id,'upsert preserves IDs referenced by historical orders');
    $calls=count($fake->calls);$fake->fail=[];sc(Sync::start()['batch']===$next['batch'],'resume retains batch and completed progress');$worker->tick();
    sc(count($fake->calls)===$calls+1&&Sync::status()['state']==='completed','resume fetches only the failed category');

    Sync::start();$fake->hook=function(){Db::name('press_config')->where('id',1)->inc('revision')->update();};$worker->tick();
    sc(Sync::status()['state']==='blocked','configuration change during fetch blocks old job');
    $revision++;Sync::start(0,$revision);$fake->hook=function(){Db::name('press_resource_sync')->where('id',1)->update(['lease_token'=>'newer-consumer','lease_until'=>time()+180]);};$worker->tick();
    sc(item(1)['synced']===0,'stale consumer cannot commit after lease replacement');
    due();$worker->tick();sc(item(2)['state']==='completed','expired lease can be reclaimed by another consumer');
    $fake->empty=true;due();$worker->tick();sc(item(3)['state']==='retrying'&&item(3)['synced']===0,'empty page with nonzero total is a retry, not completion');$fake->empty=false;
    for($i=0;$i<18;$i++){due();$worker->tick();}
    sc(Sync::status()['state']==='completed','crash recovery preserves and completes progress');

    $fake->total=1000;$fake->repeat=true;Sync::start();for($i=0;$i<19;$i++){due();$worker->tick();}
    sc(item(1)['state']==='failed'&&item(1)['synced']===500,'duplicate page is not counted or committed');
    sc(!str_contains(json_encode(Sync::status()),'offline-fixture'),'task status never exposes access tokens');
    $fake->repeat=false;Sync::start();$worker->tick();sc(Sync::status()['state']==='completed'&&item(1)['synced']===1000,'failed second page resumes at the correct offset');
    sr(fn()=>Catalog::prepare([['sourceid'=>'same','name'=>'A'],['sourceid'=>'same','name'=>'B']],1,$revision,'test'),'duplicate IDs within one page rejected');
    sr(fn()=>(new HaipressClient($fake))->resources(16),'invalid category rejected before API call');
    sr(fn()=>(new HaipressClient($fake))->resources(1,0),'invalid page rejected before API call');
    sc(count(array_filter($fake->calls,fn($v)=>$v[2]!==500))===0,'background requests use bounded 500-row pages');
    echo "All $checks resource-sync integration checks passed. All fixtures rolled back; no provider HTTP or orders.\n";
} finally { Db::rollback(); }
