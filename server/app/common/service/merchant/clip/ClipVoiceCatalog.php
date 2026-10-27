<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** Display metadata from the official voice list; it never grants synthesis permission. */
final class ClipVoiceCatalog
{
    private const NAMES=[
        'zh_female_vv_uranus_bigtts'=>'Vivi 2.0','zh_female_xiaohe_uranus_bigtts'=>'小何 2.0',
        'zh_male_m191_uranus_bigtts'=>'云舟 2.0','zh_male_taocheng_uranus_bigtts'=>'小天 2.0',
        'zh_male_liufei_uranus_bigtts'=>'刘飞 2.0','zh_female_sophie_uranus_bigtts'=>'魅力苏菲 2.0',
        'zh_female_qingxinnvsheng_uranus_bigtts'=>'清新女声 2.0',
        'zh_female_shuangkuaisisi_uranus_bigtts'=>'爽快思思 2.0',
        'zh_female_shuangkuaisisi_moon_bigtts'=>'爽快思思 / Skye',
        'zh_female_shuangkuaisisi_emo_v2_mars_bigtts'=>'爽快思思（多情感）',
        'zh_female_cancan_mars_bigtts'=>'灿灿 / Shiny',
        'zh_male_wennuanahu_moon_bigtts'=>'温暖阿虎 / Alvin',
        'zh_male_shaonianzixin_moon_bigtts'=>'少年梓辛 / Brayan',
        'zh_male_jieshuoxiaoming_moon_bigtts'=>'解说小明',
        'zh_female_tianmeixiaoyuan_moon_bigtts'=>'甜美小源',
    ];
    public static function describe(string $id):array
    {
        return ['name'=>self::NAMES[$id]??$id,'catalog_url'=>'https://docs.volcengine.com/docs/DoubaoVoice/Tonelist-1?lang=zh'];
    }
}
