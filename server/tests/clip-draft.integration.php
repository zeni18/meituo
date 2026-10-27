<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\MerchantClipService as Clip;
$expected=getenv('MERCHANT_AUDIT_TEST_DB');$port=getenv('MERCHANT_AUDIT_TEST_PORT');
if(!$expected||!preg_match('/^aigc_dev_[a-z_]+_[0-9]+$/D',$expected)||config('database.connections.mysql.database')!==$expected||(string)config('database.connections.mysql.hostport')!==$port||!in_array(config('database.connections.mysql.hostname'),['127.0.0.1','localhost'],true))throw new RuntimeException('Explicit local development database required');
$passed=0;
function verify(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function invalid(callable $work,string $label):void{try{$work();}catch(InvalidArgumentException){verify(true,$label);return;}throw new RuntimeException($label);}
function fixture(string $table,array $patch):int{$data=[];foreach(Db::name($table)->getFields() as $key=>$field){if(!empty($field['autoinc'])||!empty($field['primary']))continue;if(($field['default']??null)!==null||empty($field['notnull']))continue;$data[$key]=preg_match('/int|decimal|float|double/',(string)$field['type'])?0:'';}return (int)Db::name($table)->insertGetId(array_replace($data,$patch));}
Db::startTrans();try{
 $t=1;$u=(int)Db::name('oem_merchant')->where('tenant_id',$t)->value('user_id');if(!$u)throw new RuntimeException('Local merchant required');
 $before=Db::name('oem_clip_document')->count();
 $empty=Clip::draftAssets($t,$u,['config'=>[]]);verify($empty['config']['mode']==='quick'&&$empty['assets']===[],'empty draft normalized without project creation');
 foreach([[],['config'=>'bad'],['config'=>['groups'=>[]]],['config'=>['fps'=>29]],['config'=>['material_ids'=>['https://invalid.test/a.png']]]] as $i=>$bad)invalid(fn()=>Clip::draftAssets($t,$u,$bad),'invalid draft rejected '.$i);
 $file=fixture('tenant_file',['tenant_id'=>$t,'source'=>1,'source_id'=>$u,'type'=>10,'name'=>'transaction-draft.png','uri'=>'uploads/transaction-draft.png','storage_engine'=>'local','storage_scope'=>'tenant','storage_domain'=>'','delete_time'=>null]);
 $material=fixture('oem_merchant_material',['tenant_id'=>$t,'user_id'=>$u,'kind'=>'image','name'=>'transaction draft','file_ids'=>json_encode([$file]),'delete_time'=>0]);
 $cfg=['material_ids'=>[$material],'ratio'=>'16:9','resolution'=>'1080'];
 $draft=Clip::draftAssets($t,$u,['config'=>$cfg]);verify(isset($draft['assets'][$material]),'owned draft resolves material');verify($draft['config']['resolution']==='1080'&&$draft['config']['ratio']==='16:9','output settings survive validation');
 invalid(fn()=>Clip::draftAssets($t,$u+999999,['config'=>$cfg]),'other merchant cannot resolve draft material');
 invalid(fn()=>Clip::draftAssets($t+999,$u,['config'=>$cfg]),'other tenant cannot resolve draft material');
 invalid(fn()=>Clip::draftAssets($t,$u,['config'=>['music_ids'=>[$material]]]),'wrong material type rejected');
 Db::name('oem_merchant_material')->where('id',$material)->update(['delete_time'=>time()]);invalid(fn()=>Clip::draftAssets($t,$u,['config'=>$cfg]),'recycled material cannot restore into active draft');Db::name('oem_merchant_material')->where('id',$material)->update(['delete_time'=>0]);
 Db::name('tenant_file')->where('id',$file)->update(['source_id'=>$u+999999]);invalid(fn()=>Clip::draftAssets($t,$u,['config'=>$cfg]),'file owner checked independently of material owner');Db::name('tenant_file')->where('id',$file)->update(['source_id'=>$u]);
 $story=['mode'=>'storyboard','groups'=>[['material_ids'=>[$material],'texts'=>['keep caption'],'duration'=>5]],'subtitle_mode'=>'group'];$resolved=Clip::draftAssets($t,$u,['config'=>$story]);verify($resolved['config']['groups'][0]['texts']===['keep caption']&&isset($resolved['assets'][$material]),'storyboard captions and owned media recover together');
 verify(Db::name('oem_clip_document')->count()===$before,'draft resolution never creates server versions');
}finally{Db::rollback();}
echo 'All '.$passed." draft checks passed; all fixtures rolled back; no cloud services called.\n";
