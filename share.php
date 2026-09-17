<?php
// "Share" endpoint: save the drawing (.code) and nothing else.
//
//   POST  data   = the strokes (JSON, as the canvas produced them)
//   ->  { "ok": true, "id": "...", "code": "data/<id>.code", "out": "data/<id>.png" }
//
// The finished image is NOT made here and nothing is queued.  The independent
// background process (ai2/worker.py, run by cron) finds this file by polling
// data/ for a .code without a matching .png and generates data/<id>.png next
// to it.  "out" is where that image will appear — it is informational, the
// browser returns immediately.
//
// The .code normalization below is the same fit+center-into-the-unit-square
// math used by saveImage.php, so the saved drawing plays back identically.

if (version_compare(phpversion(), '7.1', '>=')) {
    ini_set( 'precision', 17 );
    ini_set( 'serialize_precision', -1 );
}
header("Content-Type: application/json");

$REPO  = __DIR__;
$DATA  = $REPO . "/data";

if (isset($_POST['data'])) {
  $d = json_decode($_POST['data'], true);
  if (!is_array($d) || count($d) == 0) {
    echo(json_encode(array("error" => "no strokes found")));
    exit;
  }

  // ---- save the .code (same fit + center into the unit square as saveImage.php)
  $mix = 1000; $miy = 1000; $max = -1000; $may = -1000;
  foreach ($d as &$stroke) {
    if (!isset($stroke['pos']) || !is_array($stroke['pos'])) continue;
    foreach ($stroke['pos'] as &$ar) {
      if ($ar[0] < $mix) $mix = $ar[0];
      if ($ar[0] > $max) $max = $ar[0];
      if ($ar[1] < $miy) $miy = $ar[1];
      if ($ar[1] > $may) $may = $ar[1];
    }
  }
  $scale = max($max - $mix, $may - $miy);
  if ($scale <= 0) { $scale = 1; $mix = $miy = 0; } // degenerate (e.g. a single click)
  foreach ($d as &$stroke) {
    if (!isset($stroke['pos']) || !is_array($stroke['pos'])) continue;
    foreach ($stroke['pos'] as &$ar) {
      $ar[0] = ($ar[0] - $mix) / $scale;
      $ar[1] = ($ar[1] - $miy) / $scale;
    }
  }
  $cx = (1.0 - (($max - $mix) / $scale)) / 2.0;
  $cy = (1.0 - (($may - $miy) / $scale)) / 2.0;
  foreach ($d as &$stroke) {
    if (!isset($stroke['pos']) || !is_array($stroke['pos'])) continue;
    foreach ($stroke['pos'] as &$ar) {
      $ar[0] += $cx;
      $ar[1] += $cy;
    }
  }
  unset($stroke, $ar);

  $id = date("Y-m-d\TH:i:sP");
  $codeName = $DATA . "/" . $id . ".code";
  file_put_contents($codeName, json_encode($d));

  echo(json_encode(array(
    "ok"   => true,
    "id"   => $id,
    "code" => "data/" . $id . ".code",
    "out"  => "data/" . $id . ".png",
  )));
} else {
  echo(json_encode(array("error" => "no data found")));
}
