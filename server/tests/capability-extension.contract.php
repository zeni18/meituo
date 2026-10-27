<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use app\common\service\merchant\clip\{ClipConfiguration,ClipFeatures,ClipPlanner,ClipImsTimeline,ClipPublicMusic,ClipCloudTransport};
use app\common\service\press\PressPriceOptions;
$n=0;
function check(bool $ok,string $label):void{global $n;if(!$ok)throw new RuntimeException($label);echo 'PASS '.$label."\n";$n++;}
function invalid(callable $f,string $label):void{try{$f();}catch(InvalidArgumentException){check(true,$label);return;}throw new RuntimeException($label);}
$assets=[1=>['kind'=>'video','duration'=>2],2=>['kind'=>'image','duration'=>0],3=>['kind'=>'audio','duration'=>10]];
$base=['mode'=>'storyboard','groups'=>[['material_ids'=>[1],'duration'=>5],['material_ids'=>[2],'duration'=>3]],'cover_ids'=>[2],'music_ids'=>[3]];
$c=ClipConfiguration::normalize($base+['text_style'=>['flower'=>'CS0001-000001','font'=>'Source Han Sans CN','motion'=>'fade_in'],'resolution'=>'1080','subtitle_mode'=>'timed','captions'=>[['start'=>0.1,'end'=>1.2,'text'=>'第一句'],['start'=>1.5,'end'=>2,'text'=>'第二句']],'transition'=>['type'=>'fade','duration'=>0.5],'audio_effects'=>['fade_in'=>2,'fade_out'=>2,'denoise'=>3]]);
$p=(new ClipPlanner('effects'))->build($c,$assets);$media=[];foreach($assets as $id=>$asset)$media[$id]=$asset+['url'=>'https://owned.example/'.$id];$timeline=ClipImsTimeline::compile($p,$media);
check($p['duration']===8.0,'transition preserves saved plan duration');
$main=$timeline['VideoTracks'][0]['VideoTrackClips'];check(count($main)===4,'looped source remains bounded');
check(end($main)['TimelineOut']===8.0,'timeline still ends at original duration');
check(count(array_filter(array_merge(...array_column($main,'Effects')),fn($e)=>$e['Type']==='DLTransition'))===1,'transition applies once at group boundary, not loop seams');
$captions=$timeline['SubtitleTracks'][0]['SubtitleTrackClips'];check(count($captions)===2&&$captions[0]['TimelineIn']===0.1&&$captions[0]['TimelineOut']===1.2,'real caption timestamps preserved');
check($captions[0]['EffectColorStyle']==='CS0001-000001'&&$captions[0]['Font']==='Source Han Sans CN'&&$captions[0]['AaiMotionInEffect']==='fade_in','font flower and animation reach vendor timeline');
$cover=end($timeline['VideoTracks'])['VideoTrackClips'][0];check($cover['MediaURL']===$media[2]['url']&&$cover['TimelineOut']===1/25,'owned cover occupies first frame only');
$audio=$timeline['AudioTracks'][0]['AudioTrackClips'][0];check(array_column($audio['Effects'],'Type')===['Volume','AFade','AFade'],'music fades preserve music without voice denoise');
$o=ClipImsTimeline::output($p,'https://output.example/a');check($o['Width']===1080&&$o['Height']===1920,'1080 portrait output');
$old=(new ClipPlanner('old'))->build(ClipConfiguration::normalize($base),$assets);check(ClipImsTimeline::output($old,'a')['Width']===720,'legacy output defaults unchanged');
invalid(fn()=>ClipConfiguration::normalize(['captions'=>[['start'=>2,'end'=>1,'text'=>'bad']]]),'reject backwards captions');
invalid(fn()=>ClipConfiguration::normalize(['captions'=>[['start'=>0,'end'=>2,'text'=>'a'],['start'=>1,'end'=>3,'text'=>'b']]]),'reject overlapping captions');
invalid(fn()=>ClipConfiguration::normalize(['text_style'=>['flower'=>'unknown']]),'reject arbitrary cloud effects');
invalid(fn()=>ClipConfiguration::normalize(['public_music_id'=>'https://evil.example/music']),'reject arbitrary music URLs');
$musicId='icepublic-12345678';$c=ClipConfiguration::normalize(['public_music_id'=>$musicId]+array_diff_key($base,['music_ids'=>true]));$p=(new ClipPlanner('music'))->build($c,$assets);$t=ClipImsTimeline::compile($p,$media);check($t['AudioTracks'][0]['AudioTrackClips'][0]['MediaId']===$musicId&&!isset($t['AudioTracks'][0]['AudioTrackClips'][0]['MediaURL']),'copyright music uses formal MediaId');
final class MusicTransport implements ClipCloudTransport{
 public bool $authorized=true;public string $days='20';public array $calls=[];
 public function rpc(array $c,string $a,array $p):array{$this->calls[]=[$a,$p];return ['TotalCount'=>1,'PublicMediaInfos'=>[['Authorized'=>$this->authorized,'RemainingAuthTime'=>$this->days,'MediaInfo'=>['MediaId'=>'icepublic-12345678','MediaBasicInfo'=>['Title'=>'Test','MediaType'=>'audio']]]]];}
 public function json(string $u,array $h,array $b):array{return [];}
 public function upload(array $c,string $b,string $k,string $p):void{}
 public function signed(array $c,string $b,string $k,int $ttl=900):string{return '';}
 public function downloadSpeech(string $u,string $p):void{}
}
$transport=new MusicTransport();$music=new ClipPublicMusic($transport);$music->assertAuthorized([],$musicId);check($transport->calls[0][1]['MediaIds']===$musicId,'authorization rechecks exact selected media');$transport->days='0';invalid(fn()=>$music->assertAuthorized([],$musicId),'expired music blocked');$transport->days='20';$transport->authorized=false;invalid(fn()=>$music->assertAuthorized([],$musicId),'unlicensed music blocked');
$r=['kind'=>14,'cost_cents'=>100,'details_json'=>json_encode(['cost2_price'=>'2.50','cost3_price'=>0])];$options=PressPriceOptions::costs($r);check(count($options)===2&&$options[2]['cost_cents']===250,'Weibo prices preserve separate cents');
$r['kind']=13;$r['cost_cents']=0;check(array_keys(PressPriceOptions::costs($r))===[2],'alternate-only resource can be quoted');$r['kind']=1;check(PressPriceOptions::costs($r)===[],'unsupported category cannot fabricate alternate price');
invalid(fn()=>PressPriceOptions::types(['price_types'=>[3=>9]],[3]),'invalid publish tier rejected');
use app\common\service\merchant\clip\{ClipIntelligence,ClipCloudTemplates,ClipCloudFailure};
use app\common\service\merchant\geo\{BochaSearch,DeepSeekText,PartnerVisibility,PartnerWorkspace};
use app\common\service\merchant\TaskWechatReceipt;
use EasyWeChat\Kernel\Encryptor;
function rejected(callable $f,string $label):void{try{$f();}catch(Throwable){check(true,$label);return;}throw new RuntimeException($label);}
final class ExtensionTransport implements ClipCloudTransport{
 public array $calls=[];public array $response=[];
 public function rpc(array $c,string $a,array $p):array{$this->calls[]=[$a,$p];return $this->response;}
 public function json(string $u,array $h,array $b):array{return [];}
 public function upload(array $c,string $b,string $k,string $p):void{}
 public function signed(array $c,string $b,string $k,int $ttl=900):string{return 'https://owned.example/'.$k.'?signed';}
 public function downloadSpeech(string $u,string $p):void{}
}
$ext=new ExtensionTransport();$intelligence=new ClipIntelligence($ext);$ext->response=['JobId'=>'smart-id'];
$cfg=['settings'=>['region'=>'cn-shanghai','bucket'=>'owned-bucket','output_bucket'=>'result-bucket','project'=>'owned-project','template_ids'=>'template123']];
$input=ClipIntelligence::normalize(['function'=>'MusicDemix'])+['material_id'=>3];$intelligence->submit($cfg,$cfg,$input,[3=>['key'=>'t1/u2/job/input.mp3']],'t1/u2/job/smart','token');$args=end($ext->calls)[1];
check(json_decode($args['Input'],true)['Media']==='oss://owned-bucket/t1/u2/job/input.mp3','smart source built only from staged owned key');
check(str_contains(json_decode($args['Output'],true)['Media'],'{sequenceId}-{resultType}.wav'),'demix outputs cannot overwrite each other');
invalid(fn()=>ClipIntelligence::normalize(['function'=>'arbitrary']),'unknown processing function blocked');
invalid(fn()=>ClipIntelligence::normalize(['function'=>'AudioMixing','second_material_id'=>'https://evil.example']),'mixing rejects remote second track');
$r=ClipIntelligence::result(['FunctionName'=>'Cover','Status'=>'Success','OutputFiles'=>['t1/u2/job/smart/1.png']],'Cover','t1/u2/job/smart');check($r['state']==='success','smart owned result downloadable');
rejected(fn()=>ClipIntelligence::result(['FunctionName'=>'Cover','Status'=>'Success','OutputFiles'=>['t1/u999/job/smart/1.png']],'Cover','t1/u2/job/smart'),'foreign smart result never signed');
rejected(fn()=>ClipIntelligence::result(['FunctionName'=>'Cover','Status'=>'Success','OutputFiles'=>['t1/u2/job/smart/../other.png']],'Cover','t1/u2/job/smart'),'smart traversal rejected');
$r=ClipIntelligence::result(['FunctionName'=>'AudioQualityAssessment','Status'=>'Success','Result'=>json_encode([['MOS'=>'Good','Input'=>'/private/provider/path']])],'AudioQualityAssessment','t1/u2/job/smart');check(!isset($r['details'][0]['Input'])&&$r['details'][0]['MOS']==='Good','quality result strips provider private paths');
$ext->response=['OCRTexts'=>'真实文字'];check($intelligence->image($cfg,$cfg,['material_id'=>2],[2=>['key'=>'t1/u2/input.png']],true)['text']==='真实文字','OCR uses official OCRTexts field');
$ext->response=['Labels'=>[['LabelName'=>'门店','LabelConfidence'=>0.95],['LabelName'=>'低置信度','LabelConfidence'=>0.1]]];check(count($intelligence->image($cfg,$cfg,['material_id'=>2],[2=>['key'=>'t1/u2/input.png']],false)['labels'])===1,'labels enforce confidence before review');
$row=['TemplateId'=>'template123','Type'=>'Timeline','Status'=>'Available','Name'=>'Test','Config'=>'{}','ClipsParam'=>'{"Text1":"text","Media1":"mediaId"}'];$schema=ClipCloudTemplates::schema($row);
invalid(fn()=>ClipCloudTemplates::values($schema,['Text1'=>'Text','Media1'=>'https://foreign.example/a']),'template rejects browser URLs');
invalid(fn()=>ClipCloudTemplates::values($schema,['Text1'=>'Text','Media1'=>1,'arbitrary'=>'x']),'template rejects undeclared slot');
$ext->response=['Template'=>$row];$templates=new ClipCloudTemplates($ext);invalid(fn()=>$templates->detail($cfg,'private-template'),'merchant cannot query unpublished cloud template');
$bad=$row;$bad['ClipsParam']='{"Nested":{"x":"mediaId"}}';invalid(fn()=>ClipCloudTemplates::schema($bad),'unsupported template schema rejected explicitly');
$bad=$row;$bad['Config']='{"changed":true}';check(ClipCloudTemplates::schema($bad)['fingerprint']!==$schema['fingerprint'],'template change changes execution fingerprint');
$captured=[];$bocha=new BochaSearch(function($p,$k)use(&$captured){$captured=$p;return ['status'=>200,'body'=>['code'=>200,'data'=>['webPages'=>['value'=>[['name'=>'Example','url'=>'https://example.org','summary'=>'fact'],['url'=>'http://127.0.0.1/x']]],'images'=>['value'=>[['name'=>'Picture','contentUrl'=>'https://example.org/image.jpg','hostPageUrl'=>'https://example.org/source'],['contentUrl'=>'javascript:alert(1)','hostPageUrl'=>'https://example.org']]]]]];});
$result=$bocha->search(['credentials'=>['api_key'=>'fixture']],'query',['freshness'=>'oneWeek','count'=>50]);check($captured['freshness']==='oneWeek'&&$captured['count']===50,'search controls reach paid request');check(count($result['images'])===1&&count($result['items'])===1,'unsafe search and image URLs removed');invalid(fn()=>BochaSearch::options(['count'=>51]),'search count bound enforced');
$deepPayload=[];$deep=new DeepSeekText(function($m,$u,$p,$h)use(&$deepPayload){$deepPayload=$p;return ['status'=>200,'body'=>['id'=>'fixture','model'=>'deepseek-flash','choices'=>[['message'=>['content'=>'final','reasoning_content'=>'private thought'],'finish_reason'=>'stop']],'usage'=>['prompt_tokens'=>10,'completion_tokens'=>20]]];});
$result=$deep->generate('fixture',[['role'=>'user','content'=>'question']],'',100,['enable_thinking'=>true],30);check($deepPayload['thinking']['type']==='enabled'&&$result['content']==='final'&&!isset($result['reasoning_content']),'thinking emits final content and preserves billed usage');check($result['usage']['completion_tokens']===20,'thinking completion usage kept for settlement');
foreach(['/brands','/brands/brand123/questions','/brands/brand123/runs','/brands/brand123/overview?days=30','/brands/brand123/sources','/runs/run12345/report','/screenshots/asset123']as $path)check(PartnerVisibility::pathAllowed('GET','/api/v1'.$path),'GEO allows documented '.$path);
check(!PartnerVisibility::pathAllowed('GET','/api/v1/brands/../usage')&&!PartnerVisibility::pathAllowed('GET','/api/v1/brands?token=x'),'GEO rejects arbitrary path and credential query');
$partnerCalls=[];$partner=new PartnerVisibility(function($m,$p,$body,$headers)use(&$partnerCalls){$partnerCalls[]=[$m,$p,$body,$headers];return ['status'=>$m==='POST'?201:200,'body'=>['id'=>'brand123']];});$workspace=new PartnerWorkspace($partner);
$workspace->execute(['settings'=>['api_origin'=>'https://118.89.28.187'],'credentials'=>['api_key'=>'fixture']],['action'=>'create_brand','name'=>'Example','confirmed'=>true,'request_key'=>'request_fixture_123']);check($partnerCalls[0][1]==='/api/v1/brands'&&in_array('Idempotency-Key: request_fixture_123',$partnerCalls[0][3],true),'GEO brand creation authenticated and idempotent');
$app='wx1234567890123456';$token='receiptFixture';$aes=rtrim(base64_encode(str_repeat('a',32)),'=');$config=['settings'=>['appid'=>$app],'credentials'=>['callback_token'=>$token,'callback_aes'=>$aes]];$stamp=(string)time();$nonce='fixture';
$xml='<xml><MsgType>event</MsgType><Event>TEMPLATESENDJOBFINISH</Event><FromUserName>openid_fixture</FromUserName><MsgID>123456789</MsgID><Status>success</Status><CreateTime>'.$stamp.'</CreateTime></xml>';
$encryption=(new Encryptor($app,$token,$aes,$app))->encryptAsArray($xml,$nonce,$stamp);$raw='<xml><Encrypt><![CDATA['.$encryption['ciphertext'].']]></Encrypt></xml>';$query=['timestamp'=>$stamp,'nonce'=>$nonce,'msg_signature'=>$encryption['signature']];
$receipt=TaskWechatReceipt::decode($config,$raw,$query,false);check($receipt['state']==='delivered'&&$receipt['recipient_hash']===hash('sha256',$app.':openid_fixture'),'encrypted receipt bound to app and recipient');
rejected(fn()=>TaskWechatReceipt::decode($config,$raw,array_replace($query,['msg_signature'=>str_repeat('0',40)]),false),'forged receipt rejected');
rejected(fn()=>TaskWechatReceipt::decode($config,$xml,$query,false),'plaintext receipt cannot change delivery status');
$wrong=$config;$wrong['settings']['appid']='wx9999999999999999';rejected(fn()=>TaskWechatReceipt::decode($wrong,$raw,$query,false),'cross-app ciphertext rejected');
$filterConfig=ClipConfiguration::normalize($base+['filter_pool'=>['bright','soft']]);$one=(new ClipPlanner('stable-filter'))->build($filterConfig,$assets);$two=(new ClipPlanner('stable-filter'))->build($filterConfig,$assets);check($one['shots']===$two['shots']&&isset($one['shots'][0]['filter_id']),'filter choices frozen in deterministic saved plan');$t=ClipImsTimeline::compile($one,$media);$e=$t['VideoTracks'][0]['VideoTrackClips'][0]['Effects'];$filters=array_values(array_filter($e,fn($e)=>$e['Type']==='Filter'));check(json_decode($filters[0]['ExtParams'],true)===$one['shots'][0]['colors'],'selected per-shot filter reaches vendor timeline');invalid(fn()=>ClipConfiguration::normalize(['filter_pool'=>['foreign']]),'unknown filter pool entry rejected');
$ext->response=['MediaInfo'=>['MediaId'=>$musicId,'DynamicMetaData'=>['Data'=>json_encode(['AuditionUrl'=>'oss://provider-preview/music.mp3'])],'FileInfoList'=>[['FileBasicInfo'=>['FileUrl'=>'https://provider.example/music.mp3?signature=fixture']]]]];$preview=(new ClipPublicMusic($ext))->preview([],$musicId);check(str_starts_with($preview['preview_url'],'https://provider.example/'),'internal audition URI falls back to provider-issued HTTPS preview');$ext->response['MediaInfo']['FileInfoList']=[];invalid(fn()=>(new ClipPublicMusic($ext))->preview([],$musicId),'internal OSS preview never exposed as browser playable URL');
echo "Completed $n checks; no network or database writes.\n";
