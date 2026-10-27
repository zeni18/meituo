<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** Safe message only: upstream response bodies can contain credentials or signed URLs. */
final class ClipCloudFailure extends \RuntimeException
{
    public function __construct(public readonly bool $uncertain,string $message='云服务请求失败，请检查开通状态、地域和权限') {parent::__construct($message);}
}
