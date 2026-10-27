<?php
declare(strict_types=1);
namespace app\tenantapi\controller\oem;

use app\tenantapi\controller\BaseAdminController;

/** AgentAdminMiddleware authenticates and dispatches these scoped operations.
 * Native OEM sessions never fall through to an unscoped business implementation.
 */
final class OperationsController extends BaseAdminController
{
    private function denied() { return $this->fail('请使用代理账号访问代理经营功能'); }
    public function overview() { return $this->denied(); }
    public function catalog() { return $this->denied(); }
    public function merchants() { return $this->denied(); }
    public function ledger() { return $this->denied(); }
    public function orders() { return $this->denied(); }
    public function walletLogs() { return $this->denied(); }
    public function recharge() { return $this->denied(); }
    public function assignPlan() { return $this->denied(); }
    public function authorizeApps() { return $this->denied(); }
}
