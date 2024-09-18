var structures = null;
var ctx = null;
// store these by canvas (allow one per)
// we need to store the start time as well
// so values should be object.intervalID, object.startTime
var byCanvasData = new Map();

function keyFromCanvas(canvas) {
  var key = jQuery(canvas).parent().attr("id");
  if (typeof key != "undefined") {
    return key;
  }
  return canvas; // fallback in case we do not have a valid id
}

function playback(canvas, structure) {
  // what is the length of this structures display?
  var start = null;
  if (byCanvasData.has(keyFromCanvas(canvas))) {
    start = byCanvasData.get(keyFromCanvas(canvas)).start;
  } else {
    start = new Date();
  }

  var maxTime =
    structure[structure.length - 1].pos[
      structure[structure.length - 1].pos.length - 1
    ][2];

  // based on the structure we need to do what?
  ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  ctx.clearRect(0, 0, w, h); // clear first, draw up to the point in the structure based on now -start
    var endTime = (new Date()) - start;
  if (endTime > maxTime) {
    // start over with the animation
    start = new Date();
      // update
    byCanvasData.set(keyFromCanvas(canvas), {
      interval: byCanvasData.get(keyFromCanvas(canvas)).interval,
      start,
    });
  }

  ctx.lineCap = "round";
  for (var i = 0; i < structure.length; i++) {
    var d = structure[i];
    if (typeof d.pos == "undefined") continue;
    // set color and line, start drawing pos values
    ctx.beginPath();
    ctx.moveTo(Math.round(d.pos[0][0] * w), Math.round(d.pos[0][1] * h));
    for (var j = 1; j < d.pos.length; j++) {
      // find out if we should still draw
      if (d.pos[j][2] > endTime) break; // stop drawing here
      ctx.lineTo(Math.round(d.pos[j][0] * w), Math.round(d.pos[j][1] * h));
    }
    ctx.lineWidth = w < 200 ? 1 : d.lineWidth;
    ctx.strokeStyle = d.color;
    ctx.stroke();
    //ctx.closePath();
    if (d.pos[d.pos.length - 1][2] > endTime) break; // stop drawing altogether
  }
  if (!byCanvasData.has(keyFromCanvas(canvas))) {
    var to = setInterval(function () {
      playback(canvas, structure);
    }, 100);
    // add new canvas data
    byCanvasData.set(keyFromCanvas(canvas), { interval: to, start: start });
  }
}

function loadGallery() {
  jQuery("div.gallery").children().remove();
  // clear out the byCanvasData
  byCanvasData.forEach(function (value, key) {
    clearInterval(value.interval);
  });
  byCanvasData = new Map();

  jQuery.getJSON("getImage.php", function (data) {
    // we get an array of structures back here, start adding playbacks
    for (var i = 0; i < data.length; i++) {
      jQuery("div.gallery").prepend(
        "<div class='playback' id='IMG" +
          i +
          "' structure_index='" +
          i +
          "' title='Drawing #" +
          i +
          "'><canvas class='thumbnail'></canvas></div>",
      );
      // make canvas as big as div around it
      var canvas = document.querySelector("#IMG" + i + " canvas.thumbnail");
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    structures = data;
    // now start animating all playbacks
    jQuery("div.gallery div.playback").each(function (a) {
      //console.log("do something for " + a); // should be the index
      var tmp = jQuery("#IMG" + a + " canvas")[0];
      var structure = structures[a];
      playback(tmp, structure); // start the animation
    });
  });
}

jQuery(document).ready(function () {
  // draw the gallery from all found pictures
  loadGallery();

  jQuery("div.gallery").on("click", "div.playback", function () {
    // show this one image larger
    var id = jQuery(this).attr("id");
    var num = jQuery(this).attr("structure_index");
    jQuery("#num_drawing").text(num);
    jQuery("#detailed_canvas canvas").attr("draw", num);

    const modal = new bootstrap.Modal("#details", { keyboard: true });
    modal.show();
  });

  const modalDialog = document.getElementById("details");
  modalDialog.addEventListener("shown.bs.modal", function (e) {
    var canvas = jQuery("#detailed_canvas canvas")[0];
    var num = jQuery("#detailed_canvas canvas").attr("draw");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    if (byCanvasData.has(keyFromCanvas(canvas))) {
      clearInterval(byCanvasData.get(keyFromCanvas(canvas)).interval);
      byCanvasData.delete(keyFromCanvas(canvas));
    }
    playback(canvas, structures[num]);
  });

  modalDialog.addEventListener("hide.bs.modal", function (e) {
    var canvas = jQuery("#detailed_canvas canvas")[0];
    if (byCanvasData.has(keyFromCanvas(canvas))) {
      clearInterval(byCanvasData.get(keyFromCanvas(canvas)).interval);
      byCanvasData.delete(keyFromCanvas(canvas));
    }
  });

  // can we detect if a user starts drawing? (Goes away from the page?)
  document.addEventListener("visibilitychange", (event) => {
    if (document.visibilityState == "visible") {
      loadGallery();
    } else {
      // console.log("tab is inactive");
      byCanvasData.forEach(function (value, key) {
        clearInterval(value.interval);
      });
      byCanvasData = new Map();
    }
  });
});
