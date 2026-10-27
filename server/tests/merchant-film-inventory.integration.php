<?php
declare(strict_types=1);

require dirname(__DIR__).'/runtime-loader.php';
$app = new \AigcRuntimeApp(dirname(__DIR__));
$app->initialize();

use think\facade\Db;
use app\common\service\merchant\OemDirectoryService as Directory;
use app\common\service\merchant\MerchantFilmService as Film;
use app\common\service\merchant\MerchantFinishedCatalogService as Catalog;

$connection = config('database.connections.mysql');
if (($connection['hostname'] ?? '') !== '127.0.0.1'
    || !preg_match('/^aigc_dev_(?:primary|secondary)_\d+$/D', (string)$connection['database'])
    || (int)$connection['hostport'] < 3310) {
    throw new RuntimeException('Run only against an isolated collaboration development database.');
}
$checks = 0;
function inventoryCheck(bool $ok, string $label): void {
    global $checks;
    if (!$ok) throw new RuntimeException($label);
    $checks++;
    echo "PASS $label\n";
}
function inventoryDenied(callable $operation, string $label): void {
    try { $operation(); } catch (InvalidArgumentException) { inventoryCheck(true, $label); return; }
    throw new RuntimeException($label);
}
function inventoryAsset(int $user, string $title, int $library): string {
    $task = (int)Db::name('aigc_digital_human_task')->insertGetId([
        'tenant_id'=>1,'user_id'=>$user,'title'=>$title,'script_text'=>'QA fixture',
        'prompt'=>'','pricing_snapshot'=>'{}','provider_payload_json'=>'{}',
        'status'=>'success','error'=>'','create_time'=>time(),
    ]);
    $result = (int)Db::name('aigc_digital_human_result')->insertGetId([
        'tenant_id'=>1,'user_id'=>$user,'task_id'=>$task,'title'=>$title,
        'video_uri'=>'media/aigc-preview.mp4','storage_scope'=>'platform',
        'storage_engine'=>'local','duration'=>6,'create_time'=>time(),
    ]);
    $ref = 'digital_human:result:'.$result;
    Film::move(1,$user,['library_id'=>$library,'refs'=>[$ref]]);
    return $ref;
}
function inventoryAssignment(int $user, string $ref, string $taskState, string $state, string $platform, int $staff): int {
    $task = (int)Db::name('oem_publish_task')->insertGetId([
        'tenant_id'=>1,'user_id'=>$user,'request_key'=>bin2hex(random_bytes(16)),
        'title'=>'QA inventory task','content'=>'QA','config_json'=>'{}','state'=>$taskState,
        'due_time'=>0,'deadline'=>0,'create_time'=>time(),
    ]);
    Db::name('oem_publish_assignment')->insert([
        'tenant_id'=>1,'user_id'=>$user,'task_id'=>$task,'staff_id'=>$staff,'store_id'=>1,
        'platform'=>$platform,'asset_ref'=>$ref,'copy_text'=>'QA','topics'=>'[]','state'=>$state,
        'submit_time'=>in_array($state,['submitted','approved'],true)?time():0,
    ]);
    return $task;
}

Db::startTrans();
try {
    $owners = [];
    foreach (['a','b'] as $key) {
        $name = 'invqa_'.bin2hex(random_bytes(6));
        $id = Directory::saveMerchant(1,['name'=>$name,'account'=>$name,'password'=>'QA!'.bin2hex(random_bytes(6)),'status'=>1,'agent_id'=>0]);
        $owners[$key] = (int)Db::name('oem_merchant')->where('id',$id)->value('user_id');
    }
    $user = $owners['a'];
    $library = Catalog::save(1,$user,['kind'=>'video','name'=>'QA inventory','max_uses'=>2,'warn_below'=>3])['id'];
    $empty = Catalog::save(1,$user,['kind'=>'video','name'=>'QA empty','max_uses'=>0])['id'];
    $refs = [];
    foreach (['unused','assigned','sent','full'] as $state) $refs[$state]=inventoryAsset($user,'QA '.$state,$library);
    $active = inventoryAssignment($user,$refs['assigned'],'active','pending','douyin',1);
    inventoryAssignment($user,$refs['sent'],'active','submitted','douyin',2);
    inventoryAssignment($user,$refs['full'],'active','pending','douyin',3);
    inventoryAssignment($user,$refs['full'],'active','approved','kuaishou',4);
    // A different owner's fact referencing this asset must not leak into counts.
    inventoryAssignment($owners['b'],$refs['unused'],'active','pending','douyin',5);

    $facts = Catalog::filmUsage(1,$user);
    inventoryCheck(!isset($facts[$refs['unused']]),'foreign-owner assignments do not contaminate stock');
    inventoryCheck($facts[$refs['sent']]['sent']===1,'staff submission counts as sent');
    inventoryCheck($facts[$refs['full']]['platforms']['kuaishou']['sent']===1,'platform submission counts are retained');
    inventoryCheck(Catalog::filmUsage(999,$user)===[],'distribution facts are tenant isolated');
    $listing = Film::listing(1,$user,['library_id'=>$library,'sort'=>'unused']);
    inventoryCheck($listing['count']===4,'all four owned inventory states are listed');
    inventoryCheck($listing['states']===['unused'=>1,'assigned'=>1,'sent'=>1,'full'=>1],'state totals partition owned films');
    inventoryCheck(array_column(array_column($listing['lists'],'usage'),'state')===['unused','assigned','sent','full'],'unused-first ordering is stable across states');
    inventoryCheck(!array_key_exists('tasks',$listing['lists'][1]['usage']),'internal task set is not exposed in film listing');
    foreach (array_keys($refs) as $state) {
        $filtered = Film::listing(1,$user,['library_id'=>$library,'usage'=>$state]);
        inventoryCheck($filtered['count']===1 && $filtered['lists'][0]['ref']===$refs[$state],'drill-down filter '.$state);
        inventoryCheck($filtered['states']===$listing['states'],'filter keeps unfiltered state counters '.$state);
    }
    inventoryDenied(fn()=>Film::listing(1,$user,['usage'=>'unknown']),'invalid inventory state rejected');
    inventoryDenied(fn()=>Film::listing(1,$owners['b'],['library_id'=>$library]),'foreign library cannot be browsed');
    inventoryCheck(Film::listing(999,$user,[])['count']===0,'film listing remains tenant isolated');
    $libraries = Catalog::listing(1,$user,['kind'=>'video'])['lists'];
    $group = array_values(array_filter($libraries,fn($row)=>(int)$row['id']===$library))[0];
    $blank = array_values(array_filter($libraries,fn($row)=>(int)$row['id']===$empty))[0];
    inventoryCheck($group['states']===$listing['states'],'group totals agree with detail filters');
    inventoryCheck($group['warn_below']===3 && $group['level']==='low','per-group warning threshold drives low-stock state');
    inventoryCheck($group['active_tasks']===4,'active task count deduplicates task identities');
    inventoryCheck(count($group['covers'])===3,'group cover stack is capped at three');
    inventoryCheck($blank['level']==='empty' && $blank['count']===0,'empty inventory stays distinct from exhausted stock');
    inventoryCheck(Catalog::warnBelow(1,$user,'video',$empty)===5,'new groups use default warning threshold');
    Catalog::save(1,$user,['kind'=>'video','id'=>$library,'name'=>'QA inventory','max_uses'=>2,'warn_below'=>0]);
    $group = array_values(array_filter(Catalog::listing(1,$user,['kind'=>'video'])['lists'],fn($row)=>(int)$row['id']===$library))[0];
    inventoryCheck($group['warn_below']===0 && $group['level']==='ok','zero warning disables low-stock warning while unused stock remains');
    inventoryDenied(fn()=>Catalog::save(1,$user,['kind'=>'video','id'=>$library,'name'=>'QA inventory','warn_below'=>1001]),'warning threshold upper bound enforced');

    Db::name('oem_publish_task')->where('id',$active)->update(['state'=>'cancelled']);
    $released = Film::listing(1,$user,['library_id'=>$library,'usage'=>'unused']);
    inventoryCheck($released['count']===2,'cancelled task releases assigned inventory');
    $sentTask = (int)array_key_first($facts[$refs['sent']]['tasks']);
    Db::name('oem_publish_task')->where('id',$sentTask)->update(['state'=>'cancelled']);
    $historical = Catalog::filmUsage(1,$user)[$refs['sent']];
    inventoryCheck($historical['assigned']===0 && $historical['sent']===1,'cancellation keeps historical staff submission facts');
    inventoryCheck(Catalog::filmState($historical,2)==='sent','historical submitted video does not become unused');
    echo "All $checks inventory checks passed. Fixtures rolled back; no provider, notification or generation calls.\n";
} finally {
    Db::rollback();
}
