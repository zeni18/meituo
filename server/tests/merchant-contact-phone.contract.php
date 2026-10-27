<?php
declare(strict_types=1);
require __DIR__ . '/../app/common/service/merchant/MerchantContactPhone.php';
use app\common\service\merchant\MerchantContactPhone as Phone;
$fixtures=json_decode(file_get_contents(__DIR__.'/fixtures/merchant-contact-phone.json'),true,512,JSON_THROW_ON_ERROR);
foreach($fixtures['valid']as [$input,$expected])if(Phone::normalize($input)!==$expected)throw new RuntimeException('Valid contact number was rejected or changed: '.$input);
foreach(array_merge($fixtures['invalid'],[[],12345678901,true])as $input){$failed=false;try{Phone::normalize($input);}catch(InvalidArgumentException){$failed=true;}if(!$failed)throw new RuntimeException('Invalid contact number was accepted');}
echo 'PASS '.count($fixtures['valid']).' accepted phone formats and '.(count($fixtures['invalid'])+3).' invalid values rejected.'.PHP_EOL;
