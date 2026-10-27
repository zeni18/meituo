<?php
declare(strict_types=1);
namespace app\common\service\press;

use InvalidArgumentException as Invalid;
use think\facade\Cache;

/** Resolve the supplier's public preview to its actual example article, on demand. */
final class PressCaseUrl
{
    public static function articleUrl(string $url): ?string
    {
        $url=html_entity_decode(trim($url),ENT_QUOTES|ENT_HTML5,'UTF-8');
        if (strlen($url)>4096 || preg_match('/[\x00-\x20\x7f\\\\]/', $url) || !filter_var($url,FILTER_VALIDATE_URL)) return null;
        $parts=parse_url($url);$host=strtolower($parts['host']??'');
        if (!in_array(strtolower($parts['scheme']??''),['http','https'],true) || isset($parts['user']) || isset($parts['pass'])) return null;
        if (isset($parts['port']) && !in_array($parts['port'],[80,443],true)) return null;
        // The browser may follow this URL, but the server never fetches article hosts.
        if (filter_var(trim($host,'[]'),FILTER_VALIDATE_IP)) {
            if (!filter_var(trim($host,'[]'),FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)) return null;
        } elseif (!str_contains($host,'.') || preg_match('/(?:^|\.)(?:localhost|local|internal)$/i',$host) || preg_match('/^[\d.]+$/',$host)) return null;
        if (in_array($host,['web.ebuypress.com','ebuypress.com','haipress.com','www.haipress.com'],true)) return null;
        return $url;
    }

    public static function extract(string $html): string
    {
        $dom=new \DOMDocument();$previous=libxml_use_internal_errors(true);
        try { $loaded=$dom->loadHTML('<?xml encoding="UTF-8">'.$html,LIBXML_NONET); }
        finally { libxml_clear_errors();libxml_use_internal_errors($previous); }
        if ($loaded) {
            $xpath=new \DOMXPath($dom);
            // Only links explicitly labelled as examples; do not pick a homepage or an advert.
            $nodes=$xpath->query('//*[contains(concat(" ",normalize-space(@class)," ")," ntop ") and contains(normalize-space(.),"案例地址")]/following-sibling::*[1]//a[@href] | //p[text()[contains(.,"案例地址")]]//a[@href]');
            foreach ($nodes as $node) if ($url=self::articleUrl($node->getAttribute('href'))) return $url;
        }
        throw new Invalid('该媒体暂未提供可用的案例原文地址，请选择其他媒体案例。');
    }

    public static function resolve(string $source): string
    {
        if ($url=self::articleUrl($source)) return $url;
        // Never request a user-supplied host, arbitrary path, redirect, or authenticated API.
        if (!preg_match('#^https?://web\.ebuypress\.com/resourcesPreview/([0-9]{1,25})/?$#D',$source,$m)) throw new Invalid('该媒体暂无可用的案例网址。');
        $url='https://web.ebuypress.com/resourcesPreview/'.$m[1];
        return Cache::remember('press-case-url-v2-'.hash('sha256',$url),static function()use($url){
            $html='';$curl=curl_init($url);
            curl_setopt_array($curl,[CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
                CURLOPT_HTTPHEADER=>['Accept: text/html'],CURLOPT_WRITEFUNCTION=>static function($c,$bytes)use(&$html){if(strlen($html)+strlen($bytes)>1024*1024)return 0;$html.=$bytes;return strlen($bytes);}]);
            $ok=curl_exec($curl);$http=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
            if($ok===false||$http!==200)throw new Invalid('暂时无法获取案例网址，请返回媒体列表后重试。');
            return self::extract($html);
        },3600);
    }
}
