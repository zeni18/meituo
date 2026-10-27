<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use app\common\service\merchant\MerchantAccountTables;
use app\common\service\merchant\MerchantWorkspaceService;
use think\facade\Db;
use InvalidArgumentException as Invalid;

final class MerchantClipService
{
    private static function documents(int $tenant,int $user){return Db::name('oem_clip_document')->where(['tenant_id'=>$tenant,'user_id'=>$user]);}
    private static function kind($kind):string{if(!is_string($kind)||!in_array($kind,['project','template'],true))throw new Invalid('记录类型不正确');return $kind;}
    private static function owned(int $tenant,int $user,int $id,bool $lock=false):array
    {
        $row=self::documents($tenant,$user)->where(['id'=>$id,'delete_time'=>0])->lock($lock)->find();if(!$row)throw new Invalid('工程或模板不存在或无访问权限');return $row;
    }
    public static function capabilities(int $tenant=0):array
    {
        // No credentials in responses. Configuration is not a successful provider integration test.
        $data=['billing'=>['merchant_points_per_output'=>0,'unit'=>'TP','charged_to'=>'cloud_account'],'intelligence'=>ClipIntelligence::catalog(),'effects'=>ClipFeatures::catalog(),'editing'=>true,'planning'=>true,'rendering'=>false,'services'=>[
            ['code'=>'oss','name'=>'阿里云 OSS','state'=>'pending_setup','purpose'=>'素材、配音和成片存储'],
            ['code'=>'ims','name'=>'阿里云 IMS','state'=>'pending_integration','purpose'=>'成片、云模板、音视频智能处理与任务查询'],
            ['code'=>'tts','name'=>'火山引擎语音合成','state'=>'pending_integration','purpose'=>'文本配音与字幕时间戳'],
            ['code'=>'icl','name'=>'火山引擎声音复刻','state'=>'pending_integration','purpose'=>'上传声音复刻、个人音色保存与重复配音'],
            ['code'=>'llm','name'=>'文本／多模态模型','state'=>'pending_integration','purpose'=>'AI选题与口播文案生成'],
            ['code'=>'asr','name'=>'录音识别 ASR','state'=>'pending_integration','purpose'=>'音频文案与时间戳识别'],
            ['code'=>'imm','name'=>'阿里云 IMM','state'=>'pending_integration','purpose'=>'图片标签、文字识别与成片打包'],
        ],'notice'=>'工程与模板可正常保存。视频合成和AI生成暂未开通。'];
        if($tenant>0)foreach($data['services'] as &$service){$meta=ClipIntegrationService::metadata($tenant,$service['code']);$service['configuration_state']=$meta['state'];$service['configuration_source']=$meta['source'];$service['borrowed']=$meta['borrowed'];$service['adapter_ready']=$meta['adapter_ready'];$service['state']=$meta['adapter_ready']?($meta['state']==='configured'?'configured':'needs_configuration'):'pending_integration';}unset($service);
        $ready=array_column($data['services'],null,'code');$data['rendering']=($ready['oss']['state']??'')==='configured'&&($ready['ims']['state']??'')==='configured';
        $data['notice']='云剪辑按平台／OEM配置调用，费用由对应云账号承担，当前不扣商家 TP。配置就绪仍需完成云账号实测。';
        return $data;
    }
    public static function listing(int $tenant,int $user,array $p):array
    {
        $kind=self::kind($p['kind']??'project');$q=self::documents($tenant,$user)->where('kind',$kind)->where('delete_time',($p['trash']??'')==='1'?'>':'=',0);
        $keyword=ClipConfiguration::text($p['keyword']??'',80);if($keyword!=='')$q->whereLike('name','%'.addcslashes($keyword,'%_\\').'%');
        $count=(clone $q)->count();$page=max(1,(int)($p['page']??1));$rows=$q->field('id,kind,name,mode,revision,create_time,update_time,delete_time')->order('update_time desc,id desc')->page($page,12)->select()->toArray();
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>12];
    }
    public static function assets(int $tenant,int $user,array $c,bool $probe=false):array
    {
        $refs=ClipConfiguration::references($c);$ids=array_values(array_unique(array_column($refs,'id')));if(!$ids)return [];
        $rows=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->whereIn('id',$ids)->select()->toArray();
        $map=array_column($rows,null,'id');
        foreach($refs as $ref)if(!isset($map[$ref['id']])||!in_array($map[$ref['id']]['kind'],$ref['kinds'],true))throw new Invalid('素材不存在、类型不符或无访问权限，请重新选择');
        $started=microtime(true);$result=[];foreach($rows as $row){$files=MerchantWorkspaceService::files($tenant,$user,json_decode($row['file_ids'],true)?:[],$row['kind']);if(count($files)!==1)throw new Invalid('素材文件已被移除，请重新上传');
            $file=$files[0];$duration=null;
            if($probe&&$row['kind']!=='image'){if(microtime(true)-$started>10)throw new Invalid('本批素材信息读取超时，请重试以使用已缓存的媒体信息');$stored=Db::name(MerchantAccountTables::name($tenant,'tenant_file'))->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'id'=>$file['id']])->whereNull('delete_time')->find();$duration=$stored?ClipMediaProbe::duration($stored):null;}
            $result[(int)$row['id']]=['id'=>(int)$row['id'],'name'=>$row['name'],'kind'=>$row['kind'],'file'=>$file,'duration'=>$duration];
        }return $result;
    }
    public static function detail(int $tenant,int $user,int $id):array
    {
        $row=self::owned($tenant,$user,$id);$row['config']=json_decode($row['config_json'],true);unset($row['config_json']);
        // Saved drafts remain recoverable if an asset is later recycled.
        try{$row['assets']=self::assets($tenant,$user,$row['config']);$row['asset_warning']='';}catch(Invalid $e){$row['assets']=[];$row['asset_warning']=$e->getMessage();}
        return $row;
    }
    /** Resolve a local draft through the same schema and ownership checks as a saved project. */
    public static function draftAssets(int $tenant,int $user,array $p):array
    {
        if(!is_array($p['config']??null))throw new Invalid('缺少草稿配置');
        $config=ClipConfiguration::normalize($p['config']);
        return ['config'=>$config,'assets'=>self::assets($tenant,$user,$config)];
    }
    public static function save(int $tenant,int $user,array $p):array
    {
        $kind=self::kind($p['kind']??'project');$name=ClipConfiguration::text($p['name']??'',100,true);
        if(!is_array($p['config']??null))throw new Invalid('缺少工程配置');$config=ClipConfiguration::normalize($p['config']);
        return Db::transaction(function()use($tenant,$user,$p,$kind,$name,$config){
            $id=(int)($p['id']??0);$revision=1;
            if($id){$row=self::owned($tenant,$user,$id,true);if($row['kind']!==$kind)throw new Invalid('不能改变工程或模板类型');
                if((string)($p['revision']??'')!==(string)$row['revision'])throw new Invalid('此工程已在其他窗口更新，请重新打开后保存');$revision=(int)$row['revision']+1;}
            elseif(self::documents($tenant,$user)->where(['kind'=>$kind,'delete_time'=>0])->count()>=200)throw new Invalid('工程或模板最多保存200条，请先整理回收站');
            self::assets($tenant,$user,$config);
            $data=['name'=>$name,'mode'=>$config['mode'],'revision'=>$revision,'config_json'=>json_encode($config,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'update_time'=>time()];
            if($id)self::documents($tenant,$user)->where('id',$id)->update($data);
            else $id=(int)Db::name('oem_clip_document')->insertGetId($data+['tenant_id'=>$tenant,'user_id'=>$user,'kind'=>$kind,'create_time'=>time()]);
            return ['id'=>$id,'revision'=>$revision,'kind'=>$kind];
        });
    }
    public static function recycle(int $tenant,int $user,array $p):void
    {
        Db::transaction(function()use($tenant,$user,$p){$restore=($p['restore']??'')==='1';$id=(int)($p['id']??0);$q=self::documents($tenant,$user)->where('id',$id)->where('delete_time',$restore?'>':'=',0);$row=(clone $q)->lock(true)->find();if(!$row)throw new Invalid('记录不存在或无访问权限');
            if($restore&&self::documents($tenant,$user)->where(['kind'=>$row['kind'],'delete_time'=>0])->count()>=200)throw new Invalid('已达到保存数量限制');
            $q->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]);});
    }
    public static function plans(int $tenant,int $user,int $project,bool $trash=false):array
    {
        $doc=self::owned($tenant,$user,$project);if($doc['kind']!=='project')throw new Invalid('请选择工程');
        $rows=Db::name('oem_clip_plan')->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project])->where('delete_time',$trash?'>':'=',0)->order('id desc')->limit(100)->select()->toArray();
        foreach($rows as &$r){$r['plan']=json_decode($r['plan_json'],true);unset($r['plan_json']);$r['outdated']=(int)$r['revision']!==(int)$doc['revision'];}
        return ['lists'=>$rows,'revision'=>(int)$doc['revision']];
    }
    public static function plan(int $tenant,int $user,array $p):array
    {
        $count=$p['count']??1;if(!is_int($count)||$count<1||$count>100)throw new Invalid('编排数量须为1～100');
        $seed=ClipConfiguration::text($p['seed']??'',80,true);
        $snapshot=self::owned($tenant,$user,(int)($p['id']??0));
        $assets=self::assets($tenant,$user,json_decode($snapshot['config_json'],true),true);
        return Db::transaction(function()use($tenant,$user,$p,$count,$seed,$assets,$snapshot){
            $row=self::owned($tenant,$user,(int)($p['id']??0),true);if($row['kind']!=='project')throw new Invalid('模板须先另存为工程');
            if((string)($p['revision']??'')!==(string)$row['revision'])throw new Invalid('工程已更新，请重新打开后编排');
            if((int)$snapshot['revision']!==(int)$row['revision'])throw new Invalid('素材信息读取期间工程已更新，请重试');
            $project=(int)$row['id'];$revision=(int)$row['revision'];$config=json_decode($row['config_json'],true);self::assets($tenant,$user,$config);
            $q=Db::name('oem_clip_plan')->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project]);
            $existing=(clone $q)->where('delete_time',0)->count();$created=0;$ids=[];
            for($i=0;$i<$count;$i++){
                $plan=(new ClipPlanner($seed.':'.$i))->build($config,$assets);$json=json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);$hash=hash('sha256',$json);
                $old=(clone $q)->where(['revision'=>$revision,'plan_hash'=>$hash])->find();
                if($old){if(!(int)$old['delete_time'])$ids[]=(int)$old['id'];continue;}
                if($existing+$created>=100)throw new Invalid('每个工程最多保留100条编排，请先移除旧编排');
                $ids[]=(int)Db::name('oem_clip_plan')->insertGetId(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project,'revision'=>$revision,'plan_hash'=>$hash,'plan_json'=>$json,'create_time'=>time()]);$created++;
            }
            return ['created'=>$created,'ids'=>array_values(array_unique($ids)),'notice'=>'组合编排已保存，尚未提交云端合成。'];
        });
    }
    public static function removePlans(int $tenant,int $user,array $p):void
    {
        Db::transaction(function()use($tenant,$user,$p){$project=(int)($p['project_id']??0);$doc=self::owned($tenant,$user,$project,true);if($doc['kind']!=='project')throw new Invalid('请选择工程');$ids=ClipConfiguration::ids($p['ids']??[]);if(!$ids)throw new Invalid('请选择编排');$restore=($p['restore']??'')==='1';
            $q=Db::name('oem_clip_plan')->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project])->where('delete_time',$restore?'>':'=',0)->whereIn('id',$ids);
            if(count((clone $q)->lock(true)->column('id'))!==count($ids))throw new Invalid('编排不存在或无访问权限');
            if($restore&&Db::name('oem_clip_plan')->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project,'delete_time'=>0])->count()+count($ids)>100)throw new Invalid('恢复后超过100条编排限制');
            $q->update(['delete_time'=>$restore?0:time()]);});
    }
    public static function render(int $tenant,int $user,array $p):array
    {
        self::owned($tenant,$user,(int)($p['id']??0));
        return ClipCloudJobService::create($tenant,$user,'render',$p);
    }
}
