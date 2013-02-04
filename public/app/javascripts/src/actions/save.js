var commonUtils = require('../common/util');
module.exports = function (e) {
   var datauri = document.getElementById('c').toDataURL('image/png;base64')
   var blob = commonUtils.dataURItoBlob(datauri);
   openDialog('save-dialog', function (data, form) {
      new EditorImage(form.querySelector('input[type=text]').value).write(blob, function (err) {
      });
   });
}