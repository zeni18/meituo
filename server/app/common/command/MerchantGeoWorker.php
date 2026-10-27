<?php
declare(strict_types=1);
namespace app\common\command;
use think\console\{Command,Input,Output};
use think\console\input\Option;
final class MerchantGeoWorker extends Command
{
    protected function configure(){$this->setName('merchant-geo:work')->setDescription('GEO文本与独立数据能力任务')->addOption('once',null,Option::VALUE_NONE,'处理一个任务');}
    protected function execute(Input $input,Output $output):int
    {
        $worker=new \app\common\service\merchant\geo\GeoJobs();$visibility=new \app\common\service\merchant\geo\GeoVisibilityWorker();$nextReports=0;do{try{$worked=$worker->tick();$worked=$visibility->tick()||$worked;if(time()>=$nextReports){\app\common\service\merchant\geo\GeoVisibility::tickSchedules();\app\common\service\merchant\geo\GeoWorkflow::tickReports();$nextReports=time()+60;}}catch(\Throwable){$output->writeln('GEO队列暂不可用，请检查安装与服务配置');if($input->getOption('once'))return 1;$worked=false;}if(!$worked&&!$input->getOption('once'))sleep(2);}while(!$input->getOption('once'));return 0;
    }
}
