<?php
declare(strict_types=1);
namespace app\common\service\integration;

/** Consolidate navigation after role filtering; never grant service permissions. */
final class CapabilityNavigation
{
    public static function merge(array $menus): array
    {
        $aliases = ['geo/config', 'media/press/config'];
        $shared = null;
        $fallback = null;
        foreach ($menus as $index => $menu) {
            $path = trim((string)($menu['paths'] ?? ''), '/');
            if ($path === 'integration/config') $shared = $index;
            if (in_array($path, $aliases, true)) {
                if (!empty($menu['is_show']) && empty($menu['is_disable'])) $fallback ??= $menu;
                $menus[$index]['is_show'] = 0;
            }
        }
        // Staff with GEO/press-only access still need a way to open their forms.
        // The alias keeps its ID and permission for existing bookmarks/roles.
        if ($shared === null && $fallback !== null) {
            $fallback['id'] = 910000000 + (int)$fallback['id'];
            $fallback['pid'] = 0;
            $fallback['paths'] = 'integration/config';
            $fallback['component'] = 'integration/config';
            $fallback['name'] = '接入能力配置';
            $fallback['params'] = '';
            $fallback['selected'] = '';
            $fallback['is_cache'] = 0;
            $menus[] = $fallback;
        }
        return $menus;
    }
}
