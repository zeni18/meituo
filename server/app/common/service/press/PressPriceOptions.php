<?php
declare(strict_types=1);
namespace app\common\service\press;

final class PressPriceOptions
{
    public static function costs(array $row):array
    {
        $details=is_array($row['details_json']??null)?$row['details_json']:(json_decode($row['details_json']??'{}',true)?:[]);
        $kind=(int)$row['kind'];$labels=match($kind){12=>[1=>'直发',2=>'合拍'],13=>[1=>'头条',2=>'普条'],14=>[1=>'直发',2=>'转发',3=>'任务'],default=>[1=>'标准']};$out=[];
        foreach($labels as $type=>$label){$cost=$type===1?(int)$row['cost_cents']:0;$field=$type===2?'cost2_price':'cost3_price';if($type!==1&&is_numeric($details[$field]??null)&&(float)$details[$field]>0)$cost=PressMoney::cents($details[$field]);if($cost>0)$out[$type]=['price_type'=>$type,'label'=>$label,'cost_cents'=>$cost];}
        return $out;
    }
    public static function types(array $p,array $ids):array
    {
        $input=$p['price_types']??[];if(!is_array($input)||count($input)>20)throw new \InvalidArgumentException('价格类别格式不正确');$out=[];
        foreach($ids as $id){$type=$input[(string)$id]??1;if(!in_array($type,[1,2,3,'1','2','3'],true))throw new \InvalidArgumentException('价格类别无效');$out[(int)$id]=(int)$type;}ksort($out);return $out;
    }
}
