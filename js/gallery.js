var structures = null;
var ctx = null;
// store these by canvas (allow one per)
// we need to store the start time as well
// so values should be object.intervalID, object.startTime
var byCanvasData = new Map();
var svgImage = new Image();
svgImage.src = "/images/catPaw.svg";
var svgImage2 = new Image();
svgImage2.src = "/images/robotPaw.svg";
var drawSVG = svgImage;


function keyFromCanvas(canvas) {
  var key = jQuery(canvas).parent().attr("id");
  if (typeof key != "undefined") {
    return key;
  }
  return canvas; // fallback in case we do not have a valid id
}

function playback(canvas, structure) {
  if (structure.length < 1 || typeof structure[structure.length - 1].pos == "undefined" || structure[structure.length - 1].pos.length < 2)
    return; // do nothing
  
  // what is the length of this structures display?
  var start = null;
  if (byCanvasData.has(keyFromCanvas(canvas))) {
    start = byCanvasData.get(keyFromCanvas(canvas)).start;
  } else {
    start = new Date();
  }
  
  var maxTime = 0;
  try {
    maxTime =
    structure[structure.length - 1].pos[
      structure[structure.length - 1].pos.length - 1
    ][2];
  } catch(e) {
    return;
  }
  
  // based on the structure we need to do what?
  ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  var drawPaw = false;
  
  var endTime = (new Date()) - start;
  if (endTime > maxTime) {
    // start over with the animation (or be done with it if we are in detailed_canvas, draw only once)
    if (jQuery(canvas).parent().attr('id') != "detailed_canvas") {
      
      start = new Date();
      // update
      if (byCanvasData.has(keyFromCanvas(canvas))) { // only if this key exists already
        byCanvasData.set(keyFromCanvas(canvas), {
          interval: byCanvasData.get(keyFromCanvas(canvas)).interval,
          start,
        });
      }
    }
  }
  ctx.clearRect(0, 0, w, h); // clear first, draw up to the point in the structure based on now -start
  if (jQuery(canvas).parent().attr('id') == "detailed_canvas") {
    drawPaw = true;
  }
  // if we are after the last time don't draw the paw
  if (endTime > maxTime) {
    if (jQuery(canvas).parent().attr('id') == "detailed_canvas") {
      drawPaw = false;
    }
  }
  
  var drawPawOffset = [-270, -160];
  
  ctx.lineCap = "round";
  for (var i = 0; i < structure.length; i++) {
    var d = structure[i];
    if (typeof d.pos == "undefined") continue;
    if (typeof d.pos.length < 2) continue;
    // set color and line, start drawing pos values
    ctx.beginPath();
    ctx.moveTo(Math.round(d.pos[0][0] * w), Math.round(d.pos[0][1] * h));
    for (var j = 1; j < d.pos.length; j++) {
      // find out if we should still draw
      if (d.pos[j][2] > endTime) {
        if (drawPaw) {
          ctx.lineWidth = w < 200 ? 1 : d.lineWidth;
          ctx.strokeStyle = d.color;
          ctx.stroke();
          ctx.beginPath(); // start a new path to have the paw be over the last path
          // add the drawer on this position, but only if we are in the full window mode
          ctx.drawImage(drawSVG, Math.round(d.pos[j][0] * w) + drawPawOffset[0], Math.round(d.pos[j][1] * h) + drawPawOffset[1]);
        }
        break; // stop drawing here
      }
      ctx.lineTo(Math.round(d.pos[j][0] * w), Math.round(d.pos[j][1] * h));
    }
    ctx.lineWidth = w < 200 ? 1 : d.lineWidth;
    ctx.strokeStyle = d.color;
    ctx.stroke();
    //ctx.closePath();
    if (d.pos[d.pos.length - 1][2] > endTime) break; // stop drawing altogether
  }
  if (!byCanvasData.has(keyFromCanvas(canvas))) { // if this is the first time create a new interval
    var to = setInterval(function () {
      playback(canvas, structure);
    }, 100);
    // add new canvas data
    byCanvasData.set(keyFromCanvas(canvas), { interval: to, start: start });
  }
}

function loadGallery() {
  // don't just remove all children, find out which once should be added/updated
  //jQuery("div.gallery").children().remove();
  // clear out the byCanvasData
  //byCanvasData.forEach(function (value, key) {
  //clearInterval(value.interval);
  //});
  //byCanvasData = new Map();
  
  jQuery.getJSON("getImage.php", function (data) {
    // we might need to remove some playbacks
    var deletePlaybacks = [];
    jQuery("div.gallery div.playback").each(function(idx,a) {
      var si = jQuery(a).attr('structure_index');
      // this structure index needs to still exist in data, otherwise delete here
      var found = false;
      for (var j = 0; j < data.length; j++) {
        if (data[j][0] == si)
          found = true;
      }
      if (!found) {
        jQuery(a).remove();
        console.log("needed to remove an old structure index: " + si);
      }
    });
    
    // we get an array of structures back here, start adding playbacks
    var newPlaybacks = [];
    for (var i = 0; i < data.length; i++) {
      // do we have this image already? (skip, otherwise add at the beginning)
      if (document.getElementById("IMG"+data[i][0]) !== null)
        continue; // already done
      
      jQuery("div.gallery").prepend(
        "<div class='playback' id='IMG" +
        data[i][0] +
        "' structure_index='" +
        data[i][0] +
        "' title='Drawing #" +
        i +
        "'><canvas class='thumbnail'></canvas></div>",
      );
      // make canvas as big as div around it
      var canvas = document.querySelector("#IMG" + data[i][0] + " canvas.thumbnail");
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      newPlaybacks.push([canvas, data[i][1]]);
    }
    structures = data;
    // now start animating all new playbacks
    /*jQuery("div.gallery div.playback").each(function (a) {
    //console.log("do something for " + a); // should be the index
    var k = data[a][0];
    var v = data[a][1];
    var tmp = jQuery("#IMG" + k + " canvas")[0];
    var structure = v;
    playback(tmp, structure); // start the animation
    }); */
    for (var i = 0; i < newPlaybacks.length; i++) {
      playback(newPlaybacks[i][0], newPlaybacks[i][1]); // start the animation
    }
  });
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

jQuery(document).ready(function () {
  // draw the gallery from all found pictures
  loadGallery();
  setInterval(function() {
    loadGallery();
  }, 10000);
  
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
    jQuery('#delete-button').attr('tar', num);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    if (byCanvasData.has(keyFromCanvas(canvas))) {
      clearInterval(byCanvasData.get(keyFromCanvas(canvas)).interval);
      byCanvasData.delete(keyFromCanvas(canvas));
    }
    // set the draw paw
    // random which draw paw
    if (Math.random() > 0.5) {
      drawSVG = svgImage2;
    } else {
      drawSVG = svgImage;
    }
    
    
    // find the correct structure and play it back
    for (var i = 0; i < structures.length; i++) {
      if (structures[i][0] == num)
        playback(canvas, structures[i][1]);
    }
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
  
  jQuery('#delete-button').on('click', function() {
    var num = jQuery(this).attr('tar');
    //alert('delete this image' + num);
    jQuery.getJSON('deleteImage.php', { "num": num }, function(data) {
      console.log("done");
    });
  });
  
  setInterval(function() {
    switchLanguage();
  }, 10000);
  switchLanguage();  
});
