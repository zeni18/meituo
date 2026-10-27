<?php
declare(strict_types=1);
namespace app\common\service\press;

final class PressMoney
{
    public static function cents(mixed $value): int
    {
        if (is_float($value)) $value = number_format($value, 2, '.', '');
        if ((!is_string($value) && !is_int($value)) || !preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', (string)$value, $m)) {
            throw new \InvalidArgumentException('金额格式不正确');
        }
        return (int)$m[1] * 100 + (int)str_pad($m[2] ?? '', 2, '0');
    }
    public static function decimal(int $cents): string { return intdiv($cents, 100).'.'.str_pad((string)($cents % 100), 2, '0', STR_PAD_LEFT); }
    public static function retail(int $cost, int $bps): int { return intdiv($cost * (10000 + $bps) + 9999, 10000); }
    // One CNY equals 100 points: one monetary cent equals one whole point.
    public static function points(int $cents): string { return $cents.'.00'; }
}
