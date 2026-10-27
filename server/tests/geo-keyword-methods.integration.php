<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantBrandService as Brands};
use app\common\service\merchant\geo\{GeoKeywordLibrary as Library,GeoBrandScope as Scope};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
$passed=0;$failure=null;$original=app()->request;$prefix='wm'.bin2hex(random_bytes(5));
function wm(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function wmReject(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){wm(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try{
 $t=1;$m=Directory::saveMerchant($t,['name'=>$prefix,'account'=>$prefix,'password'=>'WordMethod2026!']);$u=(int)Db::name('oem_merchant')->where('id',$m)->value('user_id');
 $m2=Directory::saveMerchant($t,['name'=>$prefix.'x','account'=>$prefix.'x','password'=>'WordMethod2026!']);$u2=(int)Db::name('oem_merchant')->where('id',$m2)->value('user_id');
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 $a=Brands::save($t,$u,['name'=>'品牌甲'.$prefix]);$b=Brands::save($t,$u,['name'=>'品牌乙'.$prefix]);$foreign=Brands::save($t,$u2,['name'=>'其他商家'.$prefix]);Scope::bind($t,$u,$a['id']);
 wmReject(fn()=>Library::saveLibrary($t,$u,['title'=>'缺品牌']),'new library requires explicit associated brand');
 wmReject(fn()=>Library::saveLibrary($t,$u,['title'=>'跨商家','brand_id'=>$foreign['id']]),'cannot associate another merchant brand');
 $la=Library::saveLibrary($t,$u,['title'=>'甲词库','brand_id'=>$a['id']]);$lb=Library::saveLibrary($t,$u,['title'=>'乙词库','brand_id'=>$b['id']]);
 wm($la['brand_id']===$a['id']&&$lb['brand_id']===$b['id'],'library creation returns the actual associated brand');
 wm(count(Library::view($t,$u,[])['groups'])===1,'creating another brand library does not leak it into current brand');
 Scope::bind($t,$u,$b['id']);wm(Library::view($t,$u,['group_id'=>$lb['id']])['groups'][0]['title']==='乙词库','explicit association stores the library under target brand');
 Scope::bind($t,$u,$a['id']);wmReject(fn()=>Library::saveLibrary($t,$u,['id'=>$la['id'],'revision'=>1,'title'=>'挪库','brand_id'=>$b['id']]),'existing libraries cannot silently move brand ownership');
 wmReject(fn()=>Library::saveLibrary($t,$u,['id'=>$lb['id'],'revision'=>1,'title'=>'越范围编辑','brand_id'=>$b['id']]),'library editing still requires original brand scope');
 $valid=['keyword_group_id'=>$la['id'],'parts'=>["北京\n上海",'优质',"营销软件\n获客工具",'','','怎么选']];
 $r=Library::manualPreview($t,$u,$valid);wm(count($r['terms'])===4&&in_array('北京优质营销软件怎么选',$r['terms'],true)&&$r['billable']===false,'six-part manual expansion produces the bounded Cartesian product without fees');
 $blank=Library::manualPreview($t,$u,['keyword_group_id'=>$la['id'],'parts'=>['','','单独主词','','','']]);wm($blank['terms']===['单独主词'],'optional segments may be empty');
 wmReject(fn()=>Library::manualPreview($t,$u,['parts'=>$valid['parts']]),'manual expansion must select a library first');
 wmReject(fn()=>Library::manualPreview($t,$u,array_replace($valid,['keyword_group_id'=>$lb['id']])),'manual expansion cannot target another brand library');
 wmReject(fn()=>Library::manualPreview($t,$u,array_replace($valid,['parts'=>['','','','','','']])),'manual expansion needs a main term');
 wmReject(fn()=>Library::manualPreview($t,$u,array_replace($valid,['parts'=>['只有一组']])),'manual expansion accepts exactly six groups');
 $terms=implode("\n",range(1,11));wmReject(fn()=>Library::manualPreview($t,$u,array_replace($valid,['parts'=>[$terms,$terms,$terms,'','','']])),'manual expansion rejects more than 1000 combinations before expanding');
 wmReject(fn()=>Library::manualPreview($t,$u,array_replace($valid,['parts'=>['','',str_repeat('长',101),'','','']])),'individual manual terms are bounded');
 wm(Library::view($t,$u,['group_id'=>$la['id']])['count']===0,'preview does not silently save words');Library::add($t,$u,['keyword_group_id'=>$la['id'],'topics'=>array_map(fn($text)=>['text'=>$text],$r['terms'])]);wm(Library::view($t,$u,['group_id'=>$la['id']])['count']===4,'explicit adoption saves manual results to the chosen library');
 wm(Db::name('oem_geo_job')->where('user_id',$u)->count()===0,'library selection and manual expansion never enqueue model or index calls');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getLine()."\n");exit(1);}echo "All $passed keyword method checks passed; fixtures rolled back, no external calls.\n";
