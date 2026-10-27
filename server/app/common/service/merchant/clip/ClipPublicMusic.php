<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

final class ClipPublicMusic
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    public function search(array $config,array $p):array
    {
        $page=max(1,min(1000,(int)($p['page']??1)));
        $args=['EntityId'=>'Copyright_Music','PageNo'=>$page,'PageSize'=>20,'SortBy'=>'UsageCount:Desc'];
        if(($p['authorized']??'')==='1')$args['Authorized']=true;
        if(!empty($p['media_id']))$args['MediaIds']=ClipFeatures::mediaId($p['media_id']);
        $response=$this->transport->rpc($config,'SearchPublicMediaInfo',$args);
        if(!isset($response['PublicMediaInfos'])||!is_array($response['PublicMediaInfos']))throw new Invalid('版权音乐目录未返回有效结果，请检查云账号权限');
        $rows=[];foreach($response['PublicMediaInfos'] as $row){
            $info=$row['MediaInfo']??[];$basic=$info['MediaBasicInfo']??[];$id=$info['MediaId']??$basic['MediaId']??'';
            if(!is_string($id)||!preg_match('/^icepublic-[a-zA-Z0-9_-]{8,100}$/D',$id))continue;
            $authorized=in_array($row['Authorized']??false,[true,'true',1],true);
            $remaining=$row['RemainingAuthTime']??null;
            if(is_numeric($remaining)&&(float)$remaining<=0)$authorized=false;
            if(($basic['MediaType']??'audio')!=='audio'||!empty($basic['DeletedTime']))$authorized=false;
            $rows[]=['id'=>$id,'name'=>mb_substr((string)($basic['Title']??$id),0,200),'authorized'=>$authorized,'remaining_days'=>is_numeric($remaining)?(float)$remaining:null,'tags'=>mb_substr((string)($basic['MediaTags']??''),0,300)];
        }
        return ['lists'=>$rows,'count'=>(int)($response['TotalCount']??count($rows)),'page'=>$page,'page_size'=>20];
    }
    public function assertAuthorized(array $config,string $id):void
    {
        $rows=$this->search($config,['media_id'=>$id])['lists'];
        foreach($rows as $row)if($row['id']===$id&&$row['authorized'])return;
        throw new Invalid('所选版权音乐未授权或已到期，请更换音乐或由云账号管理员开通资源包');
    }
    public function preview(array $config,string $id):array
    {
        ClipFeatures::mediaId($id);$r=$this->transport->rpc($config,'GetPublicMediaInfo',['MediaId'=>$id]);$info=$r['MediaInfo']??[];
        if(($info['MediaId']??$info['MediaBasicInfo']['MediaId']??'')!==$id)throw new Invalid('音乐详情编号不一致');
        $meta=$info['DynamicMetaData']['Data']??'{}';for($i=0;$i<2&&is_string($meta);$i++)$meta=json_decode($meta,true);
        // AuditionUrl can be an internal oss:// URI. Use only browser-readable preview URLs issued by this API.
        $urls=[is_array($meta)?($meta['AuditionUrl']??''):''];foreach($info['FileInfoList']??[]as $file)$urls[]=$file['FileBasicInfo']['FileUrl']??'';
        foreach($urls as $url){$parts=is_string($url)&&strlen($url)<=8192?parse_url($url):false;
            if($parts&&in_array($parts['scheme']??'',['http','https'],true)&&!empty($parts['host'])&&!isset($parts['user'])&&!isset($parts['pass']))return ['id'=>$id,'preview_url'=>$url,'notice'=>'仅用于试听，合成使用正式版权素材'];
        }
        throw new Invalid('该音乐暂无可用试听地址');
    }
}
