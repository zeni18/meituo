<?php
declare(strict_types=1);
namespace app\common\service {
    final class ConfigService {
        public static int $tenant = 1;
        public static array $values = [];
        public static function get(string $type, string $key) { return self::$values[self::$tenant][$type][$key] ?? ''; }
    }
    final class FileService {
        public static function getFileUrl(string $path): string { return str_starts_with($path, 'https://') ? $path : 'https://assets.example.test/' . $path; }
    }
}
namespace {
    require __DIR__ . '/../app/common/service/merchant/MerchantBrandingService.php';
    use app\common\service\ConfigService;
    use app\common\service\merchant\MerchantBrandingService;
    function check(bool $pass, string $message): void { if (!$pass) throw new \RuntimeException($message); }
    ConfigService::$values = [
        1 => ['website' => ['shop_name' => '星河 AI 工作空间', 'pc_title' => '星河官网 | 企业内容平台']],
        2 => ['website' => ['shop_name' => '云杉品牌', 'pc_title' => '云杉网站']],
        3 => ['website' => ['shop_name' => '  ', 'pc_title' => ''], 'tenant' => ['name' => '租户名称']],
    ];
    $a = MerchantBrandingService::read();
    check($a['name'] === '星河 AI 工作空间', 'Sidebar identity must use the editable frontend name, independently of SEO title');
    check($a['title'] === '星河官网 | 企业内容平台', 'Browser title remains independently configurable');
    ConfigService::$tenant = 2;
    check(MerchantBrandingService::read()['name'] === '云杉品牌', 'Tenant switch must not reuse another tenant identity');
    ConfigService::$tenant = 3;
    check(MerchantBrandingService::read()['name'] === '租户名称', 'Blank frontend name falls back to this tenant');
    ConfigService::$tenant = 4;
    check(MerchantBrandingService::read()['name'] === 'AI 商家工作台', 'Absent configuration has a neutral fallback');
    $name = '星河 $1 </title><script>alert("x")</script> & "工作台"';
    $malicious = array_merge($a, ['name' => $name, 'logo' => 'https://example.test/" onerror="alert(1)']);
    $html = MerchantBrandingService::loginHtml(file_get_contents(__DIR__ . '/../app/view/merchant/login.html'), $malicious);
    check(!str_contains($html, '{{merchant_'), 'All login branding placeholders must be resolved');
    check(!str_contains($html, '<script>alert('), 'Configured names must remain text in HTML');
    check(str_contains($html, '星河 $1 &lt;/title&gt;'), 'Name preserves dollar characters while escaping markup');
    check(!str_contains($html, 'src="https://example.test/" onerror='), 'Logo URL cannot inject HTML attributes');
    $boot = json_encode(['tenantId' => 1, 'branding' => $malicious], JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    check(!str_contains($boot, '</script>') && json_decode($boot, true)['branding']['name'] === $name, 'Inline bootstrap must preserve names without closing its script');
    echo "PASS merchant branding: independent name/title, tenant isolation, blank fallback, first-frame login branding, HTML and bootstrap escaping.\n";
}
