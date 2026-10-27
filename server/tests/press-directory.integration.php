<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\press\{PressMediaDirectory as Directory,PressService};
use app\common\service\merchant\geo\GeoBrandScope as Scope;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local test database required');
$checks=0;function pc(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;echo "PASS $label\n";}
function rejects(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){pc(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try{
 $owner=Db::name('oem_merchant')->where('status',1)->find();$t=(int)$owner['tenant_id'];$u=(int)$owner['user_id'];
 $revision=999998;Db::name('press_config')->where('id',1)->update(['revision'=>$revision,'markup_bps'=>2500]);
 $insert=function(string $name,int $cost,array $extra=[])use($revision){return (int)Db::name('press_media')->insertGetId(array_replace(['source_id'=>'directory-qa-'.bin2hex(random_bytes(8)),'kind'=>1,'name'=>$name,'region'=>'全国','category'=>'IT科技,新闻资讯','cost_cents'=>$cost,'active'=>1,'remark'=>'真实备注','case_url'=>'https://example.com','config_revision'=>$revision,'sync_time'=>time(),'details_json'=>json_encode(['pcweight'=>0,'wapweight'=>2,'publishtime'=>24,'weekendpublish'=>1,'searchcollint'=>1,'token'=>'do-not-expose'])],$extra));};
 $a=$insert('测试媒体 A',8000);$b=$insert('测试媒体 B',8001,['region'=>'综合全国','details_json'=>json_encode(['pcweight'=>0,'wapweight'=>2,'publishtime'=>24,'weekendpublish'=>1,'searchcollint'=>0])]);$c=$insert('测试媒体 C',24000,['region'=>'上海','details_json'=>'{}']);$d=$insert('自媒体',24001,['kind'=>2,'category'=>'百家号','details_json'=>json_encode(['fans'=>1000,'readnumber'=>5,'authint'=>1,'searchcollint'=>1])]);$off=$insert('下架',100,['active'=>0]);$other=$insert('海外',100,['kind'=>3]);
 Scope::with($t,$u,999991,function()use($t,$u,$a,$b,$c,$d,$off,$other){
  $list=fn($p=[])=>Directory::listing($t,$u,$p);
  pc($list()['count']===4,'only active supported media are listed');
  pc(Directory::caseUrl($t,$u,$a)==='https://example.com','case opens the catalog article URL');
  rejects(fn()=>Directory::caseUrl($t,$u,$off),'unavailable media cannot open cases');
  rejects(fn()=>Directory::caseUrl($t,$u,$other),'unsupported media cannot open cases');
  $all=$list()['lists'];pc(!isset($all[0]['cost_cents'])&&!str_contains(json_encode($all),'do-not-expose'),'supplier costs and raw secrets never returned');
  $ar=array_values(array_filter($all,fn($r)=>(int)$r['id']===$a))[0];pc($ar['metrics']['pcweight']===0&&$ar['metrics']['publication_rate']===null,'real zero weight preserved and rate remains unknown');
  $cr=array_values(array_filter($all,fn($r)=>(int)$r['id']===$c))[0];pc($cr['metrics']['pcweight']===null&&$cr['metrics']['publish_time_label']===null,'missing metrics are not invented');
  pc(array_column($list(['searchcollint'=>'1'])['lists'],'id')===[$a],'guaranteed indexing uses explicit website supplier flag only');
  pc(array_column($list(['searchcollint'=>'0'])['lists'],'id')===[$b],'not-guaranteed indexing excludes missing values');
  pc($list(['searchcollint'=>'1','price'=>'low','region'=>'全国','category'=>'IT科技'])['count']===1,'indexing composes with retail price industry and region filters');
  pc($list(['searchcollint'=>'1','favorites'=>1])['count']===0,'indexing retains favorite scope');
  pc($list(['kind'=>2,'searchcollint'=>'1'])['count']===0,'self-media cannot be mistaken for website indexing guarantees');
  rejects(fn()=>$list(['searchcollint'=>'2']),'undocumented indexing filter codes rejected');
  Db::name('press_media')->where('id',$c)->update(['details_json'=>'{"searchcollint":2}']);
  pc($list(['searchcollint'=>'1'])['count']===1&&$list(['searchcollint'=>'0'])['count']===1,'unknown supplier codes are not guessed as guaranteed or not guaranteed');
  pc($list(['price'=>'low'])['count']===1&&$list(['price'=>'low'])['lists'][0]['retail_cents']===10000,'low bracket uses marked-up rounded retail price');
  pc($list(['price'=>'mid'])['count']===2&&$list(['price'=>'high'])['count']===1,'price brackets have exact non-overlapping boundaries');
  pc($list(['price'=>'custom','min_price'=>'100.01','max_price'=>'100.02'])['lists'][0]['id']===$b,'custom decimal boundaries use rounded retail cents');
  pc($list(['price'=>'custom','max_price'=>'100'])['count']===1,'custom upper-only range includes exact bound');
  pc($list(['price'=>'custom','min_price'=>'300.01'])['count']===1,'custom lower-only range works');
  pc($list(['price'=>'custom','max_price'=>'0'])['count']===0,'zero is a valid custom price bound');
  rejects(fn()=>$list(['price'=>'custom','min_price'=>'101','max_price'=>'100']),'reversed price bounds rejected');
  rejects(fn()=>$list(['price'=>'custom','min_price'=>'-1']),'negative price rejected');
  rejects(fn()=>$list(['price'=>'custom','min_price'=>'1.234']),'sub-cent price rejected');
  rejects(fn()=>$list(['price'=>'custom']),'empty custom range rejected');
  pc($list(['category'=>'IT科技','region'=>'全国'])['count']===2,'industry membership and nationwide aliases filter together');
  pc($list(['keyword'=>'%'])['count']===0,'keyword wildcard is escaped');
  pc($list(['pcweight'=>'0'])['count']===2,'numeric filter excludes missing metrics');
  pc($list(['pcweight'=>'1'])['count']===0,'weight minimum is applied');
  pc($list(['publishtime'=>'24','weekendpublish'=>'1'])['count']===2,'advanced criteria compose');
  pc($list(['kind'=>2,'fans'=>'1000'])['lists'][0]['metrics']['fans_label']==='10万–100万','self-media range codes are decoded');
  pc(array_column($list(['sort'=>'price_asc'])['lists'],'id')===[$a,$b,$c,$d],'price ascending is stable');
  pc($list(['sort'=>'price_desc'])['lists'][0]['id']===$d,'price descending works');
  pc($list(['page'=>999,'page_size'=>10])['page']===1,'page clamps after filters reduce results');
  Directory::favorite($t,$u,['media_id'=>$a,'favorite'=>true]);Directory::favorite($t,$u,['media_id'=>$a,'favorite'=>true]);
  pc($list(['favorites'=>1])['count']===1&&$list(['favorites'=>1])['lists'][0]['is_favorite'],'favorites are persistent and idempotent');
  pc(Scope::query('oem_geo_resource',$t,$u)->where(['kind'=>'favorite','delete_time'=>0])->count()===1,'repeated favorite does not create duplicates');
  Scope::with($t,$u,999992,fn()=>pc(Directory::listing($t,$u,['favorites'=>1])['count']===0,'favorites isolated across brands'));
  Directory::favorite($t,$u,['media_id'=>$a,'favorite'=>false]);pc($list(['favorites'=>1])['count']===0,'unfavorite removes selection from live catalog');
  pc(Scope::query('oem_geo_resource',$t,$u)->where('kind','favorite')->where('delete_time','>',0)->count()===1,'unfavorite is recoverable in resource recycle bin');
  rejects(fn()=>Directory::favorite($t,$u,['media_id'=>$off,'favorite'=>true]),'cannot favorite unavailable media');
  rejects(fn()=>Directory::favorite($t,$u,['media_id'=>$other,'favorite'=>true]),'cannot favorite unsupported checkout categories');
  rejects(fn()=>$list(['pcweight'=>'1 OR 1=1']),'invalid numeric filter rejected');
  rejects(fn()=>$list(['sort'=>'cost_cents; drop table']),'invalid sort rejected');
  rejects(fn()=>$list(['kind'=>3]),'invalid media type rejected');
 });
 rejects(fn()=>Directory::listing($t,99999999,[]),'another or nonexistent merchant cannot read catalog');
 rejects(fn()=>Directory::caseUrl($t,99999999,$a),'another or nonexistent merchant cannot resolve cases');
 echo "All $checks directory integration checks passed; transaction rolled back, no HTTP or orders.\n";
}finally{Db::rollback();}
