<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantBrandService as Brand,MerchantArticleLibraryService as Library};
use app\common\service\merchant\geo\{GeoBrandScope as Scope,GeoWorkspace as Workspace};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
$checks=0;
function ac(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;echo 'PASS '.$message."\n";}
function ad(callable $fn,string $message):void{try{$fn();}catch(InvalidArgumentException){ac(true,$message);return;}throw new RuntimeException($message);}
Db::startTrans();
try{
 $users=[];foreach(['a','b'] as $key){$name='articleqa_'.bin2hex(random_bytes(5));$id=Directory::saveMerchant(1,['name'=>$name,'account'=>$name,'password'=>'Qa1!'.bin2hex(random_bytes(6))]);$users[$key]=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');}
 $u=$users['a'];$a=Brand::save(1,$u,['name'=>'历史品牌'])['id'];$b=Brand::save(1,$u,['name'=>'第二品牌'])['id'];$foreign=Brand::save(1,$users['b'],['name'=>'其他商家'])['id'];
 for($i=0;$i<12;$i++)Scope::with(1,$u,0,fn()=>Workspace::contentSave(1,$u,['kind'=>'articles','title'=>$i===0?'宣传100%真实':'文章 '.$i,'content'=>'正文事实 '.$i]));
 $category=Scope::with(1,$u,$b,fn()=>Workspace::save(1,$u,['kind'=>'category','title'=>'产品介绍']))['id'];
 $article=Scope::with(1,$u,$b,fn()=>Workspace::contentSave(1,$u,['kind'=>'articles','title'=>'第二品牌软文','content'=>'品牌事实','category_id'=>$category]))['id'];
 Scope::with(1,$users['b'],0,fn()=>Workspace::contentSave(1,$users['b'],['kind'=>'articles','title'=>'其他商家软文','content'=>'隔离资料']));
 $all=Library::listing(1,$u,[]);ac($all['count']===13&&count($all['lists'])===10&&$all['page_size']===10,'all owned brands share existing article rows with ten-row pagination');
 $last=Library::listing(1,$u,['page'=>2]);ac(count($last['lists'])===3&&!array_intersect(array_column($all['lists'],'id'),array_column($last['lists'],'id')),'second page is complete without duplicate rows');
 ac(count(Library::listing(1,$u,['page_size'=>20])['lists'])===13,'page size changes are honored');
 ac(Library::listing(1,$users['b'],[])['count']===1,'merchant isolation');ad(fn()=>Library::listing(999,$u,[]),'tenant isolation');
 ad(fn()=>Library::listing(1,$u,['brand_id'=>$foreign]),'foreign brand rejected');ad(fn()=>Library::listing(1,$u,['brand_id'=>-1]),'invalid brand rejected');
 $row=Library::listing(1,$u,['brand_id'=>$b,'category_id'=>$category])['lists'][0];
 ac($row['id']==$article&&$row['owner_brand_id']===$b&&$row['brand_name']==='第二品牌'&&$row['category_name']==='产品介绍'&&$row['word_count']===4,'brand, category and word count use real owned data');
 ac(Library::listing(1,$u,['brand_id'=>$a])['count']===12,'legacy scope maps back to its visible brand');
 ad(fn()=>Library::listing(1,$u,['brand_id'=>$a,'category_id'=>$category]),'cross-brand category rejected');
 ac(Library::listing(1,$u,['keyword'=>'%'])['count']===1,'wildcard characters search literally');
 $native=Scope::with(1,$u,$b,fn()=>Workspace::records(1,$u,['kind'=>'articles']))['lists'][0];ac($native['expected_hash']===$row['expected_hash'],'asset view preserves the GEO optimistic hash');
 $edit=['kind'=>'articles','id'=>$article,'title'=>$row['title'],'content'=>'更新的品牌事实','category_id'=>$category,'expected_update'=>$row['update_time'],'expected_hash'=>$row['expected_hash']];
 Scope::with(1,$u,$b,fn()=>Workspace::contentSave(1,$u,$edit));
 ac(Library::listing(1,$u,['brand_id'=>$b])['lists'][0]['content']==='更新的品牌事实','asset edits synchronize into GEO storage');
 ad(fn()=>Scope::with(1,$u,$b,fn()=>Workspace::contentSave(1,$u,$edit)),'stale edit rejected');
 Db::name('aigc_geo_article')->where(['tenant_id'=>1,'user_id'=>$u,'id'=>$article])->update(['delete_time'=>time()]);ac(Library::listing(1,$u,['brand_id'=>$b])['count']===0,'recycled articles excluded');
 Db::name('aigc_geo_article')->where(['tenant_id'=>1,'user_id'=>$u,'id'=>$article])->update(['delete_time'=>0]);Db::name('oem_merchant_brand')->where('id',$b)->update(['delete_time'=>time()]);ac(Library::listing(1,$u,[])['count']===12,'recycled brands excluded from aggregate assets');
 echo 'All '.$checks.' article-library checks passed. Fixtures rolled back; no AI or publishing calls.'."\n";
}finally{Db::rollback();}
