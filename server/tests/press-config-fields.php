<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/common/service/press/PressConfig.php';
require dirname(__DIR__).'/app/platformapi/listener/OperationLog.php';
use app\common\service\press\PressConfig;
$merge=new ReflectionMethod(PressConfig::class,'mergeCredentials');
$format=new ReflectionMethod(\app\platformapi\listener\OperationLog::class,'formatResult');
$logger=new \app\platformapi\listener\OperationLog();
$count=0;
function verify(bool $ok,string $message):void{global $count;if(!$ok)throw new RuntimeException($message);$count++;}
$old=['token'=>'fixture-token','key'=>'fixture-key'];
verify($merge->invoke(null,$old,['token'=>'replacement','key'=>'changed','replace_credentials'=>true])===['token'=>'replacement','key'=>'changed'],'Current values replace saved credentials');
verify($merge->invoke(null,$old,['token'=>'','key'=>'','replace_credentials'=>true])===['token'=>'','key'=>''],'Explicit blanks clear fields in unified editor');
verify($merge->invoke(null,$old,[])===$old,'Omitted fields preserve credentials');
verify($merge->invoke(null,$old,['token'=>'','key'=>''])===$old,'Old cached clients keep placeholder behavior');
foreach([null,[],"bad\nvalue",str_repeat('x',1025)]as $invalid){try{$merge->invoke(null,$old,['token'=>$invalid]);throw new RuntimeException('Invalid credential accepted');}catch(InvalidArgumentException){$count++;}}
$response=['code'=>1,'data'=>['token'=>$old['token'],'key'=>$old['key'],'token_configured'=>true,'key_configured'=>true,'revision'=>2]];
$logged=$format->invoke($logger,json_encode($response),true);$decoded=json_decode($logged,true);
verify(!str_contains($logged,$old['token'])&&!str_contains($logged,$old['key']),'Config responses never write plaintext credentials to operation logs');
verify($decoded['data']['revision']===2&&$decoded['data']['token_configured']===true,'Useful audit metadata retained');
verify($format->invoke($logger,'{"code":1,"data":{"revision":2}}',true)==='{"code":1,"data":{"revision":2}}','Other settings responses unchanged');
verify(PressConfig::publicBase('https://ai.example.com/')==='https://ai.example.com','Public site root accepted');
foreach(['http://127.0.0.1:8090','https://localhost','https://ai.example.com/admin','https://ai.example.com?token=x']as $url){try{PressConfig::publicBase($url);throw new RuntimeException('Invalid preview domain accepted');}catch(InvalidArgumentException){$count++;}}
foreach([[],['public_base'=>'']] as $config){try{PressConfig::assertPublishReady($config);throw new RuntimeException('Publishing without a site domain accepted');}catch(InvalidArgumentException){$count++;}}
PressConfig::assertPublishReady(['public_base'=>'https://ai.example.com']);$count++;
echo "Passed $count credential, audit and preview-domain checks. No database or provider calls.\n";
