<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use app\common\service\merchant\MerchantAccountTables;
use app\common\service\merchant\MerchantMaterialService;
use think\facade\Db;

final class ClipCloudStorage
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    public static function localPath(array $row):string
    {
        if(($row['storage_engine']??'')!=='local')throw new \InvalidArgumentException('当前云剪辑请使用本地上传的素材；原系统其他存储来源保持原逻辑');
        $base=realpath(root_path().'public/uploads');$path=realpath(root_path().'public/'.ltrim((string)$row['uri'],'/'));
        if(!$base||!$path||!is_file($path)||!str_starts_with(str_replace('\\','/',$path),str_replace('\\','/',$base).'/'))throw new \InvalidArgumentException('素材文件不存在或路径无效');return $path;
    }
    public function stage(int $tenant,int $user,array $assets,array $config,string $token,?callable $heartbeat=null):array
    {
        $media=[];foreach($assets as $id=>$asset){
            $row=Db::name(MerchantAccountTables::name($tenant,'tenant_file'))->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'id'=>$asset['file']['id']])->whereNull('delete_time')->find();if(!$row)throw new \InvalidArgumentException('素材文件不存在或无访问权限');
            $path=self::localPath($row);$extension=strtolower(pathinfo($path,PATHINFO_EXTENSION));if(!preg_match('/^[a-z0-9]{1,8}$/D',$extension))throw new \InvalidArgumentException('素材格式无效');
            // Content hash prevents stale uploads if a file was replaced while a job was queued.
            $key=ClipCloudProvider::key($config,$tenant,$user,$token,'input/'.$id.'-'.substr(hash_file('sha256',$path),0,20).'.'.$extension);
            $this->transport->upload($config,$config['settings']['bucket'],$key,$path);if($heartbeat)$heartbeat();
            $media[$id]=['url'=>ClipCloudProvider::url($config,$config['settings']['bucket'],$key),'kind'=>$asset['kind'],'duration'=>$asset['duration'],'key'=>$key];
        }return $media;
    }
    /** Only a provider-issued speech URL can be downloaded, with DNS pinned to a public IP. */
    public function persistVoice(string $url,int $tenant,int $user,string $token,array $oss):array
    {
        $dir=root_path().'public/uploads/merchant-clip/'.date('Ym').'/';if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new ClipCloudFailure(false,'无法保存配音文件');
        $path=$dir.$token.'.mp3';$tmp=$path.'.part';
        $this->transport->downloadSpeech($url,$tmp);
        $mime=(new \finfo(FILEINFO_MIME_TYPE))->file($tmp);if(!in_array($mime,['audio/mpeg','audio/mp3'],true)){@unlink($tmp);throw new ClipCloudFailure(false,'语音服务返回的文件不是有效MP3音频');}
        $duration=ClipMediaProbe::duration(['storage_engine'=>'local','uri'=>str_replace(root_path().'public/','',$tmp)]);if(!$duration){@unlink($tmp);throw new ClipCloudFailure(false,'配音文件无法解析');}
        if(!rename($tmp,$path))throw new ClipCloudFailure(false,'无法保存配音文件');
        $key=ClipCloudProvider::key($oss,$tenant,$user,$token,'voice.mp3');$this->transport->upload($oss,$oss['settings']['bucket'],$key,$path);
        return Db::transaction(function()use($tenant,$user,$token,$path,$duration){
            $table=MerchantAccountTables::name($tenant,'tenant_file');$uri=str_replace('\\','/',substr($path,strlen(root_path().'public/')));
            $row=Db::name($table)->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'uri'=>$uri])->whereNull('delete_time')->find();
            $fileId=$row?(int)$row['id']:(int)Db::name($table)->insertGetId(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'type'=>30,'name'=>'AI配音-'.substr($token,0,8).'.mp3','uri'=>$uri,'storage_engine'=>'local','storage_scope'=>'tenant','storage_domain'=>'','create_time'=>time(),'update_time'=>time()]);
            $existing=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'kind'=>'voiceover','file_ids'=>json_encode([$fileId]),'delete_time'=>0])->find();
            $id=$existing?(int)$existing['id']:MerchantMaterialService::save($tenant,$user,['kind'=>'voiceover','name'=>'AI配音-'.substr($token,0,8),'file_ids'=>[$fileId]]);
            $files=\app\common\service\merchant\MerchantWorkspaceService::files($tenant,$user,[$fileId],'voiceover');
            return ['material_id'=>$id,'duration'=>$duration,'asset'=>['id'=>$id,'kind'=>'voiceover','name'=>'AI配音-'.substr($token,0,8),'file'=>$files[0],'duration'=>$duration]];
        });
    }
}
