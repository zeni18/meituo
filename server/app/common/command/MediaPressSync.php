<?php
declare(strict_types=1);
namespace app\common\command;

use think\console\{Command,Input,Output};
use think\console\input\Option;
use app\common\service\press\PressResourceSync;

final class MediaPressSync extends Command
{
    protected function configure()
    {
        $this->setName('media-press:sync')->setDescription('海讯社15类资源全量同步（不发稿）')
            ->addOption('all',null,Option::VALUE_NONE,'创建/续传全量任务并运行至结束，供定时任务使用')
            ->addOption('work',null,Option::VALUE_NONE,'常驻处理后台创建的同步任务')
            ->addOption('once',null,Option::VALUE_NONE,'仅消费一页，可与 --all 组合')
            ->addOption('status',null,Option::VALUE_NONE,'只显示当前任务进度');
    }

    protected function execute(Input $input,Output $output)
    {
        if ($input->getOption('status')) { $this->report($output,PressResourceSync::status());return 0; }
        if ($input->getOption('all') && $input->getOption('work')) { $output->writeln('请选择 --all 或 --work');return 2; }
        if (!$input->getOption('all') && !$input->getOption('work') && !$input->getOption('once')) { $output->writeln('使用 --all 同步全部；--work 消费后台任务；--status 查看进度。');return 2; }
        try {
            $batch=null;
            if ($input->getOption('all')) $batch=PressResourceSync::start()['batch'];
            $service=new PressResourceSync();$lastReport=0;$lastSignature='';
            do {
                $worked=$service->tick();$state=PressResourceSync::status();
                $signature=$state['state'].':'.$state['synced'].':'.$state['failed'];
                if ($input->getOption('once') || ($signature!==$lastSignature && $state['state']!=='idle' && (time()-$lastReport>=30 || !in_array($state['state'],['queued','running'],true)))) { $this->report($output,$state);$lastReport=time();$lastSignature=$signature; }
                if ($input->getOption('once')) return in_array($state['state'],['partial','blocked'],true)?1:0;
                if (!$input->getOption('work') && ($batch!==$state['batch'] || !in_array($state['state'],['queued','running'],true))) {
                    $this->report($output,$state);return $state['state']==='completed' && $batch===$state['batch']?0:1;
                }
                sleep($worked?1:3);
            } while (true);
        } catch (\InvalidArgumentException $e) { $output->writeln($e->getMessage());return 1; }
        catch (\Throwable) { $output->writeln('媒体资源同步暂不可用，请检查同步表安装、数据库与服务配置。');return 1; }
    }

    private function report(Output $output,array $state): void
    {
        $output->writeln(date('Y-m-d H:i:s').' '.$state['state'].' | 已同步 '.$state['synced'].' 条 | 完成 '.$state['completed'].'/15 类 | 失败 '.$state['failed'].' 类');
    }
}
