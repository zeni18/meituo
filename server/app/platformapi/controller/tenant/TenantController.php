<?php
// +----------------------------------------------------------------------
// | likeadmin快速开发前后端分离管理后台（PHP版）
// +----------------------------------------------------------------------
// | 欢迎阅读学习系统程序代码，建议反馈是我们前进的动力
// | 开源版本可自由商用，可去除界面版权logo
// | gitee下载：https://gitee.com/likeshop_gitee/likeadmin
// | github下载：https://github.com/likeshop-github/likeadmin
// | 访问官网：https://www.likeadmin.cn
// | likeadmin团队 版权所有 拥有最终解释权
// +----------------------------------------------------------------------
// | author: likeadminTeam
// +----------------------------------------------------------------------
namespace app\platformapi\controller\tenant;

use app\common\model\dept\TenantDept;
use app\platformapi\controller\BaseAdminController;
use app\platformapi\lists\tenant\TenantLists;
use app\platformapi\logic\setting\pay\PayConfigLogic;
use app\platformapi\logic\setting\pay\PayWayLogic;
use app\platformapi\logic\tenant\TenantAdminLogic;
use app\platformapi\logic\tenant\TenantLogic;
use app\platformapi\logic\tenant\TenantSystemMenuLogic;
use app\platformapi\service\TenantCreatService;
use app\platformapi\validate\tenant\TenantValidate;
use app\common\service\point\TenantPointService;
use app\common\service\tenant\TenantSsoService;
use app\common\service\app\DefaultAppService;
use app\common\service\billing\PackageProvisionService;
use app\tenantapi\logic\article\ArticleLogic;
use app\tenantapi\logic\decorate\DecorateDataLogic;
use app\tenantapi\logic\notice\NoticeLogic;
use think\facade\Db;

/**
 * 用户控制器
 * Class TenantController
 * @package app\platformapi\controller\user
 */
class TenantController extends BaseAdminController
{

    /**
     * @notes 用户列表
     * @return \think\response\Json
     * @author 段誉
     * @date 2022/9/22 16:16
     */
    public function lists()
    {
        return $this->dataLists(new TenantLists());
    }


    /**
     * @notes 获取用户详情
     * @return \think\response\Json
     * @author 段誉
     * @date 2022/9/22 16:34
     */
    public function detail()
    {
        $params = (new TenantValidate())->goCheck('detail');
        $result = TenantLogic::detail($params['id']);
        if (false === $result) {
            return $this->fail(TenantLogic::getError());
        }
        return $this->success('获取成功', $result);
    }

    /**
     * @notes 新增租户信息 同步初始化对应租户信息
     * @return \think\response\Json
     * @author yfdong
     * @date 2024/09/07 12:23
     */
    public function add()
    {
        $params = (new TenantValidate())->post()->goCheck('add');
        try {
            \app\platformapi\service\TenantProvisionService::create($params);
            return $this->success('新增成功', [], 1, 1);
        } catch (\Throwable $e) {
            return $this->fail('新增失败：' . $e->getMessage());
        }
    }

    public function edit()
    {
        $params = (new TenantValidate())->post()->goCheck('edit');
        $result = TenantLogic::edit($params);
        if (true === $result) {
            return $this->success('操作成功', [], 1, 1);
        }
        return $this->fail(TenantLogic::getError());
    }

    /**
     * @notes 删除租户
     * @return \think\response\Json
     * @author JXDN
     * @date 2024/09/03 17:02
     */
    public function delete()
    {
        $params = (new TenantValidate())->post()->goCheck('delete');
        $result = TenantLogic::delete($params);
        if (true === $result) {
            return $this->success('删除成功', [], 1, 1);
        }
        return $this->fail(TenantLogic::getError());
    }

    public function rechargePoints()
    {
        $tenantId = (int)$this->request->post('tenant_id', 0);
        $points = (float)$this->request->post('points', 0);
        $action = (string)$this->request->post('action', 'increase');
        $remark = (string)$this->request->post('remark', '');
        try {
            if (!in_array($action, ['increase', 'decrease'], true)) {
                return $this->fail('调整类型错误');
            }
            if ($points <= 0) {
                return $this->fail('调整点数必须大于0');
            }
            TenantPointService::adjustByPlatform(
                $tenantId,
                $action === 'decrease' ? -$points : $points,
                (int)($this->adminInfo['admin_id'] ?? 0),
                $remark
            );
            return $this->success('调整成功', [], 1, 1);
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage());
        }
    }

    public function pointLogs()
    {
        $tenantId = (int)$this->request->get('tenant_id', 0);
        return $this->success('获取成功', TenantPointService::logs($tenantId));
    }

    public function sso()
    {
        $tenantId = (int)$this->request->post('tenant_id', 0);
        $target = (string)$this->request->post('target', 'admin');
        $redirect = (string)$this->request->post('redirect', '');
        try {
            return $this->success('获取成功', TenantSsoService::createTicket($tenantId, $this->adminId, $target, $redirect));
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage());
        }
    }
}
