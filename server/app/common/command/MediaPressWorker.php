<?php
declare(strict_types=1);
namespace app\common\command;
use think\console\{Command,Input,Output};
use think\console\input\Option;
use app\common\service\press\PressService;
final class MediaPressWorker extends Command
{
    protected function configure(){ $this->setName('media-press:work')->setDescription('海讯社媒体发稿与回链同步')->addOption('once',null,Option::VALUE_NONE,'仅处理一个队列项'); }
    protected function execute(Input $input,Output $output)
    {
        do {try {$worked=(new PressService())->tick();}catch (\Throwable) {$worked=false;$output->writeln('媒体发稿队列暂不可用，请检查安装与配置');}if (!$worked && !$input->getOption('once')) sleep(3);}while (!$input->getOption('once'));
    }
}
