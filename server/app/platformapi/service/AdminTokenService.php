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


namespace app\platformapi\service;

use app\common\cache\AdminTokenCache;
use app\common\model\auth\AdminSession;
use think\facade\Config;
use think\facade\Db;
use app\common\model\auth\Admin;

/**
 * 管理员token
 * Class TenantTokenService
 * @package app\platformapi\service
 */
class AdminTokenService
{
    /**
     * @notes 设置或更新管理员token
     * @param $adminId //管理员id
     * @param $terminal //多终端名称
     * @param $multipointLogin //是否支持多处登录
     * @return false|mixed
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 令狐冲
     * @date 2021/7/2 20:25
     */
    public static function setToken($adminId, $terminal, $multipointLogin = 1)
    {
        $adminTokenCache = new AdminTokenCache();
        $session = Db::transaction(function () use ($adminId, $terminal, $multipointLogin, $adminTokenCache) {
            // Serialize logins on the account row, including the first login.
            $admin = Admin::where('id', $adminId)->lock(true)->findOrEmpty();
            if ($admin->isEmpty() || (int)$admin->disable === 1) throw new \RuntimeException('账号不存在或已停用');
            $time = time();
            if ((int)$multipointLogin !== 1 || (int)$admin->multipoint_login !== 1) {
                $sessions = AdminSession::where('admin_id', $adminId)->where('terminal', $terminal)
                    ->where('expire_time', '>', $time)->column('token');
                AdminSession::where('admin_id', $adminId)->where('terminal', $terminal)
                    ->where('expire_time', '>', $time)->update(['expire_time' => $time, 'update_time' => $time]);
                foreach ($sessions as $token) $adminTokenCache->deleteAdminInfo($token);
            }
            return AdminSession::create([
                'admin_id' => $adminId,
                'terminal' => $terminal,
                'token' => bin2hex(random_bytes(16)),
                'expire_time' => $time + Config::get('project.admin_token.expire_duration'),
                'update_time' => $time,
            ], [], false, '');
        });
        return $adminTokenCache->setAdminInfo($session->token);
    }

    /**
     * @notes 延长token过期时间
     * @param $token
     * @return array|false|mixed
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 令狐冲
     * @date 2021/7/5 14:25
     */
    public static function overtimeToken($token)
    {
        $time = time();
        $adminSession = AdminSession::where('token', '=', $token)->where('expire_time', '>', $time)->findOrEmpty();
        if ($adminSession->isEmpty()) {
            return false;
        }
        //延长token过期时间
        $adminSession->expire_time = $time + Config::get('project.admin_token.expire_duration');
        $adminSession->update_time = $time;
        AdminSession::where('token', $token)->where('expire_time', '>', $time)
            ->update(['expire_time' => $adminSession->expire_time, 'update_time' => $time]);
        return (new AdminTokenCache())->setAdminInfo($adminSession->token);
    }

    /**
     * @notes 设置token为过期
     * @param $token
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 令狐冲
     * @date 2021/7/5 14:31
     */
    public static function expireToken($token)
    {
        $adminSession = AdminSession::where('token', '=', $token)
            ->findOrEmpty();

        if ($adminSession->isEmpty()) {
            return false;
        }

        $time = time();
        $adminSession->expire_time = $time;
        $adminSession->update_time = $time;
        // Logout revokes only the token presented by this device.
        AdminSession::where('token', $token)->update(['expire_time' => $time, 'update_time' => $time]);

        return (new AdminTokenCache())->deleteAdminInfo($token);
    }

}