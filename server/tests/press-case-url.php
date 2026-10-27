<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use app\common\service\press\PressCaseUrl as CaseUrl;
$checks=0;
function checkCase(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);++$checks;echo "PASS $label\n";}
function rejectsCase(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){checkCase(true,$label);return;}throw new RuntimeException($label);}
$fixture='<html><meta charset="utf-8"><a href="https://advert.example.com">广告</a><div class="ntop"><i></i>案例地址</div><div class="remark"><a target="_blank" href="https://news.example.com/article?a=1&amp;b=2">案例</a></div></html>';
checkCase(CaseUrl::extract($fixture)==='https://news.example.com/article?a=1&b=2','extracts labelled article and decodes HTML query entities');
checkCase(CaseUrl::extract(str_replace('&amp;','&amp;amp;',$fixture))==='https://news.example.com/article?a=1&b=2','decodes nested supplier entities without breaking article query parameters');
checkCase(CaseUrl::extract('<p> <i></i>案例地址：<em><a href="http://news.example.com/123">查看</a></em></p>')==='http://news.example.com/123','supports supplier attribute-row layout including whitespace text nodes');
checkCase(CaseUrl::resolve('https://news.example.com/original?x=1')==='https://news.example.com/original?x=1','already direct article links need no network');
foreach(['javascript:alert(1)','data:text/html,test','//news.example.com/a','https://user:password@news.example.com/a',"https://news.example.com/a\r\nLocation:test",'http://localhost/a','http://127.0.0.1/a','http://10.0.0.1/a','http://[::1]/a','http://2130706433/a','https://news.example.com:8090/a','https://news.example.com\\@localhost/a','https://web.ebuypress.com/resourcesPreview/123'] as $url){
 checkCase(CaseUrl::articleUrl($url)===null,'rejects unsafe or intermediary URL: '.strtok($url,"\r\n"));
}
rejectsCase(fn()=>CaseUrl::extract('<a href="https://news.example.com">首页</a>'),'does not mistake unrelated page links for articles');
rejectsCase(fn()=>CaseUrl::extract(str_replace('https://news.example.com/article?a=1&amp;b=2','javascript:alert(1)',$fixture)),'invalid example never becomes a redirect');
rejectsCase(fn()=>CaseUrl::resolve('https://web.ebuypress.com/resourcesPreview/123?redirect=http://localhost'),'does not fetch altered supplier path');
echo "All $checks case URL checks passed; no network requests.\n";
