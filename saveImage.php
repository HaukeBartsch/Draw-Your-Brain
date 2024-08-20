<?php
// save an image submitted just now in the data folder
$output = "data";

$data = "";
if (isset($_POST['data'])) {
   $data = $_POST['data'];
   $fname = $output. "/". date("Y-m-d\\TH:i:sP").".code";
   file_put_contents($fname, $data);
} else {
  echo ("{ \"message\": \"No data found\" }");
}

?>