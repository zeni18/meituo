<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use InvalidArgumentException as Invalid;
use think\facade\Db;

/** Authenticated store-page drafts. This service does not publish or grant platform capabilities. */
final class MerchantStoreDesignService
{
    public const TYPES=['notice','store','title','navigation','product','cube','community','floating'];
    public static function catalog():array {
        $groups=[
            ['video','视频发布',[['douyin','抖音','发抖音'],['kuaishou','快手','发快手'],['xiaohongshu','小红书','小红书'],['channels','视频号','视频号']]],
            ['review','打卡/点评/收藏',[['dianping','点评+打卡','点评+打卡'],['douyin','点评+收藏','点评+收藏'],['amap','点评+收藏','点评+收藏'],['baidu','点评+收藏','点评+收藏'],['meituan','点评+收藏','点评+收藏'],['ctrip','点评+收藏','点评+收藏'],['scenic','景区点评','景区点评']]],
            ['notes','图文发布',[['moments','朋友圈(图文)','发朋友圈'],['xiaohongshu','小红书(笔记)','小红书图文'],['ctrip','携程(笔记)','携程笔记'],['dianping','大众点评','大众点评']]],
            ['follow','关注账号',[['douyin','关注抖音','关注抖音'],['kuaishou','关注快手','关注快手'],['xiaohongshu','关注小红书','关注小红书'],['channels','关注视频号','关注视频号'],['wechat','关注公众号','关注公众号']]],
            ['like','点赞/分享',[['douyin','抖音','抖音'],['channels','视频号','视频号']]],
            ['service','连WIFI&加微信',[['wifi','连WIFI','连WIFI'],['wechat','加微信','加微信'],['drive','叫代驾','叫代驾']]],
            ['deals','优惠团购',[['meituan','美团团购','美团团购'],['douyin','抖音团购','抖音团购'],['dianping','大众点评','大众点评']]],
        ];$out=[];foreach($groups as [$key,$title,$items]){$rows=[];foreach($items as [$platform,$label,$text]){$code=$key.'_'.$platform;$rows[]=['code'=>$code,'platform'=>$platform,'label'=>$label,'title'=>$text,'enabled'=>!in_array($code,['review_ctrip','review_scenic','notes_ctrip','like_douyin','like_channels'],true)];}$out[]=['key'=>$key,'title'=>$title,'items'=>$rows];}return $out;
    }
    private static function num(mixed $value,int $min,int $max):int {
        if(!is_int($value)&&!(is_string($value)&&preg_match('/^-?\d+$/D',$value)))throw new Invalid('数字字段格式不正确');$v=(int)$value;if($v<$min||$v>$max)throw new Invalid('数值超出范围');return $v;
    }
    private static function text(mixed $value,int $max):string {
        if(!is_string($value)||!mb_check_encoding($value,'UTF-8')||mb_strlen($value)>$max)throw new Invalid('文字长度或格式不正确');return trim($value);
    }
    private static function store(int $tenant,int $user,int $id,bool $lock=false):array {
        $s=Db::name('oem_merchant_store')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id,'delete_time'=>0])->lock($lock)->find();if(!$s)throw new Invalid('门店不存在或无访问权限');
        $m=Db::name('oem_merchant_store_meta')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$id])->find()?:[];return $s+array_intersect_key($m,array_flip(['logo_file_id','province','city','district','decoration']));
    }
    private static function value(mixed $v,array $spec,int $tenant,int $user,array &$files):mixed {
        switch($spec[0]){
            case 'text':return self::text($v,$spec[2]);
            case 'number':return self::num($v,$spec[2],$spec[3]);
            case 'bool':if(!in_array($v,[true,false,0,1,'0','1'],true))throw new Invalid('开关格式不正确');return (bool)$v;
            case 'enum':if(!is_string($v)||!in_array($v,$spec[2],true))throw new Invalid('选项不正确');return $v;
            case 'color':$v=self::text($v,16);if($v!==''&&$v!=='transparent'&&!preg_match('/^#[a-f0-9]{6}$/iD',$v))throw new Invalid('颜色格式不正确');return $v;
            case 'url':$v=self::text($v,2048);if($v!==''&&(!filter_var($v,FILTER_VALIDATE_URL)||!in_array(strtolower((string)parse_url($v,PHP_URL_SCHEME)),['http','https'],true)||parse_url($v,PHP_URL_USER)!==null||parse_url($v,PHP_URL_PASS)!==null))throw new Invalid('链接仅支持不含账号密码的HTTP或HTTPS地址');return $v;
            case 'image':$id=self::num($v,0,PHP_INT_MAX);if($id&&!isset($files[$id])){if(count($files)>=160)throw new Invalid('图片数量超出限制');$files[$id]=MerchantWorkspaceService::files($tenant,$user,[$id],'image')[0];}return $id;
        }throw new Invalid('字段类型不正确');
    }
    private static function fields(mixed $input,array $schema,int $tenant,int $user,array &$files):array {
        if(!is_array($input))throw new Invalid('设置格式不正确');$out=[];foreach($schema as $k=>$spec)$out[$k]=self::value($input[$k]??$spec[1],$spec,$tenant,$user,$files);return $out;
    }
    public static function componentSchema(string $type):array {
        $common=['background'=>['color',''],'color'=>['color',''],'margin'=>['number',10,0,20],'padding'=>['number',12,0,30],'radius'=>['number',12,0,30]];
        $types=[
            'notice'=>['text'=>['text','欢迎光临本店',500],'style'=>['enum','one',['one','two']]],
            'store'=>['title'=>['text','',80],'description'=>['text','',200],'background_file_id'=>['image',0],'logo_file_id'=>['image',0],'style'=>['number',1,1,5],'overlay'=>['bool',true],'show_phone'=>['bool',true],'show_address'=>['bool',true],'show_hours'=>['bool',true]],
            'title'=>['title'=>['text','标题文字',100],'description'=>['text','',100],'title_size'=>['number',16,12,32],'title_weight'=>['number',600,200,800],'description_size'=>['number',12,10,24],'description_weight'=>['number',400,200,800],'description_color'=>['color',''],'align'=>['enum','left',['left','center','right']],'height'=>['number',24,20,100],'divider'=>['bool',false],'more'=>['bool',false],'url'=>['url','']],
            'navigation'=>['columns'=>['number',5,2,5],'text_size'=>['number',12,10,24],'text_height'=>['number',24,24,50],'image_radius'=>['number',0,0,50],'scroll'=>['bool',false]],
            'product'=>['layout'=>['enum','two',['big','two','three','list','featured','scroll']],'grouping'=>['bool',false],'source'=>['enum','manual',['manual','douyin','meituan','dianping']],'weight'=>['number',400,200,800],'image_radius'=>['number',10,0,30],'gap'=>['number',10,0,20],'show_price'=>['bool',true],'show_button'=>['bool',true],'button_text'=>['text','查看详情',6],'badge'=>['bool',false],'badge_text'=>['enum','新品',['新品','热卖','NEW','HOT']],'badge_color'=>['color','#f45d69'],'badge_position'=>['enum','top-left',['top-left','bottom-left','top-right','bottom-right']]],
            'cube'=>['layout'=>['enum','two',['one','two','three','four','grid','leftTwo','topTwo','leftThree']],'gap'=>['number',5,0,20]],
            'community'=>['image_file_id'=>['image',0],'mode'=>['enum','qr',['qr','phone']],'title'=>['text','加入门店社群',40],'description'=>['text','了解更多门店资讯',80],'button_text'=>['text','查看',6],'qr_file_id'=>['image',0],'phone'=>['text','',32]],
            'floating'=>['image_file_id'=>['image',0],'text'=>['text','联系我们',12],'mode'=>['enum','url',['url','builtin','phone']],'url'=>['url',''],'target'=>['text','',64],'phone'=>['text','',32],'position'=>['enum','right',['left','right']],'bottom'=>['number',30,0,300]],
        ];if(!isset($types[$type]))throw new Invalid('组件类型不正确');return $common+$types[$type];
    }
    private static function codes():array {return array_merge(...array_map(fn($g)=>array_column($g['items'],'code'),self::catalog()));}
    private static function featureCodes(mixed $value):array {
        if(!is_array($value)||!array_is_list($value)||count($value)>count(self::codes()))throw new Invalid('功能列表格式不正确');
        $seen=[];foreach($value as $code){if(!is_string($code)||!in_array($code,self::codes(),true)||isset($seen[$code]))throw new Invalid('功能标识重复或不正确');$seen[$code]=true;}return $value;
    }
    public static function normalize(int $tenant,int $user,mixed $input,array &$files=[]):array {
        if(!is_array($input)||strlen(json_encode($input,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR))>262144)throw new Invalid('装修配置格式不正确或内容过大');$files=[];
        $out=['version'=>1,'style'=>self::value($input['style']??'one',['enum','one',['one','two','custom']],$tenant,$user,$files)];
        $out['header']=self::fields($input['header']??[],['title'=>['text','发布任务 领福利',20],'subtitle'=>['text','发现门店好内容',20],'background_file_id'=>['image',0]],$tenant,$user,$files);
        $out['page']=self::fields($input['page']??[],['accent'=>['color','#8a3ffc'],'background'=>['color','#eaf4ff'],'color'=>['color','#17212f'],'background_file_id'=>['image',0],'blur'=>['bool',false]],$tenant,$user,$files);
        $out['link']=self::fields($input['link']??[],['enabled'=>['bool',false],'title'=>['text','自定义标题',40],'description'=>['text','自定义描述',80],'button_text'=>['text','点击跳转',12],'url'=>['url','']],$tenant,$user,$files);
        $features=$input['features']??[];if(!is_array($features))throw new Invalid('功能设置不正确');$out['features']=[];foreach(self::catalog() as $group)foreach($group['items'] as $item)$out['features'][$item['code']]=self::value($features[$item['code']]??$item['enabled'],['bool',true],$tenant,$user,$files);
        $front=$input['storefront']??[];if(!is_array($front))throw new Invalid('门店外观设置格式不正确');
        $out['storefront']=self::fields($front,[
            'enabled'=>['bool',true],'hero_template'=>['enum','modern',['modern','bright','night','warm']],
            'tagline'=>['text','欢迎光临，感谢您的到来',80],'hero_size'=>['enum','large',['large','compact']],
            'show_favorite'=>['bool',true],'show_deals'=>['bool',true],
            'primary_feature'=>['enum','video_douyin',array_merge([''],self::codes())],
            'primary_style'=>['enum','platform',['platform','black']],
        ],$tenant,$user,$files);
        $order=self::featureCodes($front['order']??[]);
        $out['storefront']['order']=array_merge($order,array_values(array_diff(self::codes(),$order)));
        $out['storefront']['full_width']=self::featureCodes($front['full_width']??[]);
        if($out['storefront']['primary_feature']!==''&&!$out['features'][$out['storefront']['primary_feature']])$out['storefront']['primary_feature']='';
        $components=$input['components']??[];if(!is_array($components)||!array_is_list($components)||count($components)>40)throw new Invalid('组件最多40个');$out['components']=[];$seen=[];
        foreach($components as $c){if(!is_array($c))throw new Invalid('组件格式不正确');$id=self::text($c['id']??'',64);if(!preg_match('/^[a-zA-Z0-9_-]{8,64}$/D',$id)||isset($seen[$id]))throw new Invalid('组件标识重复或不正确');$seen[$id]=true;$type=$c['type']??'';if(!is_string($type)||!in_array($type,self::TYPES,true))throw new Invalid('组件类型不正确');
            $entry=['id'=>$id,'type'=>$type,'enabled'=>self::value($c['enabled']??true,['bool',true],$tenant,$user,$files),'settings'=>self::fields($c['settings']??[],self::componentSchema($type),$tenant,$user,$files),'items'=>[]];
            $items=$c['items']??[];if(!is_array($items)||!array_is_list($items)||count($items)>($type==='product'?30:20))throw new Invalid('组件条目数量或格式不正确');if($items&&!in_array($type,['navigation','product','cube'],true))throw new Invalid('该组件不支持条目');
            foreach($items as $item){$schema=['title'=>['text','',80],'image_file_id'=>['image',0],'url'=>['url',''],'target'=>['text','',64]];if($type==='product')$schema+=['price'=>['text','0.00',12],'tags'=>['text','',40],'group'=>['text','',30]];$i=self::fields($item,$schema,$tenant,$user,$files);if($i['target']!==''&&!in_array($i['target'],self::codes(),true))throw new Invalid('内置入口不正确');if($type==='product'&&!preg_match('/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/D',$i['price']))throw new Invalid('商品价格格式不正确');$entry['items'][]=$i;}
            if($type==='floating'&&$entry['settings']['target']!==''&&!in_array($entry['settings']['target'],self::codes(),true))throw new Invalid('内置入口不正确');$out['components'][]=$entry;
        }return $out;
    }
    public static function load(int $tenant,int $user,array $p):array {
        $id=self::num($p['store_id']??0,1,PHP_INT_MAX);$store=self::store($tenant,$user,$id);$saved=Db::name('oem_merchant_store_design')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$id])->find();$raw=$saved?json_decode($saved['config'],true):[];
        if(!$saved){$old=json_decode($store['decoration']??'{}',true)?:[];if($old){$raw=['page'=>['accent'=>$old['accent']??'#8a3ffc'],'header'=>['subtitle'=>mb_substr($old['subtitle']??'',0,20)],'style'=>'custom','components'=>[['id'=>'legacy_store','type'=>'store','settings'=>['description'=>mb_substr($old['introduction']??'',0,200),'show_phone'=>$old['show_phone']??1,'show_address'=>$old['show_address']??1,'show_hours'=>$old['show_hours']??1]]]];}}
        $files=[];$config=self::normalize($tenant,$user,$raw,$files);if(!empty($store['logo_file_id']))try{$files[(int)$store['logo_file_id']]=MerchantWorkspaceService::files($tenant,$user,[(int)$store['logo_file_id']],'image')[0];}catch(Invalid $e){}
        unset($store['decoration']);return ['store'=>$store,'config'=>$config,'revision'=>(int)($saved['revision']??0),'update_time'=>(int)($saved['update_time']??0),'files'=>array_values($files),'catalog'=>self::catalog(),'schemas'=>array_combine(self::TYPES,array_map(fn($type)=>self::componentSchema($type),self::TYPES))];
    }
    public static function save(int $tenant,int $user,array $p):array {
        $files=[];$config=self::normalize($tenant,$user,$p['config']??null,$files);$id=self::num($p['store_id']??0,1,PHP_INT_MAX);$revision=self::num($p['revision']??0,0,PHP_INT_MAX);
        return Db::transaction(function()use($tenant,$user,$id,$revision,$config){self::store($tenant,$user,$id,true);$w=['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$id];$old=Db::name('oem_merchant_store_design')->where($w)->lock(true)->find();if((int)($old['revision']??0)!==$revision)throw new Invalid('装修已在其他页面修改，请重新载入后再保存');$data=['config'=>json_encode($config,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'revision'=>$revision+1,'update_time'=>time()];if($old)Db::name('oem_merchant_store_design')->where($w)->update($data);else Db::name('oem_merchant_store_design')->insert($data+$w);return ['revision'=>$revision+1,'update_time'=>$data['update_time']];});
    }
    public static function templates(int $tenant,int $user,array $p):array {
        $q=Db::name('oem_merchant_store_design_template')->where(['tenant_id'=>$tenant,'user_id'=>$user])->where('delete_time',($p['trash']??'')==='1'?'>':'=',0);$word=self::text($p['keyword']??'',60);if($word!=='')$q->whereLike('name','%'.addcslashes($word,'%_\\').'%');$count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/20))));$rows=$q->order('id desc')->page($page,20)->select()->toArray();foreach($rows as &$row)$row['config']=json_decode($row['config'],true);unset($row);return ['lists'=>$rows,'count'=>$count,'page'=>$page];
    }
    public static function saveTemplate(int $tenant,int $user,array $p):array {
        $files=[];$config=self::normalize($tenant,$user,$p['config']??null,$files);$name=self::text($p['name']??'',60);if($name==='')throw new Invalid('请填写模板名称');$id=self::num($p['id']??0,0,PHP_INT_MAX);$revision=self::num($p['revision']??0,0,PHP_INT_MAX);
        return Db::transaction(function()use($tenant,$user,$p,$id,$name,$revision,$config){$w=['tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0];$owner=Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user])->lock(true)->find();if(!$owner)throw new Invalid('商家身份不正确');$old=$id?Db::name('oem_merchant_store_design_template')->where($w)->where('id',$id)->lock(true)->find():null;if($id&&!$old)throw new Invalid('模板不存在或无访问权限');if((int)($old['revision']??0)!==$revision)throw new Invalid('模板版本已变化，请重新载入');if(!$id&&Db::name('oem_merchant_store_design_template')->where($w)->count()>=100)throw new Invalid('模板最多100个');$data=['name'=>$name,'config'=>json_encode($config,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'revision'=>$revision+1,'update_time'=>time()];if($old)Db::name('oem_merchant_store_design_template')->where($w)->where('id',$id)->update($data);else $id=(int)Db::name('oem_merchant_store_design_template')->insertGetId($data+$w+['create_time'=>time()]);return ['id'=>$id,'revision'=>$revision+1];});
    }
    public static function template(int $tenant,int $user,array $p):array {
        $row=Db::name('oem_merchant_store_design_template')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>self::num($p['id']??0,1,PHP_INT_MAX),'delete_time'=>0])->find();if(!$row)throw new Invalid('模板不存在或无访问权限');$files=[];$config=self::normalize($tenant,$user,json_decode($row['config'],true),$files);return ['config'=>$config,'files'=>array_values($files)];
    }
    public static function recycleTemplate(int $tenant,int $user,array $p):void {
        $restore=($p['restore']??'')==='1';$id=self::num($p['id']??0,1,PHP_INT_MAX);if(!Db::name('oem_merchant_store_design_template')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id])->where('delete_time',$restore?'>':'=',0)->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]))throw new Invalid('模板不存在或无访问权限');
    }
}
