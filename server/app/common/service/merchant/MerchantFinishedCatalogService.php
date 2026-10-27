<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use InvalidArgumentException as Invalid;

/** Catalog metadata over existing owned film libraries and material folders. */
final class MerchantFinishedCatalogService
{
    private static function kind(array $p):string{$k=(string)($p['kind']??'');if(!in_array($k,['video','image_text','topic','finished_image','copy'],true))throw new Invalid('成品库类型不正确');return $k;}
    private static function scope(string $table,int $t,int $u){return MerchantFilmService::scope($table,$t,$u);}
    public static function limit(int $t,int $u,string $kind,int $id):int{return (int)self::scope('oem_finished_library_setting',$t,$u)->where(['kind'=>$kind,'library_id'=>$id])->value('max_uses',0);}
    public static function usage(int $t,int $u):array{
        $rows=Db::name('oem_publish_assignment')->alias('a')->join('oem_publish_task p','p.id=a.task_id AND p.tenant_id=a.tenant_id AND p.user_id=a.user_id')->where(['a.tenant_id'=>$t,'a.user_id'=>$u,'p.state'=>'active'])->field('a.asset_ref,a.copy_text,p.config_json')->select()->toArray();$video=[];$copy=[];
        foreach($rows as $r){$video[$r['asset_ref']]=($video[$r['asset_ref']]??0)+1;$config=json_decode($r['config_json'],true)?:[];$folder=(int)($config['copy_folder_id']??0);if($folder){$key=self::copyKey($folder,$r['copy_text']);$copy[$key]=($copy[$key]??0)+1;}}
        return ['video'=>$video,'image_text'=>$copy];
    }
    public static function copyLimit(int $t,int $u,int $folder):int{$kind=(string)self::scope('oem_material_folder',$t,$u)->where(['id'=>$folder,'delete_time'=>0])->value('kind','');return in_array($kind,['image_text','copy'],true)?self::limit($t,$u,$kind,$folder):0;}
    public static function copyKey(int $folder,string $content):string{return $folder.':'.hash('sha256',$content);}
    /** Called while create() holds the owning merchant row lock. */
    public static function assertCapacity(int $t,int $u,array $prepared,int $copies,int $folder):void{
        $usage=self::usage($t,$u);$plannedVideo=[];$plannedCopy=[];$maxCopy=$folder?self::copyLimit($t,$u,$folder):0;
        foreach($prepared as $r){$ref=$r['asset_ref'];$plannedVideo[$ref]=($plannedVideo[$ref]??0)+$copies;if($maxCopy){$key=self::copyKey($folder,$r['copy_text']);$plannedCopy[$key]=($plannedCopy[$key]??0)+$copies;if(($usage['image_text'][$key]??0)+$plannedCopy[$key]>$maxCopy)throw new Invalid('图文库使用次数不足，请增加内容或调整最多使用次数');}}
        foreach($plannedVideo as $ref=>$count){$lib=(int)self::scope('oem_film_entry',$t,$u)->where('asset_ref',$ref)->value('library_id',0);$max=$lib?self::limit($t,$u,'video',$lib):0;if($max&&($usage['video'][$ref]??0)+$count>$max)throw new Invalid('成片库使用次数不足，请增加视频或调整最多使用次数');}
    }
    /** Per-film distribution facts. "assigned" counts only active tasks (cancelling releases it, as usage() does);
        "sent" counts staff submissions (submitted or approved) whatever happened to the task afterwards. */
    public static function filmUsage(int $t,int $u):array{
        $rows=Db::name('oem_publish_assignment')->alias('a')->join('oem_publish_task p','p.id=a.task_id AND p.tenant_id=a.tenant_id AND p.user_id=a.user_id')->where(['a.tenant_id'=>$t,'a.user_id'=>$u])->field('a.asset_ref,a.platform,a.state,a.submit_time,a.task_id,p.state AS task_state,p.create_time')->select()->toArray();$out=[];
        foreach($rows as $r){$ref=$r['asset_ref'];$o=&$out[$ref];$o??=['assigned'=>0,'sent'=>0,'platforms'=>[],'last_assigned'=>0,'last_sent'=>0,'tasks'=>[]];$pl=&$o['platforms'][$r['platform']];$pl??=['assigned'=>0,'sent'=>0];
            if($r['task_state']==='active'){$o['assigned']++;$pl['assigned']++;$o['tasks'][(int)$r['task_id']]=1;$o['last_assigned']=max($o['last_assigned'],(int)$r['create_time']);}
            if(in_array($r['state'],['submitted','approved'],true)){$o['sent']++;$pl['sent']++;$o['last_sent']=max($o['last_sent'],(int)$r['submit_time']);}
            unset($o,$pl);}
        return $out;
    }
    /** Low-stock line per library, kept in the settings table under its own kind key (no schema change). */
    public static function warnBelow(int $t,int $u,string $kind,int $id):int{$v=self::scope('oem_finished_library_setting',$t,$u)->where(['kind'=>'warn:'.$kind,'library_id'=>$id])->value('max_uses');return $v===null?5:(int)$v;}
    public static function filmState(array $use,int $max):string{if($max&&$use['assigned']>=$max)return 'full';if($use['sent'])return 'sent';if($use['assigned'])return 'assigned';return 'unused';}
    public static function listing(int $t,int $u,array $p):array{
        $kind=self::kind($p);$trash=($p['trash']??'')==='1';$usage=self::usage($t,$u);
        if($kind==='video'){$data=MerchantFilmService::libraries($t,$u,['trash'=>$trash?'1':'0']);$rows=$data['lists'];$unfiled=$data['unfiled'];$contents=[];$covers=[];$coverList=[];foreach(self::scope('oem_film_entry',$t,$u)->select()->toArray() as $e){try{$asset=MerchantFilmService::asset($t,$u,$e['asset_ref']);if(!empty($asset['cover_url'])&&!isset($covers[(int)$e['library_id']]))$covers[(int)$e['library_id']]=$asset['cover_url'];$coverList[(int)$e['library_id']][]=['ref'=>$e['asset_ref'],'cover_url'=>$asset['cover_url'],'video_url'=>$asset['video_url']];$contents[(int)$e['library_id']][]=$e['asset_ref'];}catch(Invalid){}}
            $films=self::filmUsage($t,$u);$warnings=self::scope('oem_finished_library_setting',$t,$u)->where('kind','warn:video')->column('max_uses','library_id');$plans=[];foreach(Db::name('oem_automation_plan')->where(['tenant_id'=>$t,'user_id'=>$u,'state'=>'active'])->field('id,name,config_json,next_at')->select()->toArray() as $plan){$c=json_decode($plan['config_json'],true)?:[];if(!empty($c['library_id']))$plans[(int)$c['library_id']][]=['id'=>(int)$plan['id'],'name'=>$plan['name'],'next_at'=>(int)$plan['next_at']];}}
        else{$rows=self::scope('oem_material_folder',$t,$u)->where('kind',$kind)->where('delete_time',$trash?'>':'=',0)->order('id desc')->select()->toArray();$contents=[];$unfiled=0;$items=Db::name('oem_merchant_material')->alias('m')->leftJoin('oem_material_meta mm','mm.material_id=m.id AND mm.tenant_id=m.tenant_id AND mm.user_id=m.user_id')->where(['m.tenant_id'=>$t,'m.user_id'=>$u,'m.kind'=>$kind,'m.delete_time'=>0])->field('m.id,m.content,mm.folder_id')->select()->toArray();foreach($items as $item)$contents[(int)($item['folder_id']??0)][]=$item;$unfiled=count($contents[0]??[]);}
        $settings=self::scope('oem_finished_library_setting',$t,$u)->where('kind',$kind)->column('max_uses','library_id');$keyword=MerchantFilmService::text($p['keyword']??'',80);$start=self::date($p['start']??'');$end=self::date($p['end']??'');if($start&&$end&&$start>$end)throw new Invalid('开始日期不能晚于结束日期');$out=[];
        foreach($rows as $row){if($keyword!==''&&mb_stripos($row['name'],$keyword)===false)continue;if($start&&$row['create_time']<$start)continue;if($end&&$row['create_time']>=$end+86400)continue;$id=(int)$row['id'];$items=$contents[$id]??[];$max=(int)($settings[$id]??0);$used=0;$usedItems=0;$remaining=0;
            foreach($items as $item){$n=$kind==='video'?($usage['video'][$item]??0):(in_array($kind,['image_text','copy'],true)?($usage['image_text'][self::copyKey($id,$item['content'])]??0):0);$used+=$n;if($n)$usedItems++;if($max)$remaining+=max(0,$max-$n);}
            $extra=[];if($kind==='video'){$states=['unused'=>0,'assigned'=>0,'sent'=>0,'full'=>0];$tasks=[];foreach($items as $ref){$use=$films[$ref]??['assigned'=>0,'sent'=>0,'tasks'=>[]];$states[self::filmState($use,$max)]++;$tasks+=$use['tasks'];}$warn=$warnings[$id]??5;$extra=['states'=>$states,'unused_items'=>$states['unused'],'sent_items'=>$states['sent'],'full_items'=>$states['full'],'warn_below'=>(int)$warn,'level'=>$states['unused']===0?($items?'out':'empty'):($states['unused']<$warn?'low':'ok'),'active_tasks'=>count($tasks),'plans'=>$plans[$id]??[],'covers'=>array_slice($coverList[$id]??[],0,3)];}
            $out[]=$row+['cover_url'=>$covers[$id]??'','count'=>count($items),'max_uses'=>$max,'used'=>$used,'used_items'=>$usedItems,'available'=>count($items)-$usedItems,'total_uses'=>$max?count($items)*$max:null,'remaining_uses'=>$max?$remaining:null]+$extra;
        }
        $size=in_array((int)($p['page_size']??12),[10,12,24,48],true)?(int)($p['page_size']??12):12;$count=count($out);$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/$size))));return ['lists'=>array_slice($out,($page-1)*$size,$size),'count'=>$count,'page'=>$page,'page_size'=>$size,'unfiled'=>$unfiled];
    }
    private static function date(mixed $v):int{if($v==='')return 0;if(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v))throw new Invalid('日期格式不正确');$d=\DateTimeImmutable::createFromFormat('!Y-m-d',$v);if(!$d||$d->format('Y-m-d')!==$v)throw new Invalid('日期不正确');return $d->getTimestamp();}
    public static function save(int $t,int $u,array $p):array{return Db::transaction(function()use($t,$u,$p){$kind=self::kind($p);self::scope('oem_merchant',$t,$u)->lock(true)->find();$max=MerchantFilmService::number($p['max_uses']??0,0,100000);if($kind==='video')$id=MerchantFilmService::saveLibrary($t,$u,$p)['id'];else $id=MerchantMaterialService::saveFolder($t,$u,$p+['parent_id'=>0]);$w=['tenant_id'=>$t,'user_id'=>$u,'kind'=>$kind,'library_id'=>$id];$data=['max_uses'=>$kind==='topic'?0:$max,'update_time'=>time()];if(Db::name('oem_finished_library_setting')->where($w)->find())Db::name('oem_finished_library_setting')->where($w)->update($data);else Db::name('oem_finished_library_setting')->insert($w+$data);if(array_key_exists('warn_below',$p)&&in_array($kind,['video','image_text','copy'],true)){$warn=MerchantFilmService::number($p['warn_below'],0,1000);$ww=$w;$ww['kind']='warn:'.$kind;if(Db::name('oem_finished_library_setting')->where($ww)->find())Db::name('oem_finished_library_setting')->where($ww)->update(['max_uses'=>$warn,'update_time'=>time()]);else Db::name('oem_finished_library_setting')->insert($ww+['max_uses'=>$warn,'update_time'=>time()]);}return ['id'=>$id];});}
    public static function recycle(int $t,int $u,array $p):void{
        $kind=self::kind($p);if($kind==='video'){MerchantFilmService::recycleLibrary($t,$u,$p);return;}if(($p['restore']??'')==='1'){MerchantMaterialService::recycleFolder($t,$u,$p);return;}
        Db::transaction(function()use($t,$u,$p,$kind){$id=MerchantFilmService::number($p['id']??0,1);$q=self::scope('oem_material_folder',$t,$u)->where(['id'=>$id,'kind'=>$kind,'delete_time'=>0]);if(!(clone $q)->lock(true)->find())throw new Invalid('成品库不存在或无访问权限');$active=Db::name('oem_merchant_material')->alias('m')->join('oem_material_meta mm','mm.material_id=m.id AND mm.tenant_id=m.tenant_id AND mm.user_id=m.user_id')->where(['m.tenant_id'=>$t,'m.user_id'=>$u,'m.delete_time'=>0,'mm.folder_id'=>$id])->count();if($active||self::scope('oem_material_folder',$t,$u)->where(['parent_id'=>$id,'delete_time'=>0])->count())throw new Invalid('请先移走库内内容和子文件夹');$q->update(['delete_time'=>time(),'update_time'=>time()]);});
    }
}
