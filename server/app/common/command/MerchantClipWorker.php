<?php
declare(strict_types=1);
namespace app\common\command;

use think\console\{Command,Input,Output};
use think\console\input\Option;
use app\common\service\merchant\clip\ClipCloudJobService;

final class MerchantClipWorker extends Command
{
    protected function configure(){ $this->setName('merchant-clip:work')->setDescription('新增剪辑云任务；不处理原框架任务')->addOption('once',null,Option::VALUE_NONE,'只执行一步'); }
    protected function execute(Input $input,Output $output):int
    {
        $worker=new ClipCloudJobService();$voices=new \app\common\service\merchant\clip\ClipVoiceProfileService();
        do{try{$worked=$worker->tick();$worked=$voices->tick()||$worked;}catch(\Throwable){$output->writeln('Clip queue unavailable; check migration and database.');if($input->getOption('once'))return 1;$worked=false;}if(!$worked&&!$input->getOption('once'))sleep(2);}while(!$input->getOption('once'));return 0;
    }
}
