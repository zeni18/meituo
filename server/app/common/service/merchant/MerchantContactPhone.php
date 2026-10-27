<?php
declare(strict_types=1);
namespace app\common\service\merchant;

/** Contact numbers are optional; staff/login mobile numbers retain their stricter rules. */
final class MerchantContactPhone
{
    public const ERROR = '请填写有效联系电话：11位手机号、座机或客服电话；国际号码请以 + 开头';

    public static function normalize(mixed $value): string
    {
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) throw new \InvalidArgumentException(self::ERROR);
        $value = preg_replace_callback('/[０-９]/u', static fn($m) => chr(mb_ord($m[0]) - 0xFF10 + 48), $value);
        $value = trim(strtr($value, ['＋'=>'+','（'=>'(','）'=>')','－'=>'-','–'=>'-','—'=>'-',"\u{00A0}"=>' ',"\u{3000}"=>' ']));
        if ($value === '') return '';
        if (mb_strlen($value) > 32) throw new \InvalidArgumentException('联系电话最长32个字符，请检查号码或分机');
        if (self::validBase($value)) return $value;
        if (preg_match('/^(.+?)\s*(?:转|#|ext\.?|x)\s*([0-9]{1,6})$/iu', $value, $parts) && self::validBase(trim($parts[1]))) return self::withExtension(trim($parts[1]), $parts[2]);
        // A trailing dash is an extension only on a complete domestic landline.
        if (preg_match('/^(0[0-9 -]+)-([0-9]{1,6})$/D', $value, $parts) && self::validBase($parts[1])) return self::withExtension($parts[1], $parts[2]);
        throw new \InvalidArgumentException(self::ERROR);
    }

    private static function withExtension(string $base, string $extension): string
    {
        $value = $base . ' 转 ' . $extension;
        return mb_strlen($value) <= 32 ? $value : str_replace([' ', '-', '(', ')'], '', $base) . ' 转 ' . $extension;
    }

    private static function validBase(string $value): bool
    {
        if (!preg_match('/^\+?[0-9(][0-9() -]*[0-9)]$/D', $value) || str_contains($value, '--')) return false;
        if (!preg_match('/^[^()]*(?:\([0-9]{2,5}\)[^()]*)?$/D', $value)) return false;
        $digits = str_replace([' ', '-', '(', ')'], '', $value);
        if (str_starts_with($digits, '+86')) return self::domestic(substr($digits, 3));
        if (str_starts_with($digits, '+')) return (bool)preg_match('/^\+[1-9][0-9]{6,14}$/D', $digits);
        return self::domestic($digits);
    }

    private static function domestic(string $digits): bool
    {
        return (bool)preg_match('/^(?:1[3-9][0-9]{9}|0[1-9][0-9]{1,2}[2-9][0-9]{6,7}|[2-9][0-9]{6,7}|(?:400|800)[0-9]{7}|95[0-9]{3,4})$/D', $digits);
    }
}
