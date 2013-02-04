
require('./remove-prefix.js');
require('./persistence');
require('./image-implementation/fs').createImageImplementation('pictures', function (err, imageImplementation) {
   window.EditorImage = imageImplementation;
});
require('./events');
require('./tooling');

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
