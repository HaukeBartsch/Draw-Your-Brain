<?php
// return a list of underlay filenames
$files = glob("images/MRI/*.png");
$erg = array();
foreach ($files as $file) {
    if (substr(basename($file), 0, 8) !== "solution") {
       $erg[] = basename($file);
    }
}
shuffle($erg);
echo(json_encode($erg));

?>