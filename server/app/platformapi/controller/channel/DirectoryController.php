<?php
declare(strict_types=1);
namespace app\platformapi\controller\channel;

use app\platformapi\controller\BaseAdminController;
use app\platformapi\service\PlatformAgentDirectoryService as Directory;
use app\common\cache\AdminAuthCache;

class DirectoryController extends BaseAdminController
{
    private function allowed(string $action): bool
    {
        if((int)($this->adminInfo['root']??0)===1)return true;
        $perms=array_map('strtolower',(array)(new AdminAuthCache($this->adminId))->getAdminUri());
        return in_array('channel.directory/'.$action,$perms,true);
    }
    public function lists()
    {
        if(!$this->allowed('lists'))return $this->fail('没有代理列表查看权限');
        try{$data=Directory::listing($this->request->get());$data['can_manage_clip_borrow']=$this->allowedIntegrationGrant();return $this->data($data);}
        catch(\Throwable $e){error_log('Platform agent list failed: '.$e->getMessage());return $this->fail('代理列表读取失败，请稍后重试');}
    }
    public function save()
    {
        if(!$this->allowed('save'))return $this->fail('没有代理开通或编辑权限');
        try{
            \app\common\service\merchant\AgentAdminService::assertWrite($this->request);
            $params=$this->request->post();$raw=$this->request->post(false);
            if(array_key_exists('clip_borrow_platform',$raw))$params['clip_borrow_platform']=$raw['clip_borrow_platform'];
            return $this->success('保存成功',Directory::save($params,$this->allowedIntegrationGrant(),$this->adminId));
        }catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}
        catch(\Throwable $e){error_log('Platform agent save failed: '.$e->getMessage());return $this->fail('保存失败，请检查域名、账号及服务配置');}
    }
    private function allowedIntegrationGrant():bool
    {
        if((int)($this->adminInfo['root']??0)===1)return true;
        return in_array('integration.config/grant',array_map('strtolower',(array)(new AdminAuthCache($this->adminId))->getAdminUri()),true);
    }
}
