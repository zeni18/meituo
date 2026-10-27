<?php
declare(strict_types=1);
namespace app\common\service\press;
final class HaipressFailure extends \RuntimeException
{
    public function __construct(public readonly bool $uncertain, public readonly string $providerCode, string $message)
    { parent::__construct($message); }
}
