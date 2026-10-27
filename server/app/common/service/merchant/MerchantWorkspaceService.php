<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use app\common\service\FileService;
use think\facade\Db;

final class MerchantWorkspaceService
{
    public const MATERIAL_KINDS=['video','image','image_text','topic','audio','voiceover','finished_image','copy'];
    private static function query(int $tenant,int $user,string $kind,bool $trash=false)
    {
        if(!in_array($kind,['store','material','seedcard'],true))throw new \InvalidArgumentException('目录类型不正确');
        return Db::name('oem_merchant_'.$kind)->where(['tenant_id'=>$tenant,'user_id'=>$user])->where('delete_time',$trash?'>':'=',0);
    }
    private static function owned(int $tenant,int $user,string $kind,int $id,bool $lock=false):array
    {
        $row=self::query($tenant,$user,$kind)->where('id',$id)->lock($lock)->find();
        if(!$row)throw new \InvalidArgumentException('记录不存在或无访问权限');return $row;
    }
    private static function text(array $p,string $key,int $max,bool $required=false):string
    {
        if(isset($p[$key])&&!is_string($p[$key]))throw new \InvalidArgumentException('文字字段格式不正确');
        $value=trim($p[$key]??'');if(($required&&$value==='')||mb_strlen($value)>$max)throw new \InvalidArgumentException('请检查必填内容和文字长度');return $value;
    }
    public static function files(int $tenant,int $user,array $ids,string $kind):array
    {
        if(count($ids)>($kind==='video'?1:9))throw new \InvalidArgumentException('视频限一个文件，图文最多九张图片');
        $files=[];
        foreach(array_unique($ids) as $id){
            if(!is_int($id)&&!(is_string($id)&&ctype_digit($id)))throw new \InvalidArgumentException('文件标识不正确');
            $audio=in_array($kind,['audio','voiceover'],true);
            $row=Db::name(MerchantAccountTables::name($tenant,'tenant_file'))->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'id'=>(int)$id,'type'=>$audio?30:($kind==='video'?20:10)])->whereNull('delete_time')->find();
            if(!$row)throw new \InvalidArgumentException('只能选择本商家上传的对应类型素材');
            if($audio&&!in_array(strtolower(pathinfo($row['uri'],PATHINFO_EXTENSION)),['mp3','wav','ogg','flac','aac','m4a','opus'],true))throw new \InvalidArgumentException('请选择本商家的音频文件');
            $files[]=['id'=>(int)$row['id'],'name'=>$row['name'],'url'=>FileService::getFileUrlByStorage($row['uri'],$row['storage_scope'],$row['storage_engine'],$row['storage_domain'])];
        }
        return $files;
    }
    public static function listing(int $tenant,int $user,string $kind,array $p):array
    {
        $query=self::query($tenant,$user,$kind,($p['trash']??'')==='1');
        if($kind==='material'){
            $type=(string)($p['kind']??'');if(!in_array($type,self::MATERIAL_KINDS,true))throw new \InvalidArgumentException('素材类型不正确');$query->where('kind',$type);
        }
        $keyword=mb_substr(trim((string)($p['keyword']??'')),0,80);if($keyword!=='')$query->whereLike('name','%'.addcslashes($keyword,'%_\\').'%');
        if($kind!=='store'&&isset($p['store_id'])&&$p['store_id']!=='')$query->where('store_id',(int)$p['store_id']);
        $count=(clone $query)->count();$page=max(1,(int)($p['page']??1));$rows=$query->order('id desc')->page($page,15)->select()->toArray();
        foreach($rows as &$row){
            if($kind!=='store')$row['store_name']=Db::name('oem_merchant_store')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$row['store_id'],'delete_time'=>0])->value('name')?:($row['store_id']?'已移除门店':'通用素材');
            if($kind==='material'){$row['file_ids']=json_decode($row['file_ids'],true)??[];try{$row['files']=self::files($tenant,$user,$row['file_ids'],$row['kind']);}catch(\InvalidArgumentException $e){$row['files']=[];}}
            if($kind==='seedcard'){
                foreach(['material_id'=>'material_name','topic_id'=>'topic_name'] as $id=>$label)$row[$label]=self::query($tenant,$user,'material')->where('id',$row[$id])->value('name')?:'—';
            }
        }
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>15];
    }
    public static function choices(int $tenant,int $user,string $kind,string $keyword=''):array
    {
        if(!in_array($kind,['store','material','topic'],true))throw new \InvalidArgumentException('选项类型不正确');
        $table=$kind==='store'?'store':'material';$query=self::query($tenant,$user,$table);
        if($table==='material')$query->whereIn('kind',$kind==='topic'?['topic']:['video','image_text']);
        if($keyword!=='')$query->whereLike('name','%'.addcslashes(mb_substr($keyword,0,80),'%_\\').'%');
        return $query->field($table==='store'?'id,name':'id,name,store_id,kind')->order('id desc')->limit(50)->select()->toArray();
    }
    public static function save(int $tenant,int $user,string $kind,array $p):int
    {
        return Db::transaction(function()use($tenant,$user,$kind,$p){
            $id=max(0,(int)($p['id']??0));if($id)self::owned($tenant,$user,$kind,$id,true);
            $data=['name'=>self::text($p,'name',$kind==='store'?80:100,true),'update_time'=>time()];
            if($kind==='store'){
                foreach(['address'=>255,'contact'=>50,'mobile'=>32,'business_hours'=>100,'description'=>2000] as $key=>$max)$data[$key]=self::text($p,$key,$max);
                $data['mobile']=MerchantContactPhone::normalize($p['mobile']??'');
                if(!in_array((string)($p['status']??'1'),['0','1'],true))throw new \InvalidArgumentException('门店状态不正确');$data['status']=(int)($p['status']??1);
            }else{
                $store=max(0,(int)($p['store_id']??0));if($store)self::owned($tenant,$user,'store',$store,true);$data['store_id']=$store;
                if($kind==='material'){
                    $type=(string)($p['kind']??'');if(!in_array($type,self::MATERIAL_KINDS,true))throw new \InvalidArgumentException('素材类型不正确');
                    if($id&&self::owned($tenant,$user,$kind,$id)['kind']!==$type)throw new \InvalidArgumentException('不能修改素材类型');
                    $ids=$p['file_ids']??[];if(!is_array($ids))throw new \InvalidArgumentException('素材文件格式不正确');foreach($ids as $file)if(!is_int($file)&&!is_string($file))throw new \InvalidArgumentException('文件标识不正确');
                    if(in_array($type,['topic','copy'],true)&&$ids)throw new \InvalidArgumentException('话题不需要文件');
                    $files=self::files($tenant,$user,$ids,$type);if($type==='video'&&!$files)throw new \InvalidArgumentException('请上传视频文件');
                    if(in_array($type,['image','audio','voiceover','finished_image'],true)&&count($files)!==1)throw new \InvalidArgumentException('请选择一个对应类型的文件');
                    $data+=['kind'=>$type,'content'=>self::text($p,'content',10000,in_array($type,['topic','copy'],true)),'tags'=>self::text($p,'tags',255),'file_ids'=>json_encode(array_column($files,'id'))];
                }elseif($kind==='seedcard'){
                    if(!$store)throw new \InvalidArgumentException('请选择门店');
                    $material=self::owned($tenant,$user,'material',(int)($p['material_id']??0),true);
                    if(!in_array($material['kind'],['video','image_text'],true)||((int)$material['store_id']>0&&(int)$material['store_id']!==$store))throw new \InvalidArgumentException('请选择本门店或通用的视频/图文素材');
                    $topic=max(0,(int)($p['topic_id']??0));if($topic){$row=self::owned($tenant,$user,'material',$topic,true);if($row['kind']!=='topic'||((int)$row['store_id']>0&&(int)$row['store_id']!==$store))throw new \InvalidArgumentException('话题与门店不匹配');}
                    $data+=['material_id'=>$material['id'],'topic_id'=>$topic];
                }else throw new \InvalidArgumentException('目录类型不正确');
            }
            if($id)self::query($tenant,$user,$kind)->where('id',$id)->update($data);
            else $id=(int)Db::name('oem_merchant_'.$kind)->insertGetId($data+['tenant_id'=>$tenant,'user_id'=>$user,'create_time'=>time()]);
            return $id;
        });
    }
    public static function recycle(int $tenant,int $user,string $kind,int $id,bool $restore):void
    {
        $query=self::query($tenant,$user,$kind,$restore)->where('id',$id);
        if(!$query->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]))throw new \InvalidArgumentException('记录不存在或无访问权限');
    }
}
