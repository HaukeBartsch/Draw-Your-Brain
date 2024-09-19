<?php
// save an image submitted just now in the data folder
$output = "data";

$data = "";
if (isset($_POST['data'])) {
  $d = json_decode($_POST['data'], true);
  
  // this is too slow, lets do this when we save instead
  $mix = 1000;
  $miy = 1000;
  $max = -1000;
  $may = -1000;
  foreach ($d as &$stroke) {
    foreach ($stroke['pos'] as &$ar) {
         if ($ar[0] < $mix) {
          $mix = $ar[0];
         }
         if ($ar[0] > $max) {
          $max = $ar[0];
         }
         if ($ar[1] < $miy) {
          $miy = $ar[1];
         }
         if ($ar[1] > $may) {
          $may = $ar[1];
         }
    }
  }
  // what is the best shift (per dimension its $mix $miy) and scale (single scale to keep aspect ratio?
  $scale = ($max - $mix);
  if (($may - $miy) > $scale) { // use the larger scale (x/y)
    $scale = ($may - $miy);
  }

  foreach($d as &$stroke) {
    foreach($stroke['pos'] as &$ar) {
        $ar[0] = ($ar[0] - $mix) / $scale;
        $ar[1] = ($ar[1] - $miy) / $scale;
    }
  }
  $mix = (1.0-(($max - $mix) / $scale))/2.0;
  $miy = (1.0-(($may - $miy) / $scale))/2.0;
  foreach($d as &$stroke) {
    foreach($stroke['pos'] as &$ar) {
        $ar[0] += $mix;
        $ar[1] += $miy;
    }
  }


  $fname = $output. "/". date("Y-m-d\\TH:i:sP").".code";
  file_put_contents($fname, json_encode($d));
  echo("{ \"message\": \"".$fname."\" }");
} else {
  echo ("{ \"message\": \"No data found\" }");
}

?>