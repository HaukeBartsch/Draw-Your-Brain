var canvas,
ctx,
flag = false,
prevX = 0,
currX = 0,
prevY = 0,
currY = 0,
dot_flag = false;
var w, h;

var x = "black",
y = 6;

var structure = []; // an array of drawing commands
var currentCommand = {};
var globalTime = null; // starts with the first mousedown
var underlayImage = new Image();
var enableUnderlay = false;

function getInteractionLocation(event) {
  let pos = { x: event.clientX, y: event.clientY };
  if (event.touches) {
    pos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  const rect = event.target.getBoundingClientRect();
  const x_rel = pos.x - rect.left;
  const y_rel = pos.y - rect.top;
  const xv = Math.round((x_rel * event.target.width) / rect.width);
  const yv = Math.round((y_rel * event.target.height) / rect.height);
  return [xv, yv];
}

function switchLanguage() {
  jQuery('span').each(function(idx, obj) {
    var en = jQuery(obj).attr("en");
    var no = jQuery(obj).attr("no");
    if (typeof en == 'undefined' || typeof no=='undefined')
      return; // ignore
    
    var now = jQuery(obj).text();
    if (now == en) {
      jQuery(obj).fadeOut(400, function() {
        jQuery(this).text(no).fadeIn(400);
      });
      //jQuery(obj).text(no);
    } else {
      jQuery(obj).fadeOut(400, function() {
        jQuery(this).text(en).fadeIn(400);
      });
    }
  });
}

function init() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  w = canvas.width;
  h = getHeightFromAR(w);
  
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
    canvas.height = getHeightFromAR(canvas.width);

    // canvas.height = window.innerHeight; // keep the aspect ratio in place so we always use the same frame of reference 0..1
    w = canvas.width;
    h = canvas.height;
    // we should draw again in case we got cleared out
    // a resize will have cleared the canvas, also remove the drawn image to make this consistent
    // instead of clearing the image we should draw it again.
    ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    for (var i = 0; i < structure.length; i++) {
      drawStroke(structure[i]); // set color, line and opacity, draw all pos values
    }
  };
}

function getHeightFromAR(width) {
  return Math.round((719 * width ) / 897);
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

// draw a complete stroke (human or AI) from the structure format
function drawStroke(d) {
  if (typeof d.pos == "undefined" || d.pos.length < 1) return;
  ctx.lineCap = "round";
  if (typeof d.opacity != "undefined") ctx.globalAlpha = d.opacity;
  ctx.beginPath();
  ctx.moveTo(Math.round(d.pos[0][0] * w), Math.round(d.pos[0][1] * h));
  for (var j = 1; j < d.pos.length; j++) {
    ctx.lineTo(Math.round(d.pos[j][0] * w), Math.round(d.pos[j][1] * h));
  }
  ctx.lineWidth = d.lineWidth;
  ctx.strokeStyle = d.color;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function erase(ask = true) {
  var m = true;
  if (ask) {
    m = confirm("Clear screen?");
  }
  if (m) {
    //ctx.drawColor(Color.TRANSPARENT)
    ctx.clearRect(0, 0, w, h);
    // start over with memorizing the drawings as well
    structure = [];
    currentCommand = {};
    globalTime = null;
    if (document.getElementById("canvasimg"))
      document.getElementById("canvasimg").style.display = "none";
  }
}

// ---- FLUX.2 (ai2/) : re-imagine the finished drawing on "Share" ----
var flux2Busy = false;
var flux2Modal = null;

function flux2ShowBusy(text) {
  jQuery("#flux2-busy-text").text(text);
  jQuery("#flux2-busy").css("display", "flex");
}
function flux2HideBusy() {
  jQuery("#flux2-busy").css("display", "none");
}

function flux2ModalShow() {
  flux2Modal = flux2Modal || new bootstrap.Modal("#flux2-result");
  flux2Modal.show();
}
function flux2ModalHide() {
  if (flux2Modal) flux2Modal.hide();
}

// Save the drawing (.code).  That's all the browser does.  The independent
// AI worker (ai2/worker.py, run by cron) polls data/ for this .code without a
// .png and generates the finished image next to it (data/<id>.png) in the
// background — so the browser returns immediately.
function shareDrawing() {
  if (flux2Busy) return;
  flux2Busy = true;
  flux2ShowBusy("Saving your drawing (the AI re-imagining runs in the background)…");
  var streamlined = simplify(structure);
  streamlined = accelerate(streamlined, 0.5);
  jQuery.post("share.php", { data: JSON.stringify(streamlined) })
    .done(function (data) {
      flux2HideBusy();
      if (data && data.ok) {
        flux2Confirm("ok", "Saved as " + data.id + ". The AI (FLUX.2) will " +
                 "generate the finished image in the background and save it " +
                 "next to your drawing.");
      } else {
        flux2Confirm("error", (data && data.error) || "saving failed");
      }
    })
    .fail(function () {
      flux2HideBusy();
      flux2Confirm("error", "saving failed (server error)");
    })
    .always(function () {
      flux2Busy = false;
    });
}

function flux2Confirm(type, msg) {
  var el = jQuery("#flux2-confirm-msg");
  el.removeClass("text-danger text-success")
    .addClass(type === "error" ? "text-danger" : "text-success");
  el.text(msg);
  flux2ModalShow();
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

function accelerate(structures, factor = 0.5) {
  // adjust the times go make the animation faster or slower
  if (structures.length == 0) return structures;
  var betterStructures = [];
  for (var i = 0; i < structures.length; i++) {
    var structure = structures[i];

    var c = JSON.parse(JSON.stringify(structure)); // make a copy
    for (var j = 0; j < c["pos"].length; j++) {
      // adjust the times
      c["pos"][j][2] *= factor;
    }
    betterStructures.push(c);
  }
  return betterStructures;
}

jQuery(document).ready(function () {
  // make the canvas fill its parent
  var canvas = document.querySelector("#canvas");
  canvas.width = canvas.offsetWidth;
  canvas.height = getHeightFromAR(canvas.width);
  //canvas.height = canvas.offsetHeight;
  
  jQuery("div.color").on("click", function () {
    var col = jQuery(this).css("background-color"); // get back a color
    color(col);
  });
  
  jQuery("#clear").on("click", function () {
    setTimeout(function() {
      erase();
    }, 100);
  });

  jQuery("#share").on("click", function () {
    if (structure.length < 1) return; // nothing drawn yet
    // save the drawing (.code); the ai2/ worker (via cron) generates the image in the background
    shareDrawing();
  });

  // FLUX.2 result modal buttons
  jQuery("#flux2-go-gallery").on("click", function () {
    window.location.href = "/";
  });
  jQuery("#flux2-keep").on("click", function () {
    flux2ModalHide();
    erase(false); // clear the canvas for a fresh drawing
  });
  
  jQuery('#brain').on("click", function() {
    // the user wants to enable a random brain picture
    if (jQuery('#brain').is(':checked')) {
      // load an underlay
      enableUnderlay = false;
      jQuery.getJSON('underlay.php', function(data) {
        // pick a random image here
        underlayImage.onload = function() {
          // now its finished loading, start drawing
          enableUnderlay = true;
          jQuery('div.brainSurface').css('background-image', 'url(' + this.src + ')');
          jQuery('div.brainSurface').css('background-size', 'contain');
          jQuery('div.brainSurface').css('background-position', 'center');
          jQuery('div.brainSurface').css('background-repeat', 'no-repeat');
          jQuery('#reveal-button').fadeIn(200);
          jQuery('#ai-result').css('background', 'none');
          jQuery('#ai-result').hide();
        };
        underlayImage.src = "/images/MRI/" + data[0]; // or pick the first
        jQuery('div.brainSurface').attr('basename', data[0]);
      });
    } else {
      enableUnderlay = false;
      jQuery('div.brainSurface').css('background', 'none');
      jQuery('#reveal-button').fadeOut(200);
      jQuery('#ai-result').fadeOut(200);
    }
  });
  
  jQuery('#reveal-button').on('click', function() {
    if (jQuery('#ai-result').is(":visible")) {
      // hide again
      jQuery('#ai-result').css('background', 'none');
      jQuery('#ai-result').hide();
      return;
    }
    jQuery('#ai-result').fadeIn(400);
    
    // toggle the AI result
    var nam = jQuery('div.brainSurface').attr('basename');
    var img = new Image();
    img.onload = function() {
      // now its finished loading, start drawing
      enableUnderlay = true;
      jQuery('#ai-result').css('background-image', 'url(' + this.src + ')');
      jQuery('#ai-result').css('background-size', 'contain');
      jQuery('#ai-result').css('background-position', 'center');
      jQuery('#ai-result').css('background-repeat', 'no-repeat');
    };
    img.src = "/images/MRI/solution " + nam; // or pick the first
  });

  setInterval(function() {
    switchLanguage();
  }, 10000);
  switchLanguage();
  
  let possible_colors = [ "orange", "limegreen", "#85C1E9", "black" ];
  let col = possible_colors[Math.floor(Math.random() * possible_colors.length)];
  color(col); // set start color
  init();
});
 
