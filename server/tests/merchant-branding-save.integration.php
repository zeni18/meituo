<?php
declare(strict_types=1);
require dirname(__DIR__) . '/runtime-loader.php';
$app = new \AigcRuntimeApp(dirname(__DIR__));
$app->initialize();
use think\facade\Db;
use app\common\enum\AdminTerminalEnum;
use app\common\model\TenantConfig;
use app\common\service\merchant\MerchantBrandingService;
use app\tenantapi\logic\setting\web\WebSettingLogic;
if (!str_starts_with((string)config('database.connections.mysql.database'), 'aigc_dev_')) throw new RuntimeException('Development database required');
request()->tenantId = 1;
request()->source = AdminTerminalEnum::TENANT;
$snapshot = static fn() => hash('sha256', json_encode(TenantConfig::where('tenant_id', 1)->order('id')->select()->toArray(), JSON_THROW_ON_ERROR));
$before = $snapshot();
Db::startTrans();
try {
    $params = WebSettingLogic::getWebsiteInfo();
    $params['name'] = '服务商后台测试名称';
    $params['shop_name'] = '星河商家测试工作台';
    $params['pc_title'] = '星河官网测试标题';
    WebSettingLogic::setWebsiteInfo($params);
    $saved = WebSettingLogic::getWebsiteInfo();
    $merchant = MerchantBrandingService::read();
    if ($saved['name'] !== $params['name'] || $saved['shop_name'] !== $params['shop_name'] || $saved['pc_title'] !== $params['pc_title']) throw new RuntimeException('Website settings did not preserve the three independent fields');
    if ($merchant['name'] !== $params['shop_name'] || $merchant['title'] !== $params['pc_title']) throw new RuntimeException('Merchant identity does not reflect saved settings');
    $html = MerchantBrandingService::loginHtml(file_get_contents(dirname(__DIR__) . '/app/view/merchant/login.html'), $merchant);
    if (substr_count($html, $params['shop_name']) !== 3 || str_contains($html, '{{merchant_')) throw new RuntimeException('Login first response does not use saved merchant branding');
    echo "PASS actual website-settings save: admin name, merchant name and browser title remain independent; merchant configuration and login use saved values.\n";
} finally {
    Db::rollback();
}
if ($snapshot() !== $before) throw new RuntimeException('Development configuration was not fully restored');
echo "PASS all development settings restored by transaction rollback.\n";
