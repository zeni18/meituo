<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use app\common\service\app\AppAccessService;
use app\common\service\FileService;
use think\facade\Db;
use app\common\model\user\UserAccountLog;
use app\common\enum\user\AccountLogEnum;

/** A read-only snapshot: opening the workbench never polls generation providers. */
final class MerchantWorkbenchService
{
    private const APPS = ['aigc_product_image','aigc_image','aigc_video','aigc_digital_human','aigc_pic_lipsync','image_human','aigc_product_suite','aigc_model_wear','aigc_fitting','aigc_product_promo_video'];

    public static function summary(int $tenant,int $user):array
    {
        if($tenant<=0||$user<=0)throw new \InvalidArgumentException('请先登录');
        $tasks=[];$unavailable=[];
        $today=new \DateTimeImmutable('today',new \DateTimeZone('Asia/Shanghai'));
        $start=$today->modify('-13 days')->getTimestamp();$end=$today->modify('+1 day')->getTimestamp();$daily=array_fill(0,14,0);
        foreach(self::APPS as $app){
            $tasks[$app]=['lists'=>[]];
            // Keep the same application and membership gate as each task endpoint.
            if(AppAccessService::assertTenantCanUse($tenant,$app,$user,true,false))continue;
            try{
                $query=Db::name($app.'_task');$columns=array_keys($query->getFields());
                $fields=array_values(array_intersect(['id','title','name','prompt','script_text','status','task_status','state','progress','create_time','image_task_id','image_task_ids','image_uri','video_uri','cover_uri','storage_scope','storage_engine','storage_domain'],$columns));
                $query->where(['tenant_id'=>$tenant,'user_id'=>$user]);
                if(in_array('delete_time',$columns,true))$query->where('delete_time',0);
                $buckets=(clone $query)->where('create_time','>=',$start)->where('create_time','<',$end)->fieldRaw('FLOOR((create_time - '.$start.') / 86400) AS day_index,COUNT(*) AS total')->group('day_index')->select()->toArray();
                foreach($buckets as $bucket){$index=(int)$bucket['day_index'];if($index>=0&&$index<14)$daily[$index]+=(int)$bucket['total'];}
                $rows=$query->field($fields)->order('id','desc')->limit(30)->select()->toArray();
                if($rows){
                    $resultTable=$app==='aigc_fitting'?'aigc_image_result':$app.'_result';
                    $idsByTask=[];$resultIds=[];
                    foreach($rows as $row){$ids=$app==='aigc_fitting'?array_values(array_unique(array_filter(array_map('intval',array_merge([(int)($row['image_task_id']??0)],json_decode((string)($row['image_task_ids']??'[]'),true)?:[]))))):[(int)$row['id']];$idsByTask[(int)$row['id']]=$ids;$resultIds=array_merge($resultIds,$ids);}
                    if($app==='aigc_fitting')$resultIds=Db::name('aigc_image_task')->where(['tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->whereIn('id',$resultIds?:[0])->column('id');
                    $resultColumns=array_keys(Db::name($resultTable)->getFields());
                    $resultFields=array_values(array_intersect(['task_id','image_uri','video_uri','cover_uri','storage_scope','storage_engine','storage_domain'],$resultColumns));
                    $resultQuery=Db::name($resultTable)->where('tenant_id',$tenant)->whereIn('task_id',$resultIds?:[0]);
                    if(in_array('user_id',$resultColumns,true))$resultQuery->where('user_id',$user);
                    if(in_array('delete_time',$resultColumns,true))$resultQuery->where('delete_time',0);
                    $results=$resultQuery->field($resultFields)->order('id','asc')->select()->toArray();
                    $byTask=[];foreach($results as $result)$byTask[(int)$result['task_id']][]=self::media($result);
                    foreach($rows as &$row){$row=self::media($row);$row['results']=[];foreach($idsByTask[(int)$row['id']] as $id)$row['results']=array_merge($row['results'],$byTask[$id]??[]);unset($row['image_task_id'],$row['image_task_ids']);}unset($row);
                }
                $tasks[$app]=['lists'=>$rows];
            }catch(\Throwable $e){
                $unavailable[]=$app;
                error_log('Workbench read '.$app.': '.$e->getMessage());
            }
        }
        $history=[];foreach($daily as $index=>$count)$history[]=['date'=>$today->modify(($index-13).' days')->format('Y-n-j'),'count'=>$count];
        $logs=UserAccountLog::where(['tenant_id'=>$tenant,'user_id'=>$user])->whereIn('change_type',AccountLogEnum::getUserMoneyChangeType())->where('action',AccountLogEnum::DEC);
        $consume=['month'=>(float)(clone $logs)->where('create_time','>=',$today->modify('first day of this month')->getTimestamp())->sum('change_amount'),'total'=>(float)(clone $logs)->sum('change_amount')];
        return ['task_lists'=>$tasks,'task_daily'=>$unavailable?null:$history,'consumption'=>$consume,'material_counts'=>MerchantMaterialService::counts($tenant,$user)['counts'],'unavailable'=>$unavailable];
    }
    private static function media(array $row):array
    {
        foreach(['image','video','cover'] as $kind){
            $uri=(string)($row[$kind.'_uri']??'');
            if($uri!=='')$row[$kind.'_url']=FileService::getFileUrlByStorage($uri,$row['storage_scope']??'',$row['storage_engine']??'',$row['storage_domain']??'');
            unset($row[$kind.'_uri']);
        }
        unset($row['storage_scope'],$row['storage_engine'],$row['storage_domain']);
        return $row;
    }
}
