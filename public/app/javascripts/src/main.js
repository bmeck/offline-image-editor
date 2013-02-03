require('./fs-image').createImageImplementation('pictures', function (err, imageImplementation) {
   var Image = window.img = imageImplementation;
});

//
// Hook up the events
//
var eventsByIdAndName = require('./events');
Object.keys(eventsByIdAndName).forEach(function (id) {
   var elem = document.getElementById(id);
   if (elem) Object.keys(eventsByIdAndName[id]).forEach(function (event) {
      elem.addEventListener(event, eventsByIdAndName[id][event]);
   });
});

//
// Keep up to date with online status. (do not rely on this)
//
function setOnlineStatus(isOnline) {
   document.body.classList.add(isOnline ? 'online' : 'offline');
   document.body.classList.remove(isOnline ? 'offline' : 'online');
}
setOnlineStatus(navigator.onLine);
window.addEventListener('online', setOnlineStatus);
window.addEventListener('offline', setOnlineStatus);

;(function () {
   var currentDialog;
   var currentCallback;
   window.openDialog = function openDialog(id, callback) {
      var dialog = document.getElementById(id);
      if (!dialog) {
         callback(new Error('Dialog not found'));
         return;
      }
      currentDialog = dialog;
      [].slice.call(document.querySelectorAll('#dialog-justify>[aria-active]')).forEach(function (activeDialog) {
         activeDialog.removeAttribute('aria-active');
      });
      document.getElementById('dialog-area').setAttribute('aria-active', 'true');
      dialog.setAttribute('aria-active', 'true');
      if (typeof callback === 'function') currentCallback = callback;
   }
   window.closeDialog = function closeDialog(err) {
      document.getElementById('dialog-area').removeAttribute('aria-active');
      if (currentCallback) {
         var callback = currentCallback;
         var form = currentDialog;
         currentCallback = currentDialog = null;
         callback(err, form);
      }
   }
})();

function fireTool(e) {
   var elem = document.querySelector('#editor-tools > input:checked');
   if (elem) {
      require('./editor-tools')[elem.value](e);
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
