var canvas,
  ctx,
  flag = false,
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


function getInteractionLocation(event) {
  let pos = { x: event.clientX, y: event.clientY };
  if (event.touches) {
      pos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  const rect = event.target.getBoundingClientRect();
  const x_rel = pos.x - rect.left;
  const y_rel = pos.y - rect.top;
  const x = Math.round((x_rel * event.target.width) / rect.width);
  const y = Math.round((y_rel * event.target.height) / rect.height);
  return [x, y];
}

function init() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  w = canvas.width;
  h = canvas.height;

    canvas.addEventListener(
        "touchmove",
        function(e) {
            findxy("move", e);
            if (flag) {
                if (typeof currentCommand.pos == "undefined") {
                    currentCommand.pos = [];
                }
                if (globalTime != null)
                    currentCommand.pos.push([
                        currX / w,
                        currY / h,
                        new Date() - globalTime,
                    ]);
            }
        },
        false,
    );
    
  canvas.addEventListener(
    "mousemove",
    function (e) {
      findxy("move", e);
      if (flag) {
        if (typeof currentCommand.pos == "undefined") {
          currentCommand.pos = [];
        }
        if (globalTime != null)
          currentCommand.pos.push([
            currX / w,
            currY / h,
            new Date() - globalTime,
          ]);
      }
    },
    false,
  );
    canvas.addEventListener(
        "touchstart",
        function(e) {
            findxy("down", e);
            if (globalTime == null) {
                globalTime = new Date();
            }
            currentCommand.color = x;
            currentCommand.lineWidth = y;
        },
        false,
    );

    
  canvas.addEventListener(
    "mousedown",
    function (e) {
      findxy("down", e);
      if (globalTime == null) {
        globalTime = new Date();
      }
      currentCommand.color = x;
      currentCommand.lineWidth = y;
    },
    false,
  );
  canvas.addEventListener(
    "mouseup",
    function (e) {
      findxy("up", e);
      // store the last mouse position as well
      if (typeof currentCommand.pos == "undefined") {
        currentCommand.pos = [];
      }
      if (globalTime != null)
        currentCommand.pos.push([
          currX / w,
          currY / h,
          new Date() - globalTime,
        ]);

      structure.push(JSON.parse(JSON.stringify(currentCommand))); // trivial copy
      currentCommand = {}; // clear again
    },
    false,
  );
    canvas.addEventListener(
        "touchend",
        function(e) {
            findxy("up", e);
            // store the last mouse position as well                                                                                            
            if (typeof currentCommand.pos == "undefined") {
                currentCommand.pos = [];
            }
            if (globalTime != null)
                currentCommand.pos.push([
                    currX / w,
                    currY / h,
                    new Date() - globalTime,
                ]);

            structure.push(JSON.parse(JSON.stringify(currentCommand))); // trivial copy                                                         
            currentCommand = {}; // clear again                                                                                                 
        },
        false,
    );


    canvas.addEventListener(
    "mouseout",
    function (e) {
      findxy("out", e);
    },
    false,
  );

    window.onresize = function (event) {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	// we should draw again in case we got cleared out
	// a resize will clear the canvas, also remove the drawn image to make this consistent
	erase(false);
    };
}

function color(obj) {
  x = obj;
}

function getMousePos(canvas, evt) {
  erg	= getInteractionLocation(evt);
  return  {
    x: erg[0],
    y: erg[1]
  };
/*
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top,
  }; */
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
    m = confirm("Clear screen?");
  }
  if (m) {
      ctx.clearRect(0, 0, w, h);
      // start over with memorizing the drawings as well
      structure = [];
      currentCommand = {};
      globalTime = null;
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
  if (res == "down") {
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
  if (res == "up" || res == "out") {
    flag = false;
  }
  if (res == "move") {
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

// create a streamlined version of a structure by removing empty time
function simplify(structures) {
  if (structures.length == 0) return structures;
  var betterStructures = [];
  var s = 0; // lets start with second 0
  for (var i = 0; i < structures.length; i++) {
    var structure = structures[i];
    if (
      typeof structure["pos"] == "undefined" ||
      structure["pos"].length == 0
    ) {
      betterStructures.push(structure);
      continue;
    }
    var c = JSON.parse(JSON.stringify(structure)); // make a copy
    for (var j = 0; j < c["pos"].length; j++) {
      // adjust the times
      if (j == 0) {
        c["pos"][j][2] = s;
      } else {
        var dt = structure["pos"][j][2] - structure["pos"][j - 1][2];
        c["pos"][j][2] = s + dt;
        s += dt;
      }
    }
    betterStructures.push(c);
  }
  return betterStructures;
}

jQuery(document).ready(function () {
  // make the canvas fill its parent
  var canvas = document.querySelector("#canvas");
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  jQuery("div.color").on("click", function () {
    var col = jQuery(this).css("background-color"); // get back a color
    color(col);
  });

  jQuery("#clear").on("click", function () {
    erase();
  });

  jQuery("#share").on("click", function () {
    var streamlined = simplify(structure);

    // safe the current image as a structure of how to draw
    jQuery
      .post("saveImage.php", { data: JSON.stringify(streamlined) })
      .done(function (data) {
        // returned value is
        console.log("got something back " + JSON.stringify(data));
      });
    // and clear the screen again, reset everything or redirect
    structure = [];
    currentCommand = {};
    erase(false); // do not ask
    // and go back
    setTimeout(function () {
      window.location.href = "/index.html";
    }, 300);
  });

  color("orange"); // set start color
  init();
});
