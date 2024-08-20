var structures = null;
var ctx = null;
var lastModalTimeout = null;

function playback(canvas, structure, start) {
    // what is the length of this structures display?
    
    var maxTime = structure[structure.length-1].pos[structure[structure.length-1].pos.length-1][2];
    
    // based on the structure we need to do what?
    ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h); // clear first, draw up to the point in the structure based on now -start
    var endTime = (new Date()) - start;
    if (endTime > maxTime) { // start over with the animation
	start = new Date();
    }
    
    ctx.lineCap = "round";
    for (var i = 0; i < structure.length; i++) {
	var d = structure[i];
	if (typeof d.pos == "undefined")
	    continue;
	// set color and line, start drawing pos values
	ctx.beginPath();
	ctx.moveTo(Math.round(d.pos[0][0] * w), Math.round(d.pos[0][1] * h));
	for (var j = 1; j < d.pos.length; j++) {
	    // find out if we should still draw
	    if (d.pos[j][2] > endTime)
		break; // stop drawing here
	    ctx.lineTo(Math.round(d.pos[j][0] * w), Math.round(d.pos[j][1] * h));
	}
	ctx.lineWidth = (w < 200)?1:d.lineWidth;
	ctx.strokeStyle = d.color;
	ctx.stroke();
	//ctx.closePath();
	if (d.pos[d.pos.length-1][2] > endTime)
	    break; // stop drawing altogether
    }
    lastModalTimeout = setTimeout(function() {
	playback(canvas, structure, start);
    }, 100);
}

jQuery(document).ready(function() {
    // draw the gallery from all found pictures
    jQuery.getJSON('getImage.php', function(data) {
	// we get an array of structures back here, start adding playbacks
	for (var i = 0; i < data.length; i++) {
	    jQuery('div.gallery').append("<div class='playback' id='IMG" + i + "' structure_index='" + i + "' title='Drawing #" + i + "'><canvas class='thumbnail'></canvas></div>");
	    // make canvas as big as div around it
	    var canvas = document.querySelector('#IMG'+i+" canvas.thumbnail");
	    canvas.width = canvas.offsetWidth;
	    canvas.height = canvas.offsetHeight;
	}
	structures = data;
	// now start animating all playbacks
	jQuery('div.gallery div.playback').each(function(a) {
	    console.log("do something for " + a); // should be the index
	    var tmp = jQuery('#IMG'+ a + " canvas")[0];
	    var structure = structures[a];
	    playback(tmp, structure, new Date()); // start the animation
	});
    });

    jQuery('div.gallery').on('click', 'div.playback', function() {
	// show this one image larger
	var id = jQuery(this).attr('id');
	var num = jQuery(this).attr('structure_index');
	jQuery('#num_drawing').text(num);
	//console.log("click on " + id);
	const modal = new bootstrap.Modal('#details', { keyboard: true });
	modal.show();
	// listen to the show and set canvas after the dialog is open
	const modalDialog = document.getElementById('details');
	modalDialog.addEventListener('shown.bs.modal', function (e) {
	    var canvas = jQuery('#detailed_canvas')[0];
	    canvas.width = canvas.offsetWidth;
	    canvas.height = canvas.offsetHeight;
	    if (lastModalTimeout != null) {
		clearTimeout(lastModalTimeout);
	    }
	    playback(canvas, structures[num], new Date());
	});
	modalDialog.addEventListener('hide.bs.modal', function(e) {
	    if (lastModalTimeout != null) {
		clearTimeout(lastModalTimeout);
	    }
	});
    });
    
});
