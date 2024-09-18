<?php
 // we want to return some of the images, maybe not all of them? So at max the last N?
 $N = 20*20;
 $fnames = glob("data/*.code");
 usort($fnames, function($a,$b){
   return filemtime($a) - filemtime($b);
 });
 $images = [];
 $counter = 0;
 foreach ($fnames as $fname) {
   if ($counter > $N) {
      break;
   }
   $d = json_decode(file_get_contents($fname));
   $fmtime = filemtime($fname);
   if ($d != null) {
      $images[] = array( $fmtime, $d );
      $counter = $counter + 1;
   }
 }
 echo(json_encode($images));
?>