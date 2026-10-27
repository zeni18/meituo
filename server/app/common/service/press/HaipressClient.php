<?php
declare(strict_types=1);
namespace app\common\service\press;
use think\facade\Db;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;

final class HaipressClient
{
    public function __construct(private readonly HaipressTransport $transport=new HaipressHttpTransport()) {}
    private static function accepted(array $r, bool $create=false): array
    {
        if ((string)$r['code']==='200' || ($create && ($r['msgen']??'')==='orderExist')) return $r;
        $code=(string)($r['msgen']??'unknown');
        $known=['tokenNull'=>'访问凭证缺失','tokenError'=>'访问凭证无效','tokenExpired'=>'访问凭证过期','authorityError'=>'接口权限未开通','paramNull'=>'发稿参数不完整','userError'=>'供方账号异常','resourcesError'=>'媒体已下架','priceError'=>'媒体价格已变更，请重新报价','priceTypeError'=>'媒体不支持该价格类别','depositLess'=>'海讯社预存余额不足','keyError'=>'供方密钥无效','tokenException'=>'供方账号需核查','orderNull'=>'供方订单不存在','flagError'=>'供方不接受该操作','stateError'=>'供方订单状态已变更'];
        throw new HaipressFailure(!isset($known[$code]),$code,$known[$code]??'海讯社业务响应未识别，请核查原订单');
    }
    private function access(int $revision, bool $inspection = false): string
    {
        return Db::transaction(function() use($revision,$inspection) {
            $r=Db::name('press_config')->where('id',1)->lock(true)->find();
            if (!$r || (!$inspection && !(int)$r['enabled']) || (int)$r['revision']!==$revision) throw new \InvalidArgumentException('海讯社配置已变更，请刷新');
            if ((int)$r['access_expiry']>time()+120) return Vault::open($r['access_cipher'],0,'haipress_access')['access'];
            $keys=Vault::open($r['secret_cipher'],0,'haipress_media');
            if (empty($keys['token']) || empty($keys['key'])) throw new \InvalidArgumentException('请先保存海讯社 Token 和 Key');
            $response=self::accepted($this->transport->request('/api/member/user/tokenON',['clientType'=>'5'],['token'=>$keys['token'],'key'=>$keys['key']],false));
            $access=$response['data']??null;
            if (!is_string($access) || $access==='' || strlen($access)>2048 || preg_match('/[\r\n]/',$access)) throw new HaipressFailure(false,'invalid_token','海讯社令牌返回格式异常');
            Db::name('press_config')->where('id',1)->update(['access_cipher'=>Vault::seal(['access'=>$access],0,'haipress_access'),'access_expiry'=>time()+7100]);
            return $access;
        });
    }
    public function call(string $path,array $body=[],bool $json=false,?int $revision=null): array
    {
        $revision??=(int)PressConfig::resolve()['revision'];
        $token=$this->access($revision);
        try { return self::accepted($this->transport->request($path,['openToken'=>$token,'clientType'=>'5'],$body,$json),$path==='/api/media/order/createON'); }
        catch (HaipressFailure $e) { if (in_array($e->providerCode,['tokenError','tokenExpired'],true)) Db::name('press_config')->where(['id'=>1,'revision'=>$revision])->update(['access_expiry'=>0]); throw $e; }
    }
    public function resources(int $kind,int $page=1,int $limit=100,?int $revision=null): array
    {
        if ($kind<1 || $kind>15 || $page<1 || $page>100000 || $limit<1 || $limit>1000) throw new \InvalidArgumentException('资源分页参数不正确');
        $r=$this->call('/api/media/resources/list'.$kind.'ON',['page'=>$page,'limit'=>$limit],false,$revision);
        if (!is_array($r['data']??null) || !is_array($r['data']['list']??null) || !array_is_list($r['data']['list']) || count($r['data']['list'])>$limit || !isset($r['data']['total']) || !ctype_digit((string)$r['data']['total']) || (int)$r['data']['total']>10000000) throw new HaipressFailure(false,'invalid_resources','海讯社资源列表格式异常');
        return $r['data'];
    }
    public function inspectResources(int $kind, int $revision): array
    {
        if ($kind<1 || $kind>15) throw new \InvalidArgumentException('资源类型不正确');
        try { $access=$this->access($revision,true); }
        catch (HaipressFailure $e) { return ['authenticated'=>false,'connected'=>false,'message'=>$e->providerCode==='transport'?'连接海讯社失败，请检查服务器网络或供方状态':$e->getMessage()]; }
        try { return ['authenticated'=>true,'connected'=>true]+$this->resourcePreview($kind,$access); }
        catch (HaipressFailure $e) { return ['authenticated'=>true,'connected'=>false,'message'=>$e->providerCode==='transport'?'媒体资源接口连接失败':$e->getMessage()]; }
    }
    /** Read at most three samples; never creates orders or imports resources. */
    public function resourcePreview(int $kind,string $access): array
    {
        if ($kind<1 || $kind>15) throw new \InvalidArgumentException('资源类型不正确');
        $response=self::accepted($this->transport->request('/api/media/resources/list'.$kind.'ON',['openToken'=>$access,'clientType'=>'5'],['page'=>1,'limit'=>3],false));
        $data=$response['data']??null;
        if (!is_array($data) || !is_array($data['list']??null) || !isset($data['total'])) throw new HaipressFailure(false,'invalid_resources','资源列表返回格式异常');
        $samples=[];
        foreach(array_slice($data['list'],0,3)as $row){
            if(!is_array($row))continue;
            $prices=[];foreach(['costprice','cost2_price','cost3_price']as $field)if(isset($row[$field])&&is_numeric($row[$field])&&(float)$row[$field]>0)$prices[]=number_format((float)$row[$field],2,'.','');
            $samples[]=['name'=>mb_substr((string)($row['name']??$row['proficient_field']??$row['sourceid']??'资源样本'),0,150),'prices'=>$prices];
        }
        return ['total'=>max(0,(int)$data['total']),'samples'=>$samples,'checked_at'=>time()];
    }
    public function resourceState(string $id,int $revision): array { return $this->call('/api/media/resources/stateON',['sourceid'=>$id],false,$revision)['data']??[]; }
    public function submit(array $order): void
    {
        $this->call('/api/media/order/createON',['ordernum'=>$order['sn'],'sourceid'=>$order['source_id'],'price'=>PressMoney::decimal((int)$order['cost_cents']),'priceType'=>(int)($order['price_type']??1),'origin'=>urlencode($order['origin']??''),
            'title'=>urlencode($order['title']),'content'=>urlencode($order['preview_url']),'remark'=>urlencode($order['remark'])],true,(int)$order['config_revision']);
    }
    public function query(array $order): array
    {
        $r=$this->call('/api/media/order/queryON',['ordernum'=>$order['sn']],false,(int)$order['config_revision']);
        $d=$r['data']??[]; if (!isset($d['flag']) || !in_array((string)$d['flag'],['0','1','2','3','4','5','100'],true)) throw new HaipressFailure(true,'invalid_status','海讯社订单状态无法识别');
        return $d;
    }
    public function process(array $order,int $flag,string $note): void
    {
        if (!in_array($flag,[4,5],true)) throw new \InvalidArgumentException('无效发稿处理动作');
        $this->call('/api/media/order/processON',['ordernum'=>$order['sn'],'flag'=>$flag,'releaseresult'=>urlencode($note)],true,(int)$order['config_revision']);
    }
}
