<?php
declare(strict_types=1);
namespace app\common\service\press;

use think\facade\Db;

/** One durable platform-wide job; no credentials, orders or balances in job state. */
final class PressResourceSync
{
    public function __construct(private readonly HaipressClient $client = new HaipressClient()) {}

    /** Called only under the config lock, after verifying unchanged credentials. */
    public static function carryConfiguration(int $previous,int $next,bool $enabled): void
    {
        // Same lock order as finish(): config -> job -> media.
        $job=Db::name('press_resource_sync')->where('id',1)->lock(true)->find();
        Db::name('press_media')->where('config_revision',$previous)->update(['config_revision'=>$next]);
        if (!$job || (int)$job['config_revision']!==$previous) return;
        $update=['config_revision'=>$next];
        if (in_array($job['state'],['queued','running'],true)) {
            // Revoke an in-flight response. The same page is retried with the
            // new configuration; completed pages and resource batches survive.
            $progress=json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR);
            foreach ($progress as &$item) if ($item['state']==='running') $item['state']='pending';
            unset($item);
            $update+=['state'=>'queued','lease_token'=>'','lease_until'=>0,'updated_at'=>time(),
                'progress_json'=>json_encode($progress,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)];
        }
        Db::name('press_resource_sync')->where('id',1)->update($update);
        if (!$enabled && in_array($job['state'],['queued','running'],true)) self::block();
    }

    public static function start(int $actor=0, ?int $revision=null): array
    {
        Db::transaction(function() use ($actor,$revision) {
            $config = Db::name('press_config')->where('id',1)->lock(true)->find();
            if (!$config || !(int)$config['enabled']) throw new \InvalidArgumentException('请先保存并启用海讯社接口');
            if ($revision !== null && $revision !== (int)$config['revision']) throw new \InvalidArgumentException('配置已变更，请刷新后同步');
            $job = Db::name('press_resource_sync')->where('id',1)->lock(true)->find();
            if (!$job) throw new \RuntimeException('Resource sync schema missing');
            $same = (int)$job['config_revision'] === (int)$config['revision'];
            if ($same && in_array($job['state'],['queued','running'],true)) return;
            $resume = $same && $job['state']==='partial';
            $progress = $resume ? json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR) : [];
            foreach (PressResourceCatalog::TYPES as $kind=>$name) {
                if (!$resume) $progress[$kind] = ['kind'=>$kind,'name'=>$name,'batch'=>bin2hex(random_bytes(16)),'state'=>'pending','page'=>1,'synced'=>0,'total'=>null,'attempts'=>0,'retry_at'=>0,'error'=>'','last_page_hash'=>''];
                elseif ($progress[$kind]['state']!=='completed') {
                    $progress[$kind] = array_replace($progress[$kind],['state'=>'pending','attempts'=>0,'retry_at'=>0,'error'=>'']);
                    if ($progress[$kind]['page']===1) $progress[$kind]['batch']=bin2hex(random_bytes(16));
                }
            }
            $now=time();
            Db::name('press_resource_sync')->where('id',1)->update(['batch'=>$resume?$job['batch']:bin2hex(random_bytes(16)),
                'config_revision'=>$config['revision'],'state'=>'queued','progress_json'=>json_encode($progress,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
                'cursor_kind'=>0,'lease_token'=>'','lease_until'=>0,'started_at'=>$resume?$job['started_at']:$now,'updated_at'=>$now,'finished_at'=>0,'actor_id'=>$actor,'message'=>'']);
            PressConfig::audit($resume?'resource_sync_resume':'resource_sync_start',$actor);
        });
        return self::status();
    }

    public static function status(): array
    {
        $job = Db::name('press_resource_sync')->where('id',1)->find();
        if (!$job) throw new \RuntimeException('Resource sync schema missing');
        $progress = array_values(json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR));
        return ['batch'=>$job['batch'],'state'=>$job['state'],'message'=>$job['message'],
            'config_revision'=>(int)$job['config_revision'],'categories'=>$progress,'synced'=>array_sum(array_column($progress,'synced')),
            'completed'=>count(array_filter($progress,static fn($p)=>$p['state']==='completed')),
            'failed'=>count(array_filter($progress,static fn($p)=>$p['state']==='failed')),
            'started_at'=>(int)$job['started_at'],'updated_at'=>(int)$job['updated_at'],'finished_at'=>(int)$job['finished_at'],
            'worker_online'=>(int)$job['worker_seen']>time()-120];
    }

    /** Claim/fetch/commit one page; HTTP executes outside the transaction. */
    public function tick(): bool
    {
        $claim = Db::transaction(function() {
            $job = Db::name('press_resource_sync')->where('id',1)->lock(true)->find();
            if (!$job) throw new \RuntimeException('Resource sync schema missing');
            Db::name('press_resource_sync')->where('id',1)->update(['worker_seen'=>time()]);
            if (!in_array($job['state'],['queued','running'],true) || (int)$job['lease_until']>time()) return null;
            $progress = json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR);
            // Round-robin ensures a large category does not hide the other 14 categories.
            for ($i=1;$i<=15;$i++) {
                $kind=((int)$job['cursor_kind']+$i-1)%15+1;
                if (in_array($progress[$kind]['state'],['completed','failed'],true) || $progress[$kind]['retry_at']>time()) continue;
                $lease=bin2hex(random_bytes(16));$progress[$kind]['state']='running';
                Db::name('press_resource_sync')->where('id',1)->update(['state'=>'running','lease_token'=>$lease,'lease_until'=>time()+180,'updated_at'=>time(),'cursor_kind'=>$kind,'progress_json'=>json_encode($progress,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
                return ['batch'=>$job['batch'],'resource_batch'=>$progress[$kind]['batch'],'revision'=>(int)$job['config_revision'],'lease'=>$lease,'kind'=>$kind,'page'=>(int)$progress[$kind]['page']];
            }
            return null;
        });
        if (!$claim) return false;
        try {
            $data=$this->client->resources($claim['kind'],$claim['page'],PressResourceCatalog::PAGE_SIZE,$claim['revision']);
            $rows=PressResourceCatalog::prepare($data['list'],$claim['kind'],$claim['revision'],$claim['resource_batch']);
            $total=(int)$data['total'];$offset=($claim['page']-1)*PressResourceCatalog::PAGE_SIZE;
            if (count($rows)<min(PressResourceCatalog::PAGE_SIZE,max(0,$total-$offset))) throw new \InvalidArgumentException('供方返回页数不完整，请重试本页');
            if ($total===0 && $rows) throw new \InvalidArgumentException('供方资源总数与列表不一致');
            $hash=hash('sha256',implode('|',array_column($rows,'source_id')));
            $this->finish($claim,$rows,$total,$hash);
        } catch (\Throwable $e) { $this->fail($claim,$e); }
        return true;
    }

    private static function lockedJob(array $claim): ?array
    {
        $job=Db::name('press_resource_sync')->where('id',1)->lock(true)->find();
        return $job && hash_equals($job['batch'],$claim['batch']) && hash_equals($job['lease_token'],$claim['lease']) ? $job : null;
    }

    private static function validConfig(?array $config,array $claim): bool
    {
        return $config && (int)$config['enabled']===1 && (int)$config['revision']===$claim['revision'];
    }

    private static function block(): void
    {
        Db::name('press_resource_sync')->where('id',1)->update(['state'=>'blocked','lease_token'=>'','lease_until'=>0,'finished_at'=>time(),'updated_at'=>time(),'message'=>'配置已变更或接口已停用；保存并启用配置后重新同步。']);
    }

    private function finish(array $claim,array $rows,int $total,string $hash): void
    {
        Db::transaction(function() use ($claim,$rows,$total,$hash) {
            $config=Db::name('press_config')->where('id',1)->lock(true)->find();
            $job=self::lockedJob($claim);if (!$job) return;
            if (!self::validConfig($config,$claim)) { self::block();return; }
            $progress=json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR);$item=&$progress[$claim['kind']];
            if ($rows && $item['last_page_hash']===$hash) throw new \InvalidArgumentException('供方重复返回上一页，已停止该页写入');
            PressResourceCatalog::store($rows);
            $item['synced']+=count($rows);$item['total']=$total;$item['attempts']=0;$item['retry_at']=0;$item['error']='';$item['last_page_hash']=$hash;
            if ($claim['page']*PressResourceCatalog::PAGE_SIZE >= $total) {
                // Only a fully retrieved category may retire missing old resources.
                $unique=(int)Db::name('press_media')->where(['kind'=>$claim['kind'],'sync_batch'=>$claim['resource_batch']])->count();
                if ($unique!==$total) throw new \InvalidArgumentException('资源目录在同步期间变化，请重新同步此类别');
                Db::name('press_media')->where('kind',$claim['kind'])->where('sync_batch','<>',$claim['resource_batch'])->update(['active'=>0]);
                $item['state']='completed';
            } else { $item['page']++;$item['state']='pending'; }
            self::saveProgress($progress);
        });
    }

    private function fail(array $claim,\Throwable $error): void
    {
        Db::transaction(function() use ($claim,$error) {
            $config=Db::name('press_config')->where('id',1)->lock(true)->find();
            $job=self::lockedJob($claim);if (!$job) return;
            if (!self::validConfig($config,$claim)) { self::block();return; }
            $progress=json_decode($job['progress_json'],true,512,JSON_THROW_ON_ERROR);$item=&$progress[$claim['kind']];$item['attempts']++;
            $item['error']=$error instanceof \InvalidArgumentException ? mb_substr($error->getMessage(),0,180) : ($error instanceof HaipressFailure ? '供方接口暂不可用（'.$error->providerCode.'），请检查连接或稍后重试' : '资源写入失败，请检查服务器日志和数据库状态');
            $item['state']=$item['attempts']<3?'retrying':'failed';$item['retry_at']=time()+min(60,$item['attempts']*10);
            // A changing/overlapping result set must restart that category on resume.
            if ($error instanceof \InvalidArgumentException && str_contains($error->getMessage(),'目录在同步期间变化')) {
                $item['state']='failed';$item['page']=1;$item['synced']=0;$item['last_page_hash']='';
            }
            self::saveProgress($progress);
        });
    }

    private static function saveProgress(array $progress): void
    {
        $active=array_filter($progress,static fn($p)=>!in_array($p['state'],['completed','failed'],true));
        $failed=array_filter($progress,static fn($p)=>$p['state']==='failed');
        $state=$active?'running':($failed?'partial':'completed');
        Db::name('press_resource_sync')->where('id',1)->update(['state'=>$state,'progress_json'=>json_encode($progress,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
            'lease_token'=>'','lease_until'=>0,'updated_at'=>time(),'finished_at'=>$active?0:time(),'message'=>'']);
    }
}
