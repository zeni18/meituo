<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{MerchantBrandService as Brands,MerchantStoreService as Stores,MerchantWorkspaceService as Workspace};
if(!str_starts_with((string)config('database.connections.mysql.database'),'aigc_dev_'))throw new RuntimeException('Development database required');
$owner=Db::name('oem_merchant')->where('status',1)->find();if(!$owner)throw new RuntimeException('Development merchant required');
$t=(int)$owner['tenant_id'];$u=(int)$owner['user_id'];$seed='号码校验回归-'.bin2hex(random_bytes(5));$bad='12312131231123112312121231212121';$checks=0;
function rejectPhone(callable $fn,string $label):void{global $checks;$failed=false;try{$fn();}catch(InvalidArgumentException $e){$failed=true;}if(!$failed)throw new RuntimeException($label.' accepted an invalid contact number');$checks++;}
$tables=['oem_merchant_brand','oem_merchant_store','oem_brand_store','oem_merchant_store_meta'];
$snapshot=static fn()=>array_map(static fn($table)=>Db::name($table)->count(),$tables);$before=$snapshot();
Db::startTrans();
try{
    rejectPhone(fn()=>Brands::save($t,$u,['name'=>$seed.'无效品牌','mobile'=>$bad]),'Brand create');
    $b=Brands::save($t,$u,['name'=>$seed,'mobile'=>'13812345678']);$id=(int)$b['id'];
    $detail=Brands::detail($t,$u,['id'=>$id]);
    rejectPhone(fn()=>Brands::save($t,$u,['id'=>$id,'revision'=>$detail['brand']['revision'],'name'=>$seed.'不应改名','mobile'=>$bad]),'Brand edit');
    if(Brands::detail($t,$u,['id'=>$id])['brand']['name']!==$seed)throw new RuntimeException('Invalid edit changed existing brand');$checks++;
    rejectPhone(fn()=>Stores::save($t,$u,['name'=>$seed.'无效门店','mobile'=>$bad,'brand_id'=>$id]),'Store create');
    rejectPhone(fn()=>Workspace::save($t,$u,'store',['name'=>$seed.'旧接口','mobile'=>$bad]),'Legacy store API');
    $store=Stores::save($t,$u,['name'=>$seed.'门店','mobile'=>'0571-87011233 转 1234','brand_id'=>$id]);
    if(Db::name('oem_merchant_store')->where('id',$store)->value('mobile')!=='0571-87011233 转 1234')throw new RuntimeException('Valid landline extension was not saved');$checks++;
    rejectPhone(fn()=>Stores::save($t,$u,['id'=>$store,'name'=>$seed.'不应改店名','mobile'=>$bad]),'Store edit');
    if(Db::name('oem_merchant_store')->where('id',$store)->value('name')!==$seed.'门店')throw new RuntimeException('Invalid edit changed existing store');$checks++;
    rejectPhone(fn()=>Stores::createMany($t,$u,['brand_id'=>$id,'rows'=>[['name'=>$seed.'批量有效','mobile'=>'400-123-4567'],['name'=>$seed.'批量无效','mobile'=>$bad]]]),'Store batch');
    if(Db::name('oem_merchant_store')->where('name',$seed.'批量有效')->count())throw new RuntimeException('Batch failure left a partial store');$checks++;
    $fixture=dirname(__DIR__).'/.collab/local/contact-phone-import-fixture.csv';
    file_put_contents($fixture,"门店名称,电话,地址,营业时间,poi_id\n测试门店,".$bad.",,,\n");
    $file=new class($fixture){public function __construct(private string $path){}public function getSize(){return filesize($this->path);}public function getPathname(){return $this->path;}public function getOriginalExtension(){return 'csv';}};
    rejectPhone(fn()=>Stores::importPreview($file),'Store import preview');
}finally{Db::rollback();}
if($snapshot()!==$before)throw new RuntimeException('Regression fixtures were not fully rolled back');
echo 'PASS '.$checks.' brand/store/API/import checks; all fixture rows rolled back.'.PHP_EOL;
