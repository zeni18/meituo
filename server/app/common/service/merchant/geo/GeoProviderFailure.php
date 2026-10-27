<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
final class GeoProviderFailure extends \RuntimeException
{
    public function __construct(public readonly bool $uncertain,string $message){parent::__construct($message);}
}
