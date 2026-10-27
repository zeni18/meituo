<?php
declare(strict_types=1);
namespace app\common\service\press;

use think\facade\Db;
use app\common\service\merchant\MerchantAccountTables as Tables;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
use app\common\enum\user\AccountLogEnum as LogType;
use InvalidArgumentException as Invalid;

final class PressService
{
    private static function brandQuery(string $table,int $t,int $u){return \app\common\service\merchant\geo\GeoBrandScope::bound($t,$u)?\app\common\service\merchant\geo\GeoBrandScope::query($table,$t,$u):Db::name($table)->where(['tenant_id'=>$t,'user_id'=>$u]);}
    public function __construct(private readonly HaipressClient $client=new HaipressClient()) {}
    public static function text(mixed $value,int $max,bool $required=false): string
    {
        if (!is_string($value) || mb_strlen($value)>$max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/',$value)) throw new Invalid('文本格式或长度不正确');
        $value=trim($value); if ($required && $value==='') throw new Invalid('请填写必填内容'); return $value;
    }
    private static function merchant(int $tenant,int $user,bool $lock=false): array
    {
        $t=Db::name('tenant')->where('id',$tenant)->whereNull('delete_time')->find();
        if (!$t || (int)$t['disable']!==0 || ((int)($t['contract_status']??0)>0 && (int)$t['contract_expire_time']>0 && (int)$t['contract_expire_time']<=time())) throw new Invalid('OEM不可用或服务已到期');
        $m=Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user,'status'=>1])->lock($lock)->find();
        $u=Db::name(Tables::name($tenant,'user'))->where(['tenant_id'=>$tenant,'id'=>$user,'is_disable'=>0])->whereNull('delete_time')->lock($lock)->find();
        if (!$m || !$u) throw new Invalid('商家已停用或不存在'); return $u;
    }
    public static function availability(): array
    {
        $r=Db::name('press_config')->where('id',1)->field('enabled,public_base')->find();
        return ['enabled'=>(bool)($r['enabled']??0),'publishing_ready'=>!empty($r['enabled'])&&!empty($r['public_base']),'provider'=>'海讯社','points_per_yuan'=>100];
    }
    public function sync(int $kind,int $page,int $actor=0): array
    {
        if (!in_array($kind,[1,2],true)) throw new Invalid('其他类别请使用一键同步全部');
        if ($page<1 || $page>100000) throw new Invalid('资源页码不正确');
        $config=PressConfig::resolve(); $data=$this->client->resources($kind,$page,100,(int)$config['revision']);
        $prepared=[];
        foreach ($data['list'] as $r) {
            $id=self::text((string)($r['sourceid']??''),120,true); $name=self::text($r['name']??'',255,true);
            $cost=PressMoney::cents($r['costprice']??'0');
            $prepared[]=['kind'=>$kind,'source_id'=>$id,'name'=>$name,'cost_cents'=>$cost,
                'region'=>mb_substr((string)($r['region']??''),0,120),'category'=>mb_substr((string)($r['classify']??$r['industrystr']??''),0,120),
                'remark'=>mb_substr((string)($r['remark']??''),0,8000),'case_url'=>mb_substr((string)($r['caseurl']??$r['case_uri']??''),0,2048),
                'active'=>(string)($r['flag']??'0')==='1' && (string)($r['deleted']??'0')==='1' && $cost>0?1:0,
                'config_revision'=>$config['revision'],'sync_time'=>time()];
        }
        Db::transaction(function() use($prepared,$config) {
            $live=Db::name('press_config')->where('id',1)->lock(true)->find();
            if (!$live || (int)$live['revision']!==(int)$config['revision'] || !(int)$live['enabled']) throw new Invalid('资源同步期间配置已变更');
            foreach ($prepared as $r) {
                $old=Db::name('press_media')->where(['kind'=>$r['kind'],'source_id'=>$r['source_id']])->find();
                if ($old) Db::name('press_media')->where('id',$old['id'])->update($r); else Db::name('press_media')->insert($r);
            }
        });
        PressConfig::audit('media_sync',$actor);
        return ['synced'=>count($prepared),'total'=>(int)$data['total'],'page'=>$page,'next_page'=>$page*100<(int)$data['total']?$page+1:null];
    }
    public static function media(array $p,bool $platform=false): array
    {
        $config=Db::name('press_config')->where('id',1)->find();
        $q=Db::name('press_media')->where('config_revision',(int)($config['revision']??0));
        if (!$platform) $q->where('active',1)->whereIn('kind',array_keys(PressResourceCatalog::TYPES));
        if (isset($p['kind']) && $p['kind']!=='') $q->where('kind',(int)$p['kind']);
        if (($keyword=self::text($p['keyword']??'',80))!=='') $q->whereLike('name','%'.addcslashes($keyword,'%_\\').'%');
        if (($region=self::text($p['region']??'',80))!=='') $q->whereLike('region','%'.addcslashes($region,'%_\\').'%');
        $page=max(1,(int)($p['page']??1));$count=(clone $q)->count();$rows=$q->order('id desc')->page($page,20)->select()->toArray();
        foreach ($rows as &$r) {
            $r['retail_cents']=PressMoney::retail((int)$r['cost_cents'],(int)($config['markup_bps']??0));$r['points']=PressMoney::points($r['retail_cents']);
            $r['price_options']=[];foreach(PressPriceOptions::costs($r) as $option){$retail=PressMoney::retail($option['cost_cents'],(int)($config['markup_bps']??0));$r['price_options'][]=['price_type'=>$option['price_type'],'label'=>$option['label'],'retail_cents'=>$retail,'points'=>PressMoney::points($retail)];}
            if($r['price_options']){$r['retail_cents']=$r['price_options'][0]['retail_cents'];$r['points']=$r['price_options'][0]['points'];}
            unset($r['details_json'],$r['sync_batch']);
            if (!$platform) unset($r['cost_cents'],$r['config_revision']);
        }
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>20,'availability'=>self::availability()];
    }
    public static function draftSave(int $tenant,int $user,array $p): array
    {
        self::merchant($tenant,$user);$title=self::text($p['title']??'',120,true);$body=self::text($p['body']??'',100000,true);$token=bin2hex(random_bytes(32));
        $id=(int)Db::name('press_draft')->insertGetId(['tenant_id'=>$tenant,'user_id'=>$user,'brand_id'=>\app\common\service\merchant\geo\GeoBrandScope::id($tenant,$user),'title'=>$title,'body'=>$body,
            'preview_hash'=>hash('sha256',$token),'preview_cipher'=>Vault::seal(['token'=>$token],$tenant,'press_preview'),'expires_at'=>time()+30*86400,'create_time'=>time()]);
        return ['id'=>$id,'title'=>$title,'body'=>$body,'create_time'=>time()];
    }
    public static function drafts(int $tenant,int $user): array
    {
        self::merchant($tenant,$user);
        return ['lists'=>self::brandQuery('press_draft',$tenant,$user)->where(['tenant_id'=>$tenant,'user_id'=>$user])->field('id,title,body,create_time')->order('id desc')->limit(100)->select()->toArray()];
    }
    private static function quoteData(int $tenant,int $user,array $p): array
    {
        self::merchant($tenant,$user);$config=PressConfig::resolve();PressConfig::assertPublishReady($config);
        $draft=self::brandQuery('press_draft',$tenant,$user)->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>(int)($p['draft_id']??0)])->where('expires_at','>',time()+3600)->find();
        if (!$draft) throw new Invalid('请选择本商家的有效稿件，过期稿件请另存新版本');
        $ids=$p['media_ids']??[];
        if (!is_array($ids) || !array_is_list($ids) || !$ids || count($ids)>20) throw new Invalid('请选择1至20家媒体');
        foreach ($ids as $id) if ((!is_int($id) && !(is_string($id)&&ctype_digit($id))) || (int)$id<=0) throw new Invalid('媒体编号不正确');
        $ids=array_map('intval',$ids); if (count(array_unique($ids))!==count($ids)) throw new Invalid('不能重复选择媒体');sort($ids);
        $rows=Db::name('press_media')->whereIn('id',$ids)->whereIn('kind',array_keys(PressResourceCatalog::TYPES))->where('active',1)->where('sync_time','>=',time()-86400)->where('config_revision',$config['revision'])->order('id')->select()->toArray();
        if (count($rows)!==count($ids)) throw new Invalid('部分媒体已失效或报价已过期，请联系平台同步资源');
        $types=PressPriceOptions::types($p,$ids);$origin=self::text($p['origin']??'',1000);
        $total=0;foreach ($rows as &$r) {$options=PressPriceOptions::costs($r);$type=$types[(int)$r['id']];if(!isset($options[$type]))throw new Invalid('所选媒体不支持该发布方式，请重新选择');$r['price_type']=$type;$r['price_label']=$options[$type]['label'];$r['origin']=$origin;$r['cost_cents']=$options[$type]['cost_cents'];$r['retail_cents']=PressMoney::retail((int)$r['cost_cents'],(int)$config['markup_bps']);$total+=$r['retail_cents'];}unset($r);
        if ($total<=0 || $total>10000000) throw new Invalid('发稿总金额超过单次限额');
        return [$config,$draft,$rows,$total];
    }
    private static function quoteHash(int $tenant,int $user,array $data,int $expires): string
    {
        [$config,$draft,$rows]=$data;
        $values=[$tenant,$user,$draft['id'],$config['revision'],$expires,array_map(fn($r)=>[$r['id'],$r['cost_cents'],$r['retail_cents'],$r['price_type'],$r['origin']],$rows)];
        return hash_hmac('sha256',json_encode($values,JSON_THROW_ON_ERROR),$config['secret_cipher']);
    }
    public static function quote(int $tenant,int $user,array $p): array
    {
        $data=self::quoteData($tenant,$user,$p);$expires=time()+600;
        return ['quote_hash'=>self::quoteHash($tenant,$user,$data,$expires),'expires_at'=>$expires,'total_cents'=>$data[3],'points'=>PressMoney::points($data[3]),
            'items'=>array_map(fn($r)=>['id'=>(int)$r['id'],'name'=>$r['name'],'price_type'=>$r['price_type'],'price_label'=>$r['price_label'],'retail_cents'=>$r['retail_cents'],'points'=>PressMoney::points($r['retail_cents'])],$data[2])];
    }
    private static function balanceChange(int $tenant,int $user,string $sn,int $pointCents,bool $refund): void
    {
        $table=Tables::name($tenant,'user');$u=Db::name($table)->where(['tenant_id'=>$tenant,'id'=>$user])->lock(true)->find();
        if (!$u) throw new Invalid('商家账户不存在');
        $after=PressMoney::cents($u['user_money'])+($refund?$pointCents:-$pointCents);
        if ($after<0 || $after>9999999999) throw new Invalid($after<0?'商家算力余额不足':'账户额度超过上限');
        $balance=PressMoney::decimal($after);
        Db::name($table)->where(['tenant_id'=>$tenant,'id'=>$user])->update(['user_money'=>$balance,'update_time'=>time()]);
        Db::name(Tables::name($tenant,'user_account_log'))->insert(['tenant_id'=>$tenant,'user_id'=>$user,'sn'=>'HPAL'.bin2hex(random_bytes(10)),'source_sn'=>$sn,
            'change_object'=>1,'change_type'=>$refund?LogType::UM_INC_APP_REFUND:LogType::UM_DEC_APP_CONSUME,'action'=>$refund?1:2,
            'change_amount'=>PressMoney::decimal($pointCents),'left_amount'=>$balance,'remark'=>$refund?'媒体发稿预扣返还':'媒体发稿预扣算力',
            'extra'=>json_encode(['provider'=>'haipress','billing_phase'=>$refund?'released':'reserved']),'create_time'=>time(),'update_time'=>time()]);
    }
    public static function create(int $tenant,int $user,array $p): array
    {
        $key=$p['request_key']??'';if (!is_string($key) || !preg_match('/^[a-zA-Z0-9_-]{16,64}$/D',$key)) throw new Invalid('请求标识不正确');
        if (($p['confirmed']??false)!==true) throw new Invalid('请先核对费用并确认发稿');
        $remark=self::text($p['remark']??'',1000);$ids=array_map('intval',is_array($p['media_ids']??null)?$p['media_ids']:[]);sort($ids);
        $types=PressPriceOptions::types($p,$ids);$origin=self::text($p['origin']??'',1000);
        // Default orders keep the historical fingerprint, so an old accepted request can be replayed safely.
        $identity=[(int)($p['draft_id']??0),$ids,$remark];
        if($origin!==''||array_filter($types,fn($v)=>$v!==1))array_push($identity,$types,$origin);
        $payload=hash('sha256',json_encode($identity,JSON_THROW_ON_ERROR));
        return Db::transaction(function() use($tenant,$user,$p,$key,$payload,$remark) {
            self::merchant($tenant,$user,true);
            $old=self::brandQuery('press_order',$tenant,$user)->where(['tenant_id'=>$tenant,'user_id'=>$user,'request_key'=>$key])->order('id')->select()->toArray();
            if ($old) {if (!hash_equals($old[0]['payload_hash'],$payload)) throw new Invalid('同一请求标识不能用于不同稿件或媒体');return ['ids'=>array_map('intval',array_column($old,'id')),'replayed'=>true];}
            $data=self::quoteData($tenant,$user,$p);[$config,$draft,$media,$total]=$data;
            $expires=(int)($p['expires_at']??0);
            if ($expires<time() || $expires>time()+610 || !hash_equals(self::quoteHash($tenant,$user,$data,$expires),(string)($p['quote_hash']??''))) throw new Invalid('报价已失效或发生变化，请重新确认');
            $token=Vault::open($draft['preview_cipher'],$tenant,'press_preview')['token'];$result=[];
            foreach ($media as $r) {
                $sn='HP'.date('YmdHis').bin2hex(random_bytes(10));
                $id=(int)Db::name('press_order')->insertGetId(['sn'=>$sn,'tenant_id'=>$tenant,'user_id'=>$user,'request_key'=>$key,'payload_hash'=>$payload,'draft_id'=>$draft['id'],'brand_id'=>(int)$draft['brand_id'],
                    'media_id'=>$r['id'],'price_type'=>$r['price_type'],'origin'=>$r['origin'],'source_id'=>$r['source_id'],'title'=>$draft['title'],'media_name'=>$r['name'],'cost_cents'=>$r['cost_cents'],'retail_cents'=>$r['retail_cents'],
                    'points'=>PressMoney::points($r['retail_cents']),'config_revision'=>$config['revision'],'account_hash'=>$config['account_hash'],'preview_url'=>$config['public_base'].'/press-preview/'.$token,
                    'remark'=>$remark,'published_url'=>'','create_time'=>time(),'update_time'=>time()]);
                self::balanceChange($tenant,$user,$sn,(int)$r['retail_cents']*100,false);$result[]=$id;
            }
            return ['ids'=>$result,'replayed'=>false,'notice'=>'已预扣算力并创建发稿任务，外部发布结果待回执确认'];
        });
    }
    private static function filtered(int $tenant,?int $user,?array $agent,bool $platform,array $p)
    {
        $q=PressScope::query($tenant,$user,$agent,$platform);
        if ($platform && !empty($p['tenant_id'])) $q->where('o.tenant_id',(int)$p['tenant_id']);
        if (!empty($p['merchant_id'])) $q->where('m.id',(int)$p['merchant_id']);
        if (!empty($p['agent_id'])) $q->where('m.agent_id',(int)$p['agent_id']);
        if (array_key_exists((int)($p['kind']??0),PressResourceCatalog::TYPES)) {
            $kind=(int)$p['kind'];
            $q->whereExists(function($media)use($kind){$media->name('press_media')->alias('gm')->fieldRaw('1')->whereColumn('gm.id','=','o.media_id')->where('gm.kind',$kind);});
        }
        if (($s=self::text($p['state']??'',32))!=='') $q->where('o.state',$s);
        if (($kw=self::text($p['keyword']??'',80))!=='') $q->whereLike('o.title|o.sn|o.media_name|m.name','%'.addcslashes($kw,'%_\\').'%');
        foreach (['date_from'=>'>=','date_to'=>'<='] as $key=>$op) if (!empty($p[$key])) {
            $d=\DateTimeImmutable::createFromFormat('!Y-m-d',(string)$p[$key]);if (!$d || $d->format('Y-m-d')!==$p[$key]) throw new Invalid('日期格式不正确');
            $q->where('o.create_time',$op,$d->getTimestamp()+($key==='date_to'?86399:0));
        }
        return $q;
    }
    private static function fields(bool $platform): string
    {
        return 'o.id,o.sn,o.tenant_id,o.title,o.media_name,o.state,o.billing_status,o.retail_cents,o.points,o.published_url,o.failure_reason,o.refund_evidence,o.process_state,o.create_time,o.update_time,m.id AS merchant_id,m.name AS merchant_name,m.agent_id'.($platform?',o.cost_cents,o.config_revision,o.provider_flag':'');
    }
    public static function orders(int $tenant,?int $user,?array $agent,bool $platform,array $p): array
    {
        $q=self::filtered($tenant,$user,$agent,$platform,$p);$count=(clone $q)->count();$page=max(1,(int)($p['page']??1));
        $summary=['count'=>$count,'reserved_cents'=>(int)(clone $q)->where('o.billing_status','reserved')->sum('o.retail_cents'),
            'consumed_cents'=>(int)(clone $q)->where('o.billing_status','captured')->sum('o.retail_cents'),
            'refunded_cents'=>(int)(clone $q)->where('o.billing_status','refunded')->sum('o.retail_cents')];
        if ($platform) $summary['supplier_cost_cents']=(int)(clone $q)->where('o.billing_status','captured')->sum('o.cost_cents');
        return ['lists'=>$q->field(self::fields($platform))->order('o.id desc')->page($page,20)->select()->toArray(),'count'=>$count,'page'=>$page,'page_size'=>20,'summary'=>$summary,'availability'=>self::availability()];
    }
    public static function detail(int $tenant,?int $user,?array $agent,bool $platform,int $id): array
    {
        $r=PressScope::query($tenant,$user,$agent,$platform)->where('o.id',$id)->field(self::fields($platform).',o.draft_id,o.remark,o.price_type,o.origin')->find();
        if (!$r) throw new Invalid('订单不存在或无访问权限');
        $draft=Db::name('press_draft')->where(['id'=>$r['draft_id'],'tenant_id'=>$r['tenant_id']])->field('title,body')->find();return $r+['draft'=>$draft];
    }
    public static function export(int $tenant,?int $user,?array $agent,bool $platform,array $p): array
    {
        $q=self::filtered($tenant,$user,$agent,$platform,$p);$count=(clone $q)->count();$rows=$q->field(self::fields($platform))->order('o.id desc')->limit(5000)->select()->toArray();
        $keys=['sn'=>'订单号','merchant_name'=>'商家','media_name'=>'媒体','title'=>'稿件','state'=>'状态','billing_status'=>'费用状态','retail_cents'=>'订单金额分','points'=>'算力','published_url'=>'发布链接'];
        if ($platform) $keys['cost_cents']='供方成本分';$lines=[implode(',',array_values($keys))];
        foreach ($rows as $r) {$line=[];foreach ($keys as $key=>$label) {$v=(string)($r[$key]??'');if (preg_match('/^[\s]*[=+@-]/u',$v)) $v="'".$v;$line[]='"'.str_replace('"','""',$v).'"';}$lines[]=implode(',',$line);}
        return ['csv'=>"\xEF\xBB\xBF".implode("\r\n",$lines),'count'=>count($rows),'truncated'=>$count>5000];
    }
    public static function refund(int $id,int $actor,string $evidence): array
    {
        $evidence=self::text($evidence,500,true);
        return Db::transaction(function() use($id,$actor,$evidence) {
            $r=Db::name('press_order')->where('id',$id)->lock(true)->find();if (!$r || !in_array($r['state'],['rejected','feedback','refunded'],true)) throw new Invalid('仅可处理退稿或反馈中的订单');
            if ($r['billing_status']==='refunded') return ['replayed'=>true];
            if (!in_array($r['billing_status'],['reserved','captured'],true)) throw new Invalid('费用状态不支持退款');
            self::balanceChange((int)$r['tenant_id'],(int)$r['user_id'],$r['sn'],PressMoney::cents($r['points']),true);
            Db::name('press_order')->where('id',$id)->update(['billing_status'=>'refunded','state'=>'refunded','refund_evidence'=>$evidence,'lease_token'=>bin2hex(random_bytes(16)),'lease_until'=>0,'update_time'=>time()]);
            PressConfig::audit('refund_confirm',$actor,$id,$evidence);return ['refunded'=>true];
        });
    }
    public static function process(int $tenant,int $user,array $p): array
    {
        $flag=(int)($p['flag']??0);$note=self::text($p['note']??'',1000,$flag===4);
        if (!in_array($flag,[4,5],true)) throw new Invalid('请选择确认发布或反馈');
        return Db::transaction(function() use($tenant,$user,$p,$flag,$note) {
            self::merchant($tenant,$user,true);
            $r=self::brandQuery('press_order',$tenant,$user)->where('id',(int)($p['id']??0))->lock(true)->find();
            if (!$r || $r['state']!=='published' || $r['billing_status']==='refunded') throw new Invalid('仅可处理本商家已发布待确认订单');
            if (!in_array($r['process_state'],['','failed'],true)) {
                if ((int)$r['process_flag']===$flag && $r['process_note']===$note) return ['queued'=>true,'replayed'=>true];
                throw new Invalid('发布处理已提交，请等待供方回执');
            }
            Db::name('press_order')->where('id',$r['id'])->update(['process_flag'=>$flag,'process_note'=>$note,'process_attempted'=>0,'process_state'=>'queued','next_poll'=>0,'update_time'=>time()]);
            PressConfig::audit($flag===5?'publish_confirm':'publish_feedback',0,(int)$r['id']);return ['queued'=>true];
        });
    }
    public static function resume(int $id,int $actor): array
    {
        return Db::transaction(function() use($id,$actor) {
            $config=PressConfig::resolve();
            $r=Db::name('press_order')->where('id',$id)->lock(true)->find();
            if (!$r || $r['state']!=='blocked' || !(int)$r['attempted'] || $r['billing_status']==='refunded') throw new Invalid('仅可恢复已暂停且曾提交的订单查询');
            if (!hash_equals($r['account_hash'],$config['account_hash'])) throw new Invalid('请先恢复此订单原海讯社账号凭证，不能跨供方账号查询');
            Db::name('press_order')->where('id',$id)->update(['state'=>'unknown','config_revision'=>$config['revision'],'lease_token'=>bin2hex(random_bytes(16)),'lease_until'=>0,'next_poll'=>0,'failure_reason'=>'平台已恢复原账号，仅核查原订单','update_time'=>time()]);
            PressConfig::audit('resume_query',$actor,$id);return ['resumed'=>true];
        });
    }
    private static function release(array $r,string $reason): void
    {
        Db::transaction(function() use($r,$reason) {
            $row=Db::name('press_order')->where(['id'=>$r['id'],'lease_token'=>$r['lease_token']])->lock(true)->find();
            if (!$row) return;
            if ($row['billing_status']==='reserved') {self::balanceChange((int)$row['tenant_id'],(int)$row['user_id'],$row['sn'],PressMoney::cents($row['points']),true);}
            Db::name('press_order')->where('id',$row['id'])->update(['state'=>'failed','billing_status'=>'refunded','failure_reason'=>$reason,'lease_until'=>0,'update_time'=>time()]);
        });
    }
    /** Persistent lease; once createON may have been sent, only query the original sn. */
    public function tick(?int $onlyId=null): bool
    {
        $r=Db::transaction(function() use($onlyId) {
            $q=Db::name('press_order')->whereIn('state',['queued','preparing','submitting','unknown','submitted','published','feedback'])->where('lease_until','<',time())->where('next_poll','<=',time());
            if ($onlyId!==null) $q->where('id',$onlyId);
            $row=$q->order('id')->lock(true)->find();if (!$row) return null;
            $row['lease_token']=bin2hex(random_bytes(16));
            Db::name('press_order')->where('id',$row['id'])->update(['lease_token'=>$row['lease_token'],'lease_until'=>time()+180,'state'=>$row['attempted']?$row['state']:'preparing']);return $row;
        });
        if (!$r) return false;
        $q=fn()=>Db::name('press_order')->where(['id'=>$r['id'],'lease_token'=>$r['lease_token']]);$attempted=(bool)$r['attempted'];
        try {
            $config=PressConfig::resolve();
            if (!hash_equals($r['account_hash'],$config['account_hash'])) throw new Invalid('供方账号已变更，订单已暂停，需平台恢复原供方账号后再核查');
            if ((int)$config['revision']!==(int)$r['config_revision']) {$r['config_revision']=$config['revision'];$q()->update(['config_revision'=>$config['revision']]);}
            if (!$attempted) {
                self::merchant((int)$r['tenant_id'],(int)$r['user_id']);
                if (!Db::name('press_draft')->where(['id'=>$r['draft_id'],'tenant_id'=>$r['tenant_id'],'user_id'=>$r['user_id']])->where('expires_at','>',time()+3600)->find()) throw new Invalid('稿件预览已过期，未向供方提交，请另存新版本');
                $s=$this->client->resourceState($r['source_id'],(int)$r['config_revision']);
                if ((string)($s['flag']??'')!=='1' || (string)($s['deleted']??'')!=='1') {self::release($r,'媒体已下架或状态无法验证，未向供方提交');return true;}
                if (!$q()->where('attempted',0)->update(['state'=>'submitting','attempted'=>1,'update_time'=>time()])) return true;
                $attempted=true;
                $this->client->submit($r);$q()->update(['state'=>'submitted','failure_reason'=>'','lease_until'=>0,'next_poll'=>time()+600,'update_time'=>time()]);
            } else {
                $d=$this->client->query($r);$flag=(int)$d['flag'];
                $state=[0=>'submitted',1=>'submitted',2=>'rejected',3=>'published',4=>'feedback',5=>'completed',100=>'unknown'][$flag];
                $url=(string)($d['url']??'');
                if (in_array($flag,[3,5],true) && (!filter_var($url,FILTER_VALIDATE_URL) || !in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true) || parse_url($url,PHP_URL_USER)!==null || parse_url($url,PHP_URL_PASS)!==null)) throw new HaipressFailure(true,'missing_receipt','供方称已发布但没有有效回链，等待核实');
                if ($flag===3 && $r['process_state']==='queued' && !(int)$r['process_attempted']) {
                    if (!$q()->where('process_attempted',0)->update(['process_attempted'=>1,'process_state'=>'unknown'])) return true;
                    try {$this->client->process($r,(int)$r['process_flag'],$r['process_note']);$q()->update(['process_state'=>'accepted']);}
                    catch (HaipressFailure $e) {if (!$e->uncertain) $q()->update(['process_state'=>'failed']);throw $e;}
                }
                $update=['state'=>$state,'provider_flag'=>$flag,'published_url'=>in_array($flag,[3,5],true)?$url:$r['published_url'],'failure_reason'=>$flag===100?'供方暂未查到订单，禁止自动重新下单':($flag===2?'供方退稿：'.mb_substr(strip_tags((string)($d['result']??'')),0,180):''),'next_poll'=>time()+600,'lease_until'=>0,'update_time'=>time()];
                if (in_array($flag,[4,5],true) && (int)$r['process_attempted']) $update['process_state']='done';
                if ($flag===3 && $r['process_state']==='done' && (int)$r['process_flag']===4) {$update['process_state']='';$update['process_attempted']=0;}
                if (in_array($flag,[3,5],true) && $r['billing_status']==='reserved') $update['billing_status']='captured';
                $q()->update($update);
            }
        } catch (Invalid $e) {
            if (!$attempted) self::release($r,mb_substr($e->getMessage(),0,240));
            else $q()->update(['state'=>'blocked','failure_reason'=>mb_substr($e->getMessage(),0,240),'lease_until'=>0,'update_time'=>time()]);
        } catch (HaipressFailure $e) {
            if (!$attempted || (!$e->uncertain && $r['attempted']==0)) self::release($r,$e->getMessage());
            else $q()->update(['state'=>$r['state']==='published'?'published':'unknown','failure_reason'=>$e->getMessage(),'lease_until'=>0,'next_poll'=>time()+600,'update_time'=>time()]);
        } catch (\Throwable) {
            if (!$attempted) self::release($r,'提交前校验失败，已返还预扣；请联系平台');
            else $q()->update(['state'=>'unknown','failure_reason'=>'提交或查询结果不确定，仅查询原单，不重复发稿','lease_until'=>0,'next_poll'=>time()+600,'update_time'=>time()]);
        }
        return true;
    }
}
