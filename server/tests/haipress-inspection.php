<?php
declare(strict_types=1);
$root=dirname(__DIR__);
foreach(['HaipressTransport','HaipressFailure','HaipressClient'] as $class)require $root.'/app/common/service/press/'.$class.'.php';
use app\common\service\press\{HaipressTransport,HaipressClient,HaipressFailure};
$calls=[];$response=['code'=>200,'data'=>['total'=>123,'list'=>array_fill(0,5,['name'=>'<sample>','costprice'=>12.3,'token'=>'must-not-escape','cost2_price'=>0])]];
$transport=new class($calls,$response) implements HaipressTransport {
    public function __construct(public array &$calls, public array &$response){}
    public function request(string $path,array $headers,array $body,bool $json):array{$this->calls[]=[$path,$headers,$body,$json];return $this->response;}
};
$client=new HaipressClient($transport);$count=0;
function verifyProbe(bool $ok,string $message):void{global $count;if(!$ok)throw new RuntimeException($message);$count++;}
foreach(range(1,15)as $kind){$result=$client->resourcePreview($kind,'test-access');$call=end($calls);verifyProbe($call[0]==='/api/media/resources/list'.$kind.'ON'&&$call[2]===['page'=>1,'limit'=>3]&&!$call[3],'Read only the requested resource samples');verifyProbe($result['total']===123&&count($result['samples'])===3&&$result['samples'][0]['prices']===['12.30'],'Count, sample limit and price normalized');verifyProbe(!str_contains(json_encode($result),'must-not-escape')&&!str_contains(json_encode($result),'test-access'),'Probe returns no credentials');}
foreach([0,16]as $kind){try{$client->resourcePreview($kind,'test-access');throw new RuntimeException('Unknown resource type accepted');}catch(InvalidArgumentException){$count++;}}
$response=['code'=>200,'data'=>['total'=>0,'list'=>[]]];verifyProbe($client->resourcePreview(1,'test-access')['total']===0,'Empty result is still a connected API');
$response=['code'=>403,'msgen'=>'authorityError'];try{$client->resourcePreview(1,'test-access');throw new RuntimeException('Provider rejection accepted');}catch(HaipressFailure){$count++;}
$response=['code'=>200,'data'=>[]];try{$client->resourcePreview(1,'test-access');throw new RuntimeException('Malformed response accepted');}catch(HaipressFailure){$count++;}
verifyProbe(count(array_filter($calls,fn($call)=>str_contains($call[0],'/order/')))===0,'Inspection never calls order endpoints');
echo "Passed $count resource-inspection checks with an offline transport.\n";
