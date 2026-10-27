<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\service\merchant\{MerchantGeoService as Geo,MerchantAccountTables};
use app\common\service\press\PressService as Press;
use InvalidArgumentException as Invalid;

/** Structured single-page authoring, sharing the original durable queue and wallet. */
final class GeoCreationStudio
{
    public static function settings(int $t,int $u,array $p):array
    {
        $type=Press::text($p['article_type']??'选购指南',30,true);if(!in_array($type,['客户问答','选购指南','产品解读','对比分析','真实案例','新闻软文'],true))throw new Invalid('文章类型无效');
        $words=$p['words']??1000;if(!in_array($words,[600,1000,1500],true))throw new Invalid('请选择600、1000或1500字');
        $level=Press::text($p['brand_level']??'自然融入',30,true);if(!in_array($level,['轻度提及','自然融入','重点介绍'],true))throw new Invalid('品牌介绍要求无效');
        $out=['article_type'=>$type,'words'=>$words,'brand_level'=>$level,'audience'=>Press::text($p['audience']??'',200),'tone'=>Press::text($p['tone']??'专业、客观、便于核查',120),'requirements'=>Press::text($p['requirements']??'',1500),'reference'=>Press::text($p['reference']??'',30000),'related_questions'=>[]]+GeoWorkspace::creationContext($t,$u,$p);
        $questions=$p['related_questions']??[];if(!is_array($questions)||!array_is_list($questions)||count($questions)>10)throw new Invalid('一个选题最多关联10个问题');foreach($questions as $q)$out['related_questions'][]=Press::text($q,500,true);$out['related_questions']=array_values(array_unique($out['related_questions']));return $out;
    }
    public static function generate(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);$mode=Press::text($p['mode']??'write',20,true);if(!in_array($mode,['write','replicate','batch'],true))throw new Invalid('创作模式无效');
        $subjects=$p['subjects']??[];if(!is_array($subjects)||!array_is_list($subjects)||!$subjects||count($subjects)>3)throw new Invalid('每批选择1至3个选题，沿用当前任务队列上限');
        $subjects=array_map(fn($s)=>Press::text($s,500,true),$subjects);if(count(array_unique($subjects))!==count($subjects))throw new Invalid('本批次选题重复，请合并后提交');if($mode!=='batch'&&count($subjects)!==1)throw new Invalid('当前模式每次生成一篇文章');
        $settings=self::settings($t,$u,$p);if($mode==='replicate'&&$settings['reference']==='')throw new Invalid('请粘贴需要改写的参考原文');$settings['mode']=$mode;$settings['batch_fingerprint']=hash('sha256',json_encode($subjects,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $key=Press::text($p['request_key']??'',72,true);if(!preg_match('/^[A-Za-z0-9_-]{16,72}$/D',$key))throw new Invalid('请求键格式不正确');
        // All-or-nothing enqueue: an invalid resource or full queue cannot leave a partial batch.
        return Db::transaction(function()use($t,$u,$p,$subjects,$settings,$key){$jobs=[];foreach($subjects as $i=>$subject){$instruction=($settings['mode']==='replicate'?'结合品牌事实重新创作：':'围绕客户需求创作：').$subject;$r=GeoArticleAgent::send($t,$u,['instruction'=>$instruction,'request_key'=>$key.'_'.$i,'model_id'=>$p['model_id']??'','quote_token'=>$p['quote_token']??'','accept_charge'=>$p['accept_charge']??false,'material_ids'=>$p['material_ids']??[]],$settings+['subject'=>$subject]);$jobs[]=$r+['subject'=>$subject];}return ['jobs'=>$jobs];});
    }
    public static function keywords(int $t,int $u,array $p):array
    {
        Geo::owner($t,$u);if(($p['accept_charge']??false)!==true)throw new Invalid('请确认文本模型费用');$count=$p['question_count']??20;if(!in_array($count,[10,20,30],true))throw new Invalid('请选择10、20或30个问题');
        $model=Press::text($p['model_id']??'',30,true);$token=Press::text($p['quote_token']??'',64,true);$subject=Press::text($p['subject']??'',500,true);
        $key=Press::text($p['request_key']??'',80,true);if(!preg_match('/^[A-Za-z0-9_-]{16,80}$/D',$key))throw new Invalid('请求键格式不正确');
        $context=['purpose'=>'studio_keywords','question_count'=>$count,'keyword_quote_token'=>$token];
        // Accepted retries use GeoJobs' immutable payload hash even if current prices changed.
        $exists=GeoBrandScope::query('oem_geo_job',$t,$u)->where('request_key',$key)->find();
        if(!$exists){$matched=null;foreach(GeoJobs::options($t,$u)['models']as $m)if((string)$m['id']===$model)$matched=$m;if(!$matched||!hash_equals($matched['quote_token'],$token))throw new Invalid('文本能力或计价已更新，请刷新后确认费用');}
        return GeoJobs::enqueue($t,$u,['operation'=>'keywords','subject'=>$subject,'request_key'=>$key,'model_id'=>$model,'keyword_group_id'=>$p['keyword_group_id']??0],$context);
    }
    public static function saveTopics(int $t,int $u,array $p,bool $perList=false):array
    {
        Geo::owner($t,$u);$rows=$p['topics']??[];if(!is_array($rows)||!array_is_list($rows)||!$rows||count($rows)>100)throw new Invalid('每次保存1至100个选题');$ctx=GeoWorkspace::creationContext($t,$u,['keyword_group_id'=>$p['keyword_group_id']??0]);
        return Db::transaction(function()use($t,$u,$rows,$ctx,$perList){Db::name(MerchantAccountTables::name($t,'user'))->where(['tenant_id'=>$t,'id'=>$u])->lock(true)->find();$ids=[];foreach($rows as $row){if(!is_array($row))throw new Invalid('选题格式无效');$text=Press::text($row['text']??'',500,true);$query=GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where(['question'=>$text,'delete_time'=>0]);if($perList)$query->whereRaw("COALESCE(JSON_EXTRACT(metadata_json, '$.keyword_group_id'),0) = ?",[$ctx['keyword_group_id']]);$old=$query->find();if($old){$ids[]=(int)$old['id'];continue;}$jobId=max(0,(int)($row['source_job_id']??0));$intent='内容选题';
            if($jobId){$job=GeoBrandScope::query('oem_geo_job',$t,$u)->where(['id'=>$jobId,'operation'=>'keywords','status'=>'success'])->find();if(!$job)throw new Invalid('拓词来源任务不可用或无权限');$result=json_decode($job['result_json'],true);$questions=$result['questions']??GeoJobs::diagnosisQuestions($result['content']??'');$match=null;foreach($questions as $q)if($q['question']===$text)$match=$q;if(!$match)throw new Invalid('选题与原拓词结果不一致，请作为手工选题保存');$intent=$match['intent'];}
            $new=Geo::save($t,$u,['kind'=>'questions','question'=>$text,'intent'=>$intent]);$meta=['keyword_group_id'=>$ctx['keyword_group_id']];if($jobId)$meta['geo_job_id']=$jobId;GeoBrandScope::query('aigc_geo_keyword',$t,$u)->where('id',$new['id'])->update(['source'=>$jobId?'ai_generated':'manual','metadata_json'=>json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$ids[]=$new['id'];}return ['ids'=>array_values(array_unique($ids))];});
    }
}
