module.exports = {
   pen: require('./tools/pen'),
   eyedropper: require('./tools/eyedropper')
}

function fireTool(e) {
   var elem = document.querySelector('#editor-tools > input:checked');
   if (elem) {
      module.exports[elem.value](e);
   }
}

;(function () {
   var dragging;
   var dragTimeout;
   var canvas = document.getElementById('c');
   canvas.addEventListener('mousedown', function (e) {
      dragging = true;
      fireTool(e);
   });
   canvas.addEventListener('mouseup', function (e) {
      dragging = false;
      if (dragTimeout) clearTimeout(dragTimeout);
   });
   canvas.addEventListener('mousemove', function (e) {
      if (dragging) {
         fireTool(e);
      }
   });
   canvas.addEventListener('mouseout', function (e) {
      dragTimeout = setTimeout(function () {
         dragging = false;
      }, 5e2);
   });
   canvas.addEventListener('mouseover', function (e) {
      if (dragTimeout) clearTimeout(dragTimeout);
   });
})();