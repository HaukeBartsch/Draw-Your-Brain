<?php

$num = "";
if (isset($_GET['num'])) {
   $num = $_GET['num'];
}
if ($num == "") {
   return; // do nothing
}

// search for this numeric code for the filemtime
$fnames = glob("data/*.code");
foreach ($fnames as $fname) {
  $d = json_decode(file_get_contents($fname));
  $fmtime = filemtime($fname);
  if ($fmtime == $num) {
     // delete this
     unlink($fname);
  }
}


?>