<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** Injectable at construction in CLI tests; no HTTP mock switch exists. */
interface ClipCloudTransport
{
    public function rpc(array $config,string $action,array $parameters):array;
    public function json(string $url,array $headers,array $body):array;
    public function upload(array $config,string $bucket,string $key,string $path):void;
    public function downloadSpeech(string $url,string $path):void;
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string;
}
