<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip {
    function proc_open($command, $descriptors, &$pipes, ...$options) {
        $GLOBALS['probe_commands'][] = $command;
        if ($GLOBALS['probe_spawn_failure']) return false;
        $pipes = [fopen('php://temp', 'w+'), fopen('php://temp', 'w+'), fopen('php://temp', 'w+')];
        fwrite($pipes[1], $GLOBALS['probe_json']); rewind($pipes[1]);
        return fopen('php://temp', 'w+');
    }
    function proc_get_status($process) { return ['running' => false, 'exitcode' => $GLOBALS['probe_exit']]; }
    function proc_close($process) { fclose($process); return -1; } // PHP 8.2 after proc_get_status consumed the exit code.
}
namespace {
    function env($key, $default = null) { return $default; }
    function root_path() { return dirname(__DIR__) . '/'; }
    function cache($key, $value = null, $ttl = null) { if (func_num_args() === 1) return $GLOBALS['probe_cache'][$key] ?? null; $GLOBALS['probe_cache'][$key] = $value; }
    require __DIR__ . '/../app/common/service/merchant/clip/ClipMediaProbe.php';
    use app\common\service\merchant\clip\ClipMediaProbe;
    $probe_commands = []; $probe_spawn_failure = false; $probe_cache = []; $probe_exit = 0; $checks = 0;
    function probeCheck(bool $ok, string $message): void { global $checks; if (!$ok) throw new \RuntimeException($message); $checks++; }
    function probeResult(string $json, int $exit = 0): ?float { $GLOBALS['probe_json'] = $json; $GLOBALS['probe_exit'] = $exit; $GLOBALS['probe_cache'] = []; return ClipMediaProbe::localDuration(__FILE__); }
    probeCheck(probeResult('{"format":{"duration":"12.125"}}') === 12.125, 'Read fractional container duration');
    probeCheck(probeResult('{"format":{"duration":"N/A"},"streams":[{"codec_type":"video","duration":"5.08"},{"codec_type":"audio","duration":"5.12"},{"codec_type":"attachment","duration":"900"}]}') === 5.12, 'Fallback to valid audio/video stream duration');
    foreach (['{}', '{"format":{"duration":0}}', '{"format":{"duration":-1}}', '{"format":{"duration":[]}}', 'invalid JSON'] as $json) probeCheck(probeResult($json) === null, 'Missing or malformed metadata cannot invent a duration');
    probeCheck(probeResult('{"format":{"duration":"12"}}', 1) === null, 'Failed probe cannot accept partial output');
    foreach ([126, 127] as $exit) { $failed = false; try { probeResult('{}', $exit); } catch (\InvalidArgumentException $e) { $failed = str_contains($e->getMessage(), '服务未就绪'); } probeCheck($failed, 'Missing/disabled executable has an actionable service error'); }
    $probe_spawn_failure = true; $failed = false; try { probeResult('{}'); } catch (\InvalidArgumentException $e) { $failed = str_contains($e->getMessage(), '服务未就绪'); } probeCheck($failed, 'Process startup failure has an actionable service error'); $probe_spawn_failure = false;
    probeResult('{"format":{"duration":"15"}}'); $count = count($probe_commands); probeCheck(ClipMediaProbe::localDuration(__FILE__) === 15.0 && count($probe_commands) === $count, 'Positive durations are cached');
    probeCheck(ClipMediaProbe::duration(['storage_engine' => 'oss', 'uri' => 'https://example.invalid/private.mp4']) === null, 'Remote storage URLs never become local probe inputs');
    probeCheck(ClipMediaProbe::duration(['storage_engine' => 'local', 'uri' => '../app/common/service/merchant/clip/ClipMediaProbe.php']) === null, 'Upload path traversal never becomes a probe input');
    foreach ($probe_commands as $command) probeCheck(in_array('-protocol_whitelist', $command, true) && $command[array_search('-protocol_whitelist', $command, true) + 1] === 'file', 'Probe can only use local-file protocols');
    echo 'PASS ' . $checks . ' duration-probe checks: metadata fallback, failure diagnostics, PHP 8.2 exit handling, cache and local-only input.' . PHP_EOL;
}
