<?php
declare(strict_types=1);
namespace app\common\service\press;
interface HaipressTransport
{
    public function request(string $path, array $headers, array $body, bool $json): array;
}
