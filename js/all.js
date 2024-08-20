
var canvas, ctx, flag = false,
    prevX = 0,
    currX = 0,
    prevY = 0,
    currY = 0,
    dot_flag = false;

var x = "black",
    y = 6;

var structure = []; // an array of drawing commands
var currentCommand = {};
var globalTime = null; // starts with the first mousedown

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext("2d");
    w = canvas.width;
    h = canvas.height;
    
    canvas.addEventListener("mousemove", function (e) {
        findxy('move', e);
	if (flag) {
	    if (typeof currentCommand.pos == "undefined") {
		currentCommand.pos = [];
	    }
	    if (globalTime != null)
		currentCommand.pos.push([currX / w, currY / h, (new Date())-globalTime]);
	}
    }, false);
    canvas.addEventListener("mousedown", function (e) {
        findxy('down', e)
	if (globalTime == null) {
	    globalTime = new Date();
	}
	currentCommand.color = x;
	currentCommand.lineWidth = y;
    }, false);
    canvas.addEventListener("mouseup", function (e) {
        findxy('up', e);
	// store the last mouse position as well
	if (typeof currentCommand.pos == "undefined") {
	    currentCommand.pos = [];
	}
	if (globalTime != null)
	    currentCommand.pos.push([currX / w, currY / h, (new Date())-globalTime]);
	
	structure.push(JSON.parse(JSON.stringify(currentCommand))); // trivial copy
	currentCommand = {}; // clear again
    }, false);
    canvas.addEventListener("mouseout", function (e) {
        findxy('out', e)
    }, false);
}

function color(obj) {
    x = obj;
}

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  return {
      x: (evt.clientX - rect.left),
      y: (evt.clientY - rect.top)
  };
}

function draw() {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.strokeStyle = x;
    ctx.lineWidth = y;
    ctx.stroke();
    ctx.closePath();
}

function erase(ask = true) {
    var m = true;
    if (ask) {
	m = confirm("Want to clear");
    }
    if (m) {
        ctx.clearRect(0, 0, w, h);
	if (document.getElementById("canvasimg"))
            document.getElementById("canvasimg").style.display = "none";
    }
}

/*function save() {
    document.getElementById("canvasimg").style.border = "2px solid";
    var dataURL = canvas.toDataURL();
    document.getElementById("canvasimg").src = dataURL;
    document.getElementById("canvasimg").style.display = "inline";
}*/

function findxy(res, e) {
    if (res == 'down') {
        prevX = currX;
        prevY = currY;
	pos = getMousePos(canvas, e);
        currX = pos.x; // e.clientX - canvas.offsetLeft;
        currY = pos.y; // e.clientY - canvas.offsetTop;

	
        flag = true;
        dot_flag = true;
        if (dot_flag) {
            ctx.beginPath();
            ctx.fillStyle = x;
            ctx.fillRect(currX, currY, 2, 2);
            ctx.closePath();
            dot_flag = false;
        }
    }
    if (res == 'up' || res == "out") {
        flag = false;
    }
    if (res == 'move') {
        if (flag) {
            prevX = currX;
            prevY = currY;
	    p = getMousePos(canvas, e); // but between 0 and 1
            currX = p.x; // e.clientX - canvas.offsetLeft;
            currY = p.y; // e.clientY - canvas.offsetTop;
            draw();
        }
    }
}


jQuery(document).ready(function() {
    // make the canvas fill its parent
    var canvas = document.querySelector('#canvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    jQuery('div.color').on('click', function() {
	var col = jQuery(this).css('background-color'); // get back a color
	color(col);
    });

    jQuery('#clear').on('click', function() {
	erase();
    });
    
    jQuery('#share').on('click', function() {
	// safe the current image as a structure of how to draw
	jQuery.post('saveImage.php', {data: JSON.stringify(structure)})
	    .done(function(data) {
		// returned value is
		console.log("got something back " + JSON.stringify(data));
	    });
	// and clear the screen again, reset everything or redirect
	structure = [];
	currentCommand = {};
	erase(false); // do not ask
    });
    
    init();
});
