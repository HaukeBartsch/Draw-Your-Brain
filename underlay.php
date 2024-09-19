<?php
// return a list of underlay filenames
$files = glob("images/MRI/*.png");
$erg = array();
foreach ($files as $file) {
    if (!str_starts_with(basename($file), "solution")) {
       $erg[] = basename($file);
    }
}
shuffle($erg);
echo(json_encode($erg));

?>