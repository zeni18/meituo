<?php
declare(strict_types=1);
namespace app\common\command;
use think\console\{Command,Input,Output};
use think\console\input\Option;
final class MerchantTaskWorker extends Command
{
    protected function configure(){$this->setName('merchant-tasks:work')->setDescription('员工任务通知队列')->addOption('once',null,Option::VALUE_NONE,'执行一次');}
    protected function execute(Input $input,Output $output):int{$worker=new \app\common\service\merchant\TaskNotificationService();do{try{$worked=$worker->tick();}catch(\Throwable){$output->writeln('Task notification queue unavailable.');if($input->getOption('once'))return 1;$worked=false;}if(!$worked&&!$input->getOption('once'))sleep(2);}while(!$input->getOption('once'));return 0;}
}
