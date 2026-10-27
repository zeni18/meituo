<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\MerchantBrandService as Brands;
if(!str_starts_with((string)config('database.connections.mysql.database'),'aigc_dev_'))throw new RuntimeException('Isolated development database required');
$owner=Db::name('oem_merchant')->where('status',1)->find();
if(!$owner)throw new RuntimeException('Development merchant required');
$t=(int)$owner['tenant_id'];$u=(int)$owner['user_id'];$name='品牌保存回归-'.bin2hex(random_bytes(5));$passed=0;
function checkBrand(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);echo 'PASS '.$label.PHP_EOL;$passed++;}
Db::startTrans();
try{
    $saved=Brands::save($t,$u,['name'=>$name,'industry'=>'软件','website'=>'ai.zoco.com']);$id=(int)$saved['id'];
    $detail=Brands::detail($t,$u,['id'=>$id]);
    checkBrand($detail['profile']['website']==='https://ai.zoco.com','bare domain saved with HTTPS in one operation');
    checkBrand($detail['profile']['industry']==='软件','industry saved with brand');
    $duplicate=false;try{Brands::save($t,$u,['name'=>$name]);}catch(InvalidArgumentException $e){$duplicate=str_contains($e->getMessage(),'当前账号');}
    checkBrand($duplicate&&Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'name'=>$name,'delete_time'=>0])->count()===1,'duplicate belongs to current account and creates no second record');
    $otherAccount='brrecover'.bin2hex(random_bytes(4));
    $otherMerchant=\app\common\service\merchant\OemDirectoryService::saveMerchant($t,['name'=>'隔离验收商家','account'=>$otherAccount,'password'=>'BrandQa2026!']);
    $otherUser=(int)Db::name('oem_merchant')->where('id',$otherMerchant)->value('user_id');
    $otherBrand=Brands::save($t,$otherUser,['name'=>$name]);
    checkBrand((int)$otherBrand['id']!==$id,'another merchant may use the same brand name');
    checkBrand(!in_array((int)$otherBrand['id'],array_map(fn($row)=>(int)$row['id'],Brands::choices($t,$u)),true),'recovery choices never expose another merchants brand');
    Brands::knowledgeSave($t,$u,array_merge($detail['profile'],['id'=>$id,'intro'=>'保留的企业事实']));
    $detail=Brands::detail($t,$u,['id'=>$id]);
    $payload=['id'=>$id,'revision'=>$detail['brand']['revision'],'name'=>$name.'改名','industry'=>'软件','website'=>$detail['profile']['website']];
    Brands::save($t,$u,$payload);$detail=Brands::detail($t,$u,['id'=>$id]);
    checkBrand($detail['brand']['name']===$payload['name']&&$detail['profile']['website']==='https://ai.zoco.com','name-only edit preserves untouched website');
    checkBrand($detail['profile']['intro']==='保留的企业事实','basic information preserves other enterprise knowledge');
    Brands::save($t,$u,array_merge($payload,['revision'=>$detail['brand']['revision']]));
    checkBrand(Brands::detail($t,$u,['id'=>$id])['brand']['name']===$payload['name'],'same name and website can be saved again');
    foreach(['javascript:alert(1)','https://user:password@example.com','https://bad host.com','ftp://example.com']as $url){
        $failed=false;try{Brands::save($t,$u,['name'=>$name.'无效','website'=>$url]);}catch(InvalidArgumentException){$failed=true;}
        checkBrand($failed&&Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'name'=>$name.'无效'])->count()===0,'invalid website leaves no partial brand: '.$url);
    }
    $detail=Brands::detail($t,$u,['id'=>$id]);$failed=false;
    try{Brands::save($t,$u,['id'=>$id,'revision'=>$detail['brand']['revision'],'name'=>$name.'不应改名','website'=>'https://bad host.com']);}catch(InvalidArgumentException){$failed=true;}
    checkBrand($failed&&Brands::detail($t,$u,['id'=>$id])['brand']['name']===$payload['name'],'invalid edit rolls back name and website together');
    $failed=false;try{Brands::save($t,$u,$payload);}catch(InvalidArgumentException){$failed=true;}
    checkBrand($failed,'stale brand revision remains rejected');
    foreach(['ai.zoco.com'=>'https://ai.zoco.com',' HTTPS://Example.com/path?a=1 '=>'https://Example.com/path?a=1','//example.com'=>'https://example.com',''=>'']as $input=>$expected)checkBrand(\app\common\service\merchant\MerchantGeoService::normalizeWebsite($input)===$expected,'website normalization: '.$input);
    foreach(["https:// ai.zoco.com","https://\u{200b}ai.zoco.com","https://ai.\u{200b}zoco.com","\u{200b}\u{00a0}https://ai.zoco.com\u{2060}","HTTPS : // \u{200b}ai.zoco.com","//\u{00a0}ai.zoco.com"]as $input)checkBrand(\app\common\service\merchant\MerchantGeoService::normalizeWebsite($input)==='https://ai.zoco.com','pasted whitespace/format characters normalized');
}finally{Db::rollback();}
echo 'All '.$passed.' checks passed; all fixture changes rolled back.'.PHP_EOL;
