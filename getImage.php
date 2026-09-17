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
   $d = json_decode(file_get_contents($fname), true);

   $fmtime = filemtime($fname);
   if ($d != null) {
      // a .png next to the .code (same stem) is the finished image
      $png = preg_replace('/\.code$/', '.png', $fname);
      $pngUrl = file_exists($png) ? rawurlencode($png) : null;
      $images[] = array( $fmtime, $d, $pngUrl );
      $counter = $counter + 1;
   }
 }
 echo(json_encode($images));
?>