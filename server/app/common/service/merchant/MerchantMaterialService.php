<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use app\common\service\UploadService;
use app\common\enum\FileEnum;
use InvalidArgumentException as Invalid;

/** Merchant-owned media directory. Every identifier is resolved inside the current owner. */
final class MerchantMaterialService
{
    private static function ownedQuery(string $table,int $tenant,int $user,bool $trash=false){return Db::name('oem_material_'.$table)->where(['tenant_id'=>$tenant,'user_id'=>$user])->where('delete_time',$trash?'>':'=',0);}
    private static function kind(array $p):string{$kind=(string)($p['kind']??'');if(!in_array($kind,MerchantWorkspaceService::MATERIAL_KINDS,true))throw new Invalid('素材类型不正确');return $kind;}
    private static function text(array $p,string $key,int $max):string{if(!isset($p[$key])||!is_string($p[$key])||trim($p[$key])===''||mb_strlen(trim($p[$key]))>$max)throw new Invalid('请检查名称及长度');return trim($p[$key]);}
    private static function ids(mixed $ids):array{if(!is_array($ids)||count($ids)>100)throw new Invalid('每次最多选择100项');foreach($ids as $id)if((!is_int($id)&&!(is_string($id)&&ctype_digit($id)))||(int)$id<=0)throw new Invalid('记录标识不正确');return array_values(array_unique(array_map('intval',$ids)));}
    private static function folder(int $tenant,int $user,int $id,string $kind):void{if($id&&!self::ownedQuery('folder',$tenant,$user)->where(['id'=>$id,'kind'=>$kind])->lock(true)->find())throw new Invalid('文件夹不存在或无访问权限');}
    private static function labelIds(int $tenant,int $user,mixed $ids):array{$ids=self::ids($ids);if($ids&&self::ownedQuery('label',$tenant,$user)->whereIn('id',$ids)->lock(true)->count()!==count($ids))throw new Invalid('标签不存在或无访问权限');return $ids;}
    private static function meta(int $tenant,int $user,int $id,array $patch):void{
        $where=['tenant_id'=>$tenant,'user_id'=>$user,'material_id'=>$id];
        if(Db::name('oem_material_meta')->where($where)->find())Db::name('oem_material_meta')->where($where)->update($patch+['update_time'=>time()]);
        else Db::name('oem_material_meta')->insert($patch+$where+['folder_id'=>0,'label_ids'=>'[]','update_time'=>time()]);
    }
    private static function usedIds(int $tenant,int $user):array{$rows=Db::name('oem_merchant_seedcard')->where(['tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->field('material_id,topic_id')->select()->toArray();return array_values(array_unique(array_filter(array_merge(array_column($rows,'material_id'),array_column($rows,'topic_id')))));}
    private static function base(int $tenant,int $user,string $kind,bool $trash=false){return Db::name('oem_merchant_material')->alias('m')->leftJoin('oem_material_meta mm','mm.material_id=m.id AND mm.tenant_id=m.tenant_id AND mm.user_id=m.user_id')->where(['m.tenant_id'=>$tenant,'m.user_id'=>$user,'m.kind'=>$kind])->where('m.delete_time',$trash?'>':'=',0);}
    public static function listing(int $tenant,int $user,array $p):array{
        $kind=self::kind($p);$q=self::base($tenant,$user,$kind,($p['trash']??'')==='1');
        if(isset($p['folder_id'])&&$p['folder_id']!==''){$folder=max(0,(int)$p['folder_id']);self::folder($tenant,$user,$folder,$kind);if($folder)$q->where('mm.folder_id',$folder);else $q->where(function($q){$q->where('mm.folder_id',0)->whereOr('mm.folder_id',null);});}
        $keyword=mb_substr(trim((string)($p['keyword']??'')),0,80);if($keyword!=='')$q->whereLike('m.name','%'.addcslashes($keyword,'%_\\').'%');
        $used=self::usedIds($tenant,$user);if(($p['usage']??'')==='used')$q->whereIn('m.id',$used?:[0]);elseif(($p['usage']??'')==='unused')$q->whereNotIn('m.id',$used?:[0]);
        $label=(int)($p['label_id']??0);if($label){self::labelIds($tenant,$user,[$label]);$q->whereRaw('JSON_CONTAINS(mm.label_ids, ?)',[json_encode($label)]);}
        $count=(clone $q)->count();$requested=(int)($p['page_size']??24);$size=in_array($requested,[24,48,72],true)?$requested:24;$page=max(1,(int)($p['page']??1));
        $order=($p['sort']??'')==='name'?'m.name asc,m.id desc':'m.id desc';$rows=$q->field('m.*,mm.folder_id,mm.label_ids')->order($order)->page($page,$size)->select()->toArray();$labels=array_column(self::labels($tenant,$user),'name','id');
        foreach($rows as &$row){$row['folder_id']=(int)($row['folder_id']??0);$row['label_ids']=json_decode($row['label_ids']??'[]',true)?:[];$row['labels']=array_values(array_intersect_key($labels,array_flip($row['label_ids'])));$row['used']=in_array($row['id'],$used);$row['file_ids']=json_decode($row['file_ids'],true)?:[];try{$row['files']=MerchantWorkspaceService::files($tenant,$user,$row['file_ids'],$kind);}catch(Invalid $e){$row['files']=[];}}
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>$size];
    }
    /** Count-only metadata never resolves uploaded files or reads full material rows. */
    public static function counts(int $tenant,int $user):array
    {
        if($tenant<=0||$user<=0)throw new Invalid('请先登录');
        $counts=array_fill_keys(MerchantWorkspaceService::MATERIAL_KINDS,0);
        $rows=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->field('kind,COUNT(*) AS total')->group('kind')->select()->toArray();
        foreach($rows as $row)if(array_key_exists($row['kind'],$counts))$counts[$row['kind']]=(int)$row['total'];
        return ['counts'=>$counts];
    }
    public static function metadata(int $tenant,int $user,array $p):array
    {
        $kind=self::kind($p);
        return self::counts($tenant,$user)+['folders'=>self::folders($tenant,$user,$p),'labels'=>self::labels($tenant,$user),'trash_count'=>(int)Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'kind'=>$kind])->where('delete_time','>',0)->count()];
    }
    public static function folders(int $tenant,int $user,array $p):array{
        $kind=self::kind($p);$rows=self::ownedQuery('folder',$tenant,$user)->where('kind',$kind)->order(($p['sort']??'')==='name'?'name asc,id asc':'sort desc,id asc')->select()->toArray();
        $counts=self::base($tenant,$user,$kind)->field('COALESCE(mm.folder_id,0) AS folder_id,COUNT(*) AS total')->group('COALESCE(mm.folder_id,0)')->select()->toArray();$map=array_column($counts,'total','folder_id');foreach($rows as &$row)$row['count']=(int)($map[$row['id']]??0);return ['lists'=>$rows,'total'=>array_sum($map),'unfiled'=>(int)($map[0]??0)];
    }
    public static function saveFolder(int $tenant,int $user,array $p):int{
        return Db::transaction(function()use($tenant,$user,$p){$kind=self::kind($p);$id=max(0,(int)($p['id']??0));$parent=max(0,(int)($p['parent_id']??0));$name=self::text($p,'name',60);if($id)self::folder($tenant,$user,$id,$kind);if($parent)self::folder($tenant,$user,$parent,$kind);
            $folders=self::ownedQuery('folder',$tenant,$user)->where('kind',$kind)->lock(true)->select()->toArray();if(!$id&&count($folders)>=300)throw new Invalid('每种素材最多300个文件夹');$parents=array_column($folders,'parent_id','id');$parents[$id?:-1]=$parent;
            foreach(array_keys($parents) as $start){$seen=[];$cursor=$start;while($cursor){if(isset($seen[$cursor])||count($seen)>=5)throw new Invalid('文件夹不能循环嵌套，最多支持5层');$seen[$cursor]=true;$cursor=(int)($parents[$cursor]??0);}}
            if(self::ownedQuery('folder',$tenant,$user)->where(['kind'=>$kind,'parent_id'=>$parent,'name'=>$name])->where('id','<>',$id)->count())throw new Invalid('同一分组下文件夹名称重复');
            $data=['name'=>$name,'parent_id'=>$parent,'sort'=>max(-100000,min(100000,(int)($p['sort']??0))),'update_time'=>time()];if($id)self::ownedQuery('folder',$tenant,$user)->where('id',$id)->update($data);else $id=(int)Db::name('oem_material_folder')->insertGetId($data+['tenant_id'=>$tenant,'user_id'=>$user,'kind'=>$kind,'create_time'=>time()]);return $id;
        });
    }
    public static function recycleFolder(int $tenant,int $user,array $p):void{
        Db::transaction(function()use($tenant,$user,$p){$kind=self::kind($p);$id=(int)($p['id']??0);$restore=($p['restore']??'')==='1';$row=self::ownedQuery('folder',$tenant,$user,$restore)->where(['id'=>$id,'kind'=>$kind])->lock(true)->find();if(!$row)throw new Invalid('文件夹不存在');
            if(!$restore&&(self::ownedQuery('folder',$tenant,$user)->where('parent_id',$id)->count()||Db::name('oem_material_meta')->where(['tenant_id'=>$tenant,'user_id'=>$user,'folder_id'=>$id])->count()))throw new Invalid('请先移走文件夹内的素材和子文件夹');
            if($restore){self::folder($tenant,$user,(int)$row['parent_id'],$kind);if(self::ownedQuery('folder',$tenant,$user)->where(['kind'=>$kind,'parent_id'=>$row['parent_id'],'name'=>$row['name']])->count())throw new Invalid('同名文件夹已存在');}
            self::ownedQuery('folder',$tenant,$user,$restore)->where('id',$id)->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]);
        });
    }
    public static function reorderFolders(int $tenant,int $user,array $p):void{
        $kind=self::kind($p);$raw=$p['ids']??null;
        if(!is_array($raw)||!array_is_list($raw)||count($raw)>300)throw new Invalid('文件夹排序参数不正确');
        $ids=[];foreach($raw as $id){if(!(is_int($id)||(is_string($id)&&ctype_digit($id)))||(int)$id<=0)throw new Invalid('文件夹排序参数不正确');$ids[]=(int)$id;}
        if(count(array_unique($ids))!==count($ids))throw new Invalid('文件夹排序不能包含重复项');
        Db::transaction(function()use($tenant,$user,$kind,$ids){
            $rows=self::ownedQuery('folder',$tenant,$user)->where('kind',$kind)->order('id')->lock(true)->select()->toArray();
            $actual=array_map('intval',array_column($rows,'id'));$requested=$ids;sort($actual);sort($requested);
            if($actual!==$requested)throw new Invalid('文件夹列表已变动或无访问权限，请刷新后重新排序');
            $total=count($ids);foreach($ids as $index=>$id)self::ownedQuery('folder',$tenant,$user)->where(['kind'=>$kind,'id'=>$id])->update(['sort'=>$total-$index,'update_time'=>time()]);
        });
    }
    public static function labels(int $tenant,int $user):array{return self::ownedQuery('label',$tenant,$user)->field('id,name,color')->order('id desc')->select()->toArray();}
    public static function saveLabel(int $tenant,int $user,array $p):int{
        return Db::transaction(function()use($tenant,$user,$p){$id=(int)($p['id']??0);$name=self::text($p,'name',30);$color=(string)($p['color']??'mint');if(!in_array($color,['mint','blue','amber','rose'],true))throw new Invalid('标签颜色不正确');
            if($id&&!self::ownedQuery('label',$tenant,$user)->where('id',$id)->lock(true)->find())throw new Invalid('标签不存在');if(self::ownedQuery('label',$tenant,$user)->where('name',$name)->where('id','<>',$id)->count())throw new Invalid('标签名称重复');if(!$id&&self::ownedQuery('label',$tenant,$user)->count()>=100)throw new Invalid('最多100个标签');
            $data=['name'=>$name,'color'=>$color,'update_time'=>time()];if($id)self::ownedQuery('label',$tenant,$user)->where('id',$id)->update($data);else $id=(int)Db::name('oem_material_label')->insertGetId($data+['tenant_id'=>$tenant,'user_id'=>$user,'create_time'=>time()]);return $id;
        });
    }
    public static function removeLabel(int $tenant,int $user,int $id):void{Db::transaction(function()use($tenant,$user,$id){self::labelIds($tenant,$user,[$id]);if(Db::name('oem_material_meta')->where(['tenant_id'=>$tenant,'user_id'=>$user])->whereRaw('JSON_CONTAINS(label_ids, ?)',[json_encode($id)])->count())throw new Invalid('标签仍被素材使用，请先取消关联');self::ownedQuery('label',$tenant,$user)->where('id',$id)->update(['delete_time'=>time(),'update_time'=>time()]);});}
    public static function save(int $tenant,int $user,array $p):int{
        return Db::transaction(function()use($tenant,$user,$p){$kind=self::kind($p);$folder=max(0,(int)($p['folder_id']??0));self::folder($tenant,$user,$folder,$kind);$labels=self::labelIds($tenant,$user,$p['label_ids']??[]);$id=MerchantWorkspaceService::save($tenant,$user,'material',$p);self::meta($tenant,$user,$id,['folder_id'=>$folder,'label_ids'=>json_encode($labels)]);return $id;});
    }
    public static function batch(int $tenant,int $user,array $p):void{
        Db::transaction(function()use($tenant,$user,$p){$ids=self::ids($p['ids']??[]);if(!$ids)throw new Invalid('请先选择素材');$kind=self::kind($p);$action=(string)($p['action']??'');$restore=$action==='restore';$rows=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'kind'=>$kind])->where('delete_time',$restore?'>':'=',0)->whereIn('id',$ids)->lock(true)->select()->toArray();if(count($rows)!==count($ids))throw new Invalid('选中的素材不存在或无访问权限');
            if(in_array($action,['trash','restore'],true)){Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user])->whereIn('id',$ids)->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]);return;}
            if($action==='move'){$folder=max(0,(int)($p['folder_id']??0));self::folder($tenant,$user,$folder,$kind);$patch=['folder_id'=>$folder];}elseif($action==='label')$patch=['label_ids'=>json_encode(self::labelIds($tenant,$user,$p['label_ids']??[]))];else throw new Invalid('批量操作不正确');
            foreach($ids as $id)self::meta($tenant,$user,$id,$patch);
        });
    }
    public static function upload(int $tenant,int $user,$request):array{
        $kind=self::kind($request->post());if(!in_array($kind,['video','image','audio','voiceover'],true))throw new Invalid('该类型请使用内容编辑器');$folder=(int)$request->post('folder_id',0);self::folder($tenant,$user,max(0,$folder),$kind);
        $file=$request->file('file');$limit=$kind==='image'?20:($kind==='video'?100:50);if(!$file||$file->getSize()>$limit*1024*1024)throw new Invalid('文件不能超过'.$limit.'MB');$ext=strtolower($file->getOriginalExtension());$mime=(new \finfo(FILEINFO_MIME_TYPE))->file($file->getPathname());
        if($kind==='image'){$valid=in_array($ext,['jpg','jpeg','png','webp','gif'],true)&&str_starts_with($mime,'image/')&&@getimagesize($file->getPathname());}
        elseif($kind==='video')$valid=in_array($ext,['mp4','mov'],true)&&str_starts_with($mime,'video/');
        else $valid=in_array($ext,['mp3','wav','ogg','flac','aac','m4a','opus'],true)&&(str_starts_with($mime,'audio/')||in_array($mime,['application/ogg','video/mp4','video/ogg'],true));
        if(!$valid)throw new Invalid('文件内容与支持的素材格式不匹配');
        if($kind==='image')$uploaded=UploadService::image(0,$user,FileEnum::SOURCE_USER);elseif($kind==='video')$uploaded=UploadService::video(0,$user,FileEnum::SOURCE_USER);else $uploaded=UploadService::file(0,$user,FileEnum::SOURCE_USER,'uploads/merchant-audio');
        if($kind==='image'&&(string)$request->post('attach_only','')==='1')return ['file'=>$uploaded];
        $name=mb_substr(pathinfo($file->getOriginalName(),PATHINFO_FILENAME),0,100)?:'未命名素材';$id=self::save($tenant,$user,['name'=>$name,'kind'=>$kind,'folder_id'=>$folder,'file_ids'=>[(int)$uploaded['id']]]);return ['id'=>$id,'file'=>$uploaded];
    }
}
