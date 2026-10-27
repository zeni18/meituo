<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use think\facade\Db;
use app\common\service\merchant\{MerchantGeoService as Geo,MerchantAccountTables};
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;

/** A bounded article agent. Each conversation turn is one durable, billed GEO job. */
final class GeoArticleAgent
{
    private static function json(array $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    private static function q(int $t,int $u){return GeoBrandScope::query('oem_geo_job',$t,$u)->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.purpose')) = ?",['article_agent']);}
    public static function quoteToken(array $model,string $unit):string{return hash('sha256',self::json([$model['id'],$model['input_price'],$model['output_price'],$model['input_unit_size'],$model['output_unit_size'],$unit]));}
    private static function root(int $t,int $u,int $id):array
    {
        $r=self::q($t,$u)->where('id',$id)->find();if(!$r||(int)(json_decode($r['payload_json'],true)['agent_session_id']??0)!==0)throw new Invalid('创作会话不存在或无访问权限');return $r;
    }
    private static function turns(int $t,int $u,int $id):array
    {
        return self::q($t,$u)->whereRaw("(id = ? OR JSON_EXTRACT(payload_json, '$.agent_session_id') = ?)",[$id,$id])->order('id')->limit(21)->select()->toArray();
    }
    public static function sessions(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$page=max(1,(int)($p['page']??1));$q=self::q($t,$u)->whereRaw("JSON_EXTRACT(payload_json, '$.agent_session_id') = 0");$count=(clone $q)->count();$out=[];
        foreach($q->order('id desc')->page($page,20)->select()->toArray()as $r){$turns=self::turns($t,$u,(int)$r['id']);$last=end($turns);$out[]=['id'=>(int)$r['id'],'title'=>json_decode($r['payload_json'],true)['subject'],'status'=>$last['status'],'turns'=>count($turns),'update_time'=>$last['update_time']];}
        return ['lists'=>$out,'count'=>$count,'page'=>$page];
    }
    public static function view(int $t,int $u,int $id):array
    {
        Geo::owner($t,$u);$root=self::root($t,$u,$id);$out=[];
        foreach(self::turns($t,$u,$id)as $r){$p=json_decode($r['payload_json'],true);$row=GeoJobs::publicRow($r);$row['instruction']=$p['agent_instruction'];$row['sources']=['brand_name'=>$p['profile']['brand_name']??'','profile_revision'=>$p['profile']['revision']??0,'materials'=>array_map(fn($m)=>array_intersect_key($m,array_flip(['title','source_url','revision'])),$p['materials']??[])];$row['saved']=self::saved($t,$u,$row['result']);$out[]=$row;}
        return ['id'=>$id,'title'=>json_decode($root['payload_json'],true)['subject'],'turns'=>$out,'latest_id'=>(int)end($out)['id']];
    }
    public static function send(int $t,int $u,array $p,?array $studioContext=null):array
    {
        Geo::owner($t,$u);$instruction=Press::text($p['instruction']??'',2000,true);$key=Press::text($p['request_key']??'',80,true);if(!preg_match('/^[A-Za-z0-9_-]{16,80}$/D',$key))throw new Invalid('请求键格式不正确');
        if(($p['accept_charge']??false)!==true)throw new Invalid('请确认本轮模型费用后开始创作');
        $clean=['instruction'=>$instruction,'session_id'=>max(0,(int)($p['session_id']??0)),'expected_turn_id'=>max(0,(int)($p['expected_turn_id']??0)),'model_id'=>Press::text($p['model_id']??'',30,true),'quote_token'=>Press::text($p['quote_token']??'',64,true),'material_ids'=>$p['material_ids']??null,'draft'=>null];
        if(isset($p['draft'])){if(!is_array($p['draft']))throw new Invalid('稿件格式无效');$clean['draft']=['title'=>Press::text($p['draft']['title']??'',255,true),'content'=>Press::text($p['draft']['content']??'',30000,true)];}
        if($studioContext!==null)$clean['studio']=$studioContext;
        $hash=hash('sha256',self::json($clean));
        return Db::transaction(function()use($t,$u,$clean,$instruction,$key,$hash){
            // The same lock as GeoJobs serializes duplicate and concurrent submissions.
            Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u])->lock(true)->find();
            $old=GeoBrandScope::query('oem_geo_job',$t,$u)->where('request_key',$key)->find();
            if($old){$payload=json_decode($old['payload_json'],true);if(!hash_equals($payload['agent_request_hash']??'',$hash))throw new Invalid('同一请求键不能更换创作内容');return ['id'=>(int)$old['id'],'session_id'=>(int)($payload['agent_session_id']?:$old['id']),'replayed'=>true];}
            $options=GeoJobs::options($t,$u);$model=null;foreach($options['models']as $m)if((string)$m['id']===$clean['model_id'])$model=$m;
            if(!$model||!$options['text_available'])throw new Invalid($options['text_notice']);
            if(!hash_equals($model['quote_token'],$clean['quote_token']))throw new Invalid('模型计价已更新，请刷新并重新确认本轮费用');
            $session=$clean['session_id'];$parent=0;$previous=null;$history=[];
            if($session){self::root($t,$u,$session);$turns=self::turns($t,$u,$session);if(count($turns)>=20)throw new Invalid('此会话已达20轮，请开启新的创作');$last=end($turns);$parent=(int)$last['id'];if($clean['expected_turn_id']!==$parent)throw new Invalid('会话已有新版本，请刷新后继续');if(in_array($last['status'],['queued','running','review'],true))throw new Invalid('上一轮尚未完成或费用待核对，请先查看原任务');
                foreach(array_reverse($turns)as $turn){$r=json_decode($turn['result_json'],true);if($turn['status']==='success'&&isset($r['article'])){$previous=$r['article'];break;}}
                foreach(array_slice($turns,-6)as $turn){$a=json_decode($turn['payload_json'],true);$history[]=['instruction'=>$a['agent_instruction'],'status'=>$turn['status']];}
            }elseif($clean['expected_turn_id'])throw new Invalid('新会话不能指定历史版本');
            if($clean['draft']){if(!$previous)throw new Invalid('当前会话尚无可修改稿件');$previous=$clean['draft'];}
            $ids=$clean['material_ids'];if($ids===null)$ids=GeoBrandScope::query('oem_geo_material',$t,$u)->where('delete_time',0)->order('id desc')->limit(5)->column('id');
            $context=['purpose'=>'article_agent','agent_session_id'=>$session,'agent_parent_id'=>$parent,'agent_instruction'=>$instruction,'agent_request_hash'=>$hash,'agent_quote_token'=>$clean['quote_token'],'previous_article'=>$previous,'conversation'=>$history];
            $studio=$clean['studio']??($session?(json_decode($last['payload_json'],true)['studio']??null):null);
            if($studio!==null)$context['studio']=$studio;
            $creation=$studio!==null?array_intersect_key($studio,array_flip(['keyword_group_id','category_id','instruction_id'])):[];
            $job=GeoJobs::enqueue($t,$u,['operation'=>'write','request_key'=>$key,'subject'=>$studio['subject']??mb_substr($instruction,0,120),'model_id'=>$clean['model_id'],'material_ids'=>$ids]+$creation,$context);
            return $job+['session_id'=>$session?:$job['id']];
        });
    }
    public static function article(string $raw):array
    {
        $data=json_decode(preg_replace('/^```(?:json)?\s*|\s*```$/u','',trim($raw)),true);if(!is_array($data)||!is_string($data['title']??null)||!is_string($data['content']??null))throw new Invalid('文章结果需要标题和完整正文');
        $out=['title'=>Press::text($data['title'],255,true),'content'=>Press::text($data['content'],30000,true)];
        foreach(['outline'=>12,'checks'=>10]as $key=>$limit){$items=$data[$key]??[];if(!is_array($items)||!array_is_list($items)||count($items)>$limit)throw new Invalid('文章提纲或核查清单格式无效');$out[$key]=[];foreach($items as $item){if(!is_string($item))throw new Invalid('文章清单格式无效');$out[$key][]=Press::text($item,500,true);}}
        $out['summary']=Press::text($data['summary']??'已按本轮要求完成稿件。',500);return $out;
    }
    private static function saved(int $t,int $u,array $result):?array
    {
        $id=(int)($result['imported_ids'][0]??0);if(!$id)return null;$r=GeoBrandScope::query('aigc_geo_article',$t,$u)->where(['id'=>$id,'delete_time'=>0])->find();if(!$r)return ['id'=>$id,'unavailable'=>true];return ['id'=>$id,'title'=>$r['title'],'content'=>$r['content'],'expected_update'=>$r['update_time'],'expected_hash'=>hash('sha256',self::json($r))];
    }
    public static function save(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$title=Press::text($p['title']??'',255,true);$content=Press::text($p['content']??'',30000,true);$id=(int)($p['job_id']??0);
        return Db::transaction(function()use($t,$u,$p,$title,$content,$id){$job=self::q($t,$u)->where('id',$id)->lock(true)->find();if(!$job||$job['status']!=='success')throw new Invalid('稿件尚未完成或无访问权限');$result=json_decode($job['result_json'],true);$saved=self::saved($t,$u,$result);$new=!$saved;
            if($saved&&($saved['unavailable']??false))throw new Invalid('已入库文章不可用，请在文章库处理');
            if(!$saved){GeoJobs::import($t,$u,$id);$result=json_decode(self::q($t,$u)->where('id',$id)->value('result_json'),true);$saved=self::saved($t,$u,$result);}
            if($saved['title']!==$title||$saved['content']!==$content){$ctx=GeoWorkspace::importContext($t,$u,json_decode($job['payload_json'],true));GeoWorkspace::contentSave($t,$u,['kind'=>'articles','id'=>$saved['id'],'title'=>$title,'content'=>$content,'expected_update'=>$new?$saved['expected_update']:($p['expected_update']??-1),'expected_hash'=>$new?$saved['expected_hash']:($p['expected_hash']??'')]+$ctx);}
            return self::saved($t,$u,$result);
        });
    }
}
