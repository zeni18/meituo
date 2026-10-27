<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use InvalidArgumentException as Invalid;
use think\facade\Db;

/** Store directory extensions keep the existing store IDs and merchant ownership. */
final class MerchantStoreService
{
    private static function stores(int $tenant,int $user,bool $trash=false){return Db::name('oem_merchant_store')->where(['tenant_id'=>$tenant,'user_id'=>$user])->where('delete_time',$trash?'>':'=',0);}
    private static function owned(int $tenant,int $user,int $id,bool $lock=false):array{$row=self::stores($tenant,$user)->where('id',$id)->lock($lock)->find();if(!$row)throw new Invalid('门店不存在或无访问权限');return $row;}
    private static function text(array $p,string $key,int $max):string{if(isset($p[$key])&&!is_string($p[$key]))throw new Invalid('文字字段格式不正确');$v=trim($p[$key]??'');if(!mb_check_encoding($v,'UTF-8')||mb_strlen($v)>$max)throw new Invalid('字段编码或长度不正确：'.$key);return $v;}
    private static function id(mixed $v):int{if(!is_int($v)&&!(is_string($v)&&ctype_digit($v)))throw new Invalid('记录标识不正确');if((int)$v<0)throw new Invalid('记录标识不正确');return (int)$v;}
    private static function date(mixed $value):?int{if($value===null||$value==='')return null;if(!is_string($value))throw new Invalid('日期格式不正确');$d=\DateTimeImmutable::createFromFormat('!Y-m-d',$value,new \DateTimeZone('Asia/Shanghai'));if(!$d||$d->format('Y-m-d')!==$value)throw new Invalid('日期格式不正确');return $d->getTimestamp();}
    private static function meta(int $tenant,int $user,int $store):array{return Db::name('oem_merchant_store_meta')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$store])->find()?:[];}
    private static function writeMeta(int $tenant,int $user,int $store,array $patch):void{
        $where=['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$store];$patch['update_time']=time();
        if(Db::name('oem_merchant_store_meta')->where($where)->find())Db::name('oem_merchant_store_meta')->where($where)->update($patch);
        else Db::name('oem_merchant_store_meta')->insert($patch+$where+['decoration'=>'{}']);
    }
    private static function decorate(int $tenant,int $user,array $row):array{
        $meta=self::meta($tenant,$user,(int)$row['id']);foreach(['logo_file_id'=>0,'province'=>'','city'=>'','district'=>'','coordinates'=>'','poi_id'=>'','expire_time'=>0] as $k=>$v)$row[$k]=$meta[$k]??$v;
        $row['decoration']=json_decode($meta['decoration']??'{}',true)?:[];$row['logo']=null;
        if($row['logo_file_id'])try{$row['logo']=MerchantWorkspaceService::files($tenant,$user,[(int)$row['logo_file_id']],'image')[0]??null;}catch(Invalid $e){}
        $row['staff_count']=Db::name('oem_merchant_store_staff')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$row['id'],'delete_time'=>0])->count();$row['brand_id']=(int)Db::name('oem_brand_store')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$row['id']])->value('brand_id');return $row;
    }
    public static function listing(int $tenant,int $user,array $p):array{
        $q=self::stores($tenant,$user,($p['trash']??'')==='1');if(isset($p['brand_id'])&&$p['brand_id']!==''){$brand=self::id($p['brand_id']);MerchantBrandService::owned($tenant,$user,$brand);$q->whereIn('id',function($sub)use($tenant,$user,$brand){$sub->name('oem_brand_store')->where(['tenant_id'=>$tenant,'user_id'=>$user,'brand_id'=>$brand])->field('store_id');});}$word=self::text($p,'keyword',80);if($word!=='')$q->whereLike('name','%'.addcslashes($word,'%_\\').'%');
        if(isset($p['status'])&&$p['status']!==''){if(!in_array((string)$p['status'],['0','1'],true))throw new Invalid('状态不正确');$q->where('status',(int)$p['status']);}
        $from=self::date($p['date_from']??null);$to=self::date($p['date_to']??null);if($from!==null&&$to!==null&&$from>$to)throw new Invalid('开始日期不能晚于结束日期');if($from!==null)$q->where('create_time','>=',$from);if($to!==null)$q->where('create_time','<',$to+86400);
        $size=(int)($p['page_size']??10);if(!in_array($size,[10,20,50],true))$size=10;$count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/$size))));
        $rows=$q->order('id desc')->page($page,$size)->select()->toArray();return ['lists'=>array_map(fn($r)=>self::decorate($tenant,$user,$r),$rows),'count'=>$count,'page'=>$page,'page_size'=>$size,'capabilities'=>['renewal_request'=>true,'nfc_request'=>true,'nfc_activation'=>false,'notifications'=>false,'decoration_publish'=>false,'staff_binding'=>false]];
    }
    public static function save(int $tenant,int $user,array $p):int{
        return Db::transaction(function()use($tenant,$user,$p){
            $id=self::id($p['id']??0);if($id)self::owned($tenant,$user,$id,true);self::text($p,'name',80);
            $patch=[];foreach(['province'=>50,'city'=>50,'district'=>50,'coordinates'=>64,'poi_id'=>128] as $key=>$max)if(array_key_exists($key,$p))$patch[$key]=self::text($p,$key,$max);
            if(($patch['coordinates']??'')!==''){
                if(!preg_match('/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/u',$patch['coordinates'],$m)||abs((float)$m[1])>90||abs((float)$m[2])>180)throw new Invalid('坐标请填写有效的纬度,经度');
                $patch['coordinates']=$m[1].','.$m[2];
            }
            if(array_key_exists('logo_file_id',$p)){$patch['logo_file_id']=self::id($p['logo_file_id']);if($patch['logo_file_id'])MerchantWorkspaceService::files($tenant,$user,[$patch['logo_file_id']],'image');}
            // Expiry, NFC credentials and publication cannot be changed by a merchant data form.
            $id=MerchantWorkspaceService::save($tenant,$user,'store',$p);self::writeMeta($tenant,$user,$id,$patch);
            if(array_key_exists('brand_id',$p))MerchantBrandService::assignStore($tenant,$user,$id,self::id($p['brand_id']));
            else MerchantBrandService::assignDefaultStore($tenant,$user,$id);
            return $id;
        });
    }
    public static function createMany(int $tenant,int $user,array $p):array{
        $rows=$p['rows']??null;if(!is_array($rows)||!array_is_list($rows)||!count($rows)||count($rows)>100)throw new Invalid('每批请提交1至100家门店');
        return Db::transaction(function()use($tenant,$user,$rows,$p){$ids=[];foreach($rows as $i=>$row){if(!is_array($row))throw new Invalid('第'.($i+1).'行格式不正确');$clean=array_intersect_key($row,array_flip(['name','mobile','address','business_hours','poi_id']));try{$ids[]=self::save($tenant,$user,$clean+['id'=>0,'status'=>1,'logo_file_id'=>0]+(isset($p['brand_id'])?['brand_id'=>$p['brand_id']]:[]));}catch(Invalid $e){throw new Invalid('第'.($i+1).'行：'.$e->getMessage());}}return ['ids'=>$ids,'count'=>count($ids)];});
    }
    public static function importPreview($file):array{
        if(!$file||$file->getSize()>2*1024*1024)throw new Invalid('请上传不超过2MB的CSV或XLSX文件');$ext=strtolower($file->getOriginalExtension());$rows=[];
        if($ext==='csv'){$h=fopen($file->getPathname(),'rb');try{while(($line=fgetcsv($h,65536,',','"',''))!==false){$rows[]=$line;if(count($rows)>102)throw new Invalid('单次最多导入100家门店');}}finally{fclose($h);}}
        elseif($ext==='xlsx'){
            $zip=new \ZipArchive();if($zip->open($file->getPathname())!==true)throw new Invalid('表格文件不正确');try{$bytes=0;if($zip->numFiles>128)throw new Invalid('表格文件过于复杂');for($i=0;$i<$zip->numFiles;$i++){$entry=$zip->statIndex($i);$bytes+=(int)$entry['size'];if($bytes>8*1024*1024)throw new Invalid('表格解压内容过大');}}finally{$zip->close();}
            $reader=new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();$reader->setReadDataOnly(true);$reader->setReadFilter(new class implements \PhpOffice\PhpSpreadsheet\Reader\IReadFilter {public function readCell($columnAddress,$row,$worksheetName=''):bool{return $row<=102&&strlen($columnAddress)===1&&$columnAddress<='F';}});
            $info=$reader->listWorksheetInfo($file->getPathname());if(count($info)!==1||(int)$info[0]['totalRows']>101)throw new Invalid('请上传单工作表且不超过100家门店的模板');
            $book=$reader->load($file->getPathname());try{$sheet=$book->getSheet(0);if($sheet->getHighestDataRow()>101)throw new Invalid('单次最多导入100家门店');foreach($sheet->getRowIterator(1,min(102,$sheet->getHighestDataRow())) as $row){$line=[];foreach($row->getCellIterator('A','F') as $cell){if($cell->getDataType()==='f')throw new Invalid('请将公式粘贴为纯文本后导入');$line[]=(string)$cell->getValue();}$rows[]=$line;}}finally{$book->disconnectWorksheets();}
        }else throw new Invalid('仅支持CSV或XLSX格式');
        if(!$rows)throw new Invalid('文件为空');$headers=array_map(fn($v)=>trim(ltrim((string)$v,"\xEF\xBB\xBF")),array_shift($rows));$expected=['门店名称','电话','地址','营业时间','poi_id'];if(array_slice($headers,0,5)!==$expected)throw new Invalid('请使用门店导入模板，依次为门店名称、电话、地址、营业时间、poi_id');
        $out=[];foreach($rows as $i=>$row){if(!array_filter($row,fn($v)=>trim((string)$v)!==''))continue;$row=array_pad(array_slice($row,0,5),5,'');$data=array_combine(['name','mobile','address','business_hours','poi_id'],array_map(fn($v)=>trim((string)$v),$row));if($data['name']===''||!mb_check_encoding($data['name'],'UTF-8')||mb_strlen($data['name'])>80)throw new Invalid('第'.($i+2).'行门店名称为空或过长');foreach(['mobile'=>32,'address'=>255,'business_hours'=>100,'poi_id'=>128] as $k=>$max)if(!mb_check_encoding($data[$k],'UTF-8')||mb_strlen($data[$k])>$max)throw new Invalid('第'.($i+2).'行内容过长或非UTF-8编码');try{$data['mobile']=MerchantContactPhone::normalize($data['mobile']);}catch(Invalid $e){throw new Invalid('第'.($i+2).'行：'.$e->getMessage());}$out[]=$data;}
        if(!count($out)||count($out)>100)throw new Invalid('每批请提供1至100家门店');return ['rows'=>$out,'count'=>count($out)];
    }
    private static function staffQuery(int $tenant,int $user,int $store,bool $trash=false){return Db::name('oem_merchant_store_staff')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$store])->where('delete_time',$trash?'>':'=',0);}
    public static function staff(int $tenant,int $user,array $p):array{
        $id=self::id($p['store_id']??0);$store=self::owned($tenant,$user,$id);$q=self::staffQuery($tenant,$user,$id,($p['trash']??'')==='1');foreach(['name','mobile'] as $k){$v=self::text($p,$k,50);if($v!=='')$q->whereLike($k,'%'.addcslashes($v,'%_\\').'%');}
        $count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/20))));return ['store'=>['id'=>$id,'name'=>$store['name']],'lists'=>$q->order('id desc')->page($page,20)->select()->toArray(),'count'=>$count,'page'=>$page,'page_size'=>20];
    }
    public static function saveStaff(int $tenant,int $user,array $p):int{
        return Db::transaction(function()use($tenant,$user,$p){$store=self::id($p['store_id']??0);self::owned($tenant,$user,$store,true);$id=self::id($p['id']??0);if($id&&!self::staffQuery($tenant,$user,$store)->where('id',$id)->lock(true)->find())throw new Invalid('员工不存在或无访问权限');$name=self::text($p,'name',50);$mobile=self::text($p,'mobile',32);if($name===''||!preg_match('/^1[3-9]\d{9}$/',$mobile))throw new Invalid('请填写员工姓名及有效手机号');$status=(string)($p['status']??'1');if(!in_array($status,['0','1'],true))throw new Invalid('员工状态不正确');if(self::staffQuery($tenant,$user,$store)->where('mobile',$mobile)->where('id','<>',$id)->find())throw new Invalid('本门店已存在该手机号的员工');$data=['name'=>$name,'mobile'=>$mobile,'status'=>(int)$status,'update_time'=>time()];if($id)self::staffQuery($tenant,$user,$store)->where('id',$id)->update($data);else $id=(int)Db::name('oem_merchant_store_staff')->insertGetId($data+['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$store,'create_time'=>time()]);return $id;});
    }
    public static function recycleStaff(int $tenant,int $user,array $p):void{
        Db::transaction(function()use($tenant,$user,$p){$store=self::id($p['store_id']??0);self::owned($tenant,$user,$store,true);$restore=($p['restore']??'')==='1';$id=self::id($p['id']??0);$row=self::staffQuery($tenant,$user,$store,$restore)->where('id',$id)->lock(true)->find();if(!$row)throw new Invalid('员工不存在或无访问权限');if($restore&&self::staffQuery($tenant,$user,$store)->where('mobile',$row['mobile'])->find())throw new Invalid('本门店已存在同手机号员工，无法恢复重复资料');self::staffQuery($tenant,$user,$store,$restore)->where('id',$id)->update(['delete_time'=>$restore?0:time(),'update_time'=>time()]);});
    }
    public static function createStaffMany(int $tenant,int $user,array $p):array{
        $rows=$p['rows']??null;if(!is_array($rows)||!array_is_list($rows)||count($rows)<1||count($rows)>100)throw new Invalid('每批请提交1至100名员工');$store=self::id($p['store_id']??0);
        return Db::transaction(function()use($tenant,$user,$store,$rows){self::owned($tenant,$user,$store,true);$ids=[];foreach($rows as $i=>$row){if(!is_array($row))throw new Invalid('员工格式不正确');try{$ids[]=self::saveStaff($tenant,$user,['store_id'=>$store,'name'=>$row['name']??'','mobile'=>$row['mobile']??'','status'=>1]);}catch(Invalid $e){throw new Invalid('第'.($i+1).'行：'.$e->getMessage());}}return ['count'=>count($ids)];});
    }
    public static function saveDecoration(int $tenant,int $user,array $p):void{
        Db::transaction(function()use($tenant,$user,$p){$id=self::id($p['store_id']??0);self::owned($tenant,$user,$id,true);$color=self::text($p,'accent',7);if(!preg_match('/^#[a-f0-9]{6}$/i',$color))throw new Invalid('请选择有效主题色');$settings=['accent'=>$color,'subtitle'=>self::text($p,'subtitle',120),'introduction'=>self::text($p,'introduction',2000)];foreach(['show_phone','show_address','show_hours'] as $key){if(!in_array((string)($p[$key]??'1'),['0','1'],true))throw new Invalid('展示选项不正确');$settings[$key]=(int)($p[$key]??1);}self::writeMeta($tenant,$user,$id,['decoration'=>json_encode($settings,JSON_UNESCAPED_UNICODE)]);});
    }
}
