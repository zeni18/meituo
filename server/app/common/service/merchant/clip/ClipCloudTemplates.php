<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

/** Only explicitly published templates can be queried or executed by a merchant. */
final class ClipCloudTemplates
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    public static function ids(array $config):array
    {
        return array_values(array_unique(array_filter(preg_split('/[\s,]+/',trim($config['settings']['template_ids']??'')))));
    }
    public static function schema(array $row):array
    {
        if(!in_array($row['Type']??'',['Timeline','VETemplate'],true)||($row['Status']??'')!=='Available')throw new Invalid('模板尚不可用或类型未支持');
        $raw=$row['ClipsParam']??null;$slots=is_string($raw)?json_decode($raw,true):$raw;
        if(!is_array($slots)||!$slots||count($slots)>20)throw new Invalid('当前支持包含1～20个文字或素材替换位的模板');
        $out=[];foreach($slots as $key=>$type){if(!preg_match('/^[a-zA-Z0-9_-]{1,60}$/D',(string)$key)||!in_array($type,['text','mediaId'],true))throw new Invalid('该模板包含暂不支持的嵌套或高级替换参数');$out[]=['key'=>(string)$key,'type'=>$type==='text'?'text':'material'];}
        return ['id'=>(string)($row['TemplateId']??''),'name'=>mb_substr((string)($row['Name']??''),0,100),'type'=>$row['Type'],'slots'=>$out,'fingerprint'=>hash('sha256',json_encode([$row['Type'],$row['Config']??'',$slots,$row['ModifiedTime']??''],JSON_THROW_ON_ERROR))];
    }
    public function detail(array $config,string $id):array
    {
        if(!in_array($id,self::ids($config),true))throw new Invalid('该云模板未向当前商家开放');
        $row=$this->transport->rpc($config,'GetTemplate',['TemplateId'=>$id])['Template']??[];
        if(($row['TemplateId']??'')!==$id)throw new ClipCloudFailure(true,'模板编号未确认');return self::schema($row);
    }
    public function listing(array $config):array
    {
        $out=[];$unavailable=0;foreach(array_slice(self::ids($config),0,20)as $id){try{$row=$this->detail($config,$id);unset($row['fingerprint']);$out[]=$row;}catch(Invalid){$unavailable++;}}
        return ['lists'=>$out,'unavailable'=>$unavailable,'notice'=>'由管理员审核开放的云端模板。替换文字和本商家素材后提交合成。'];
    }
    public static function values(array $schema,array $values):array
    {
        $keys=array_column($schema['slots'],'key');if(count($keys)!==count($values)||array_diff(array_keys($values),$keys))throw new Invalid('请填写所有模板替换项');
        $clean=[];foreach($schema['slots']as $slot){$v=$values[$slot['key']]??null;
            if($slot['type']==='text')$clean[$slot['key']]=ClipConfiguration::text($v,2000,true);
            else{if((!is_int($v)&&!(is_string($v)&&ctype_digit($v)))||(int)$v<=0)throw new Invalid('请为每个素材位选择本商家素材');$clean[$slot['key']]=(int)$v;}
        }return $clean;
    }
    public function render(array $config,array $input,array $media,string $key,string $token):array
    {
        $schema=$this->detail($config,$input['template_id']);if(!hash_equals($input['fingerprint'],$schema['fingerprint']))throw new Invalid('云端模板已更新，请重新选择并确认内容');
        $values=self::values($schema,$input['values']);foreach($schema['slots']as $slot)if($slot['type']==='material'){$id=$values[$slot['key']];if(!isset($media[$id]))throw new Invalid('模板素材已移除');$values[$slot['key']]=$media[$id]['url'];}
        $output=ClipImsTimeline::output($input['output'],ClipCloudProvider::url($config,$config['settings']['output_bucket'],$key));unset($output['MaxDuration']);
        $r=$this->transport->rpc($config,'SubmitMediaProducingJob',['ClientToken'=>$token,'TemplateId'=>$input['template_id'],'ClipsParam'=>json_encode((object)$values,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'OutputMediaTarget'=>'oss-object','OutputMediaConfig'=>json_encode($output,JSON_THROW_ON_ERROR),'EditingProduceConfig'=>json_encode(['AutoRegisterOutputImsMedia'=>false,'NeedSnapshot'=>false,'NeedSprite'=>false])]);
        if(empty($r['JobId']))throw new ClipCloudFailure(true,'云端模板合成未返回任务编号');return ['provider_id'=>(string)$r['JobId']];
    }
}
