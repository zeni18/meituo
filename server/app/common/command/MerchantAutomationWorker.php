<?php
declare(strict_types=1);
namespace app\common\command;
use think\console\{Command,Input,Output};
use think\console\input\Option;
final class MerchantAutomationWorker extends Command
{
    protected function configure(){$this->setName('merchant-automation:work')->setDescription('视频库存补剪与GEO自动优化调度')->addOption('once',null,Option::VALUE_NONE,'处理一个到期计划');}
    protected function execute(Input $input,Output $output):int
    {
        do{try{$worked=\app\common\service\merchant\AutomationService::tick();}catch(\Throwable $e){$output->writeln('Automation unavailable: '.$e->getMessage());if($input->getOption('once'))return 1;$worked=false;}if(!$worked&&!$input->getOption('once'))sleep(5);}while(!$input->getOption('once'));return 0;
    }
}
