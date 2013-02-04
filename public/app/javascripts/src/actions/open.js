var async = require('async');
var canvasUtils = require('../common/canvas');
module.exports = function (e) {
   var nav = document.getElementById('gallery-nav');
   while(nav.childNodes.length) nav.removeChild(nav.firstChild);
   EditorImage.list(function (err, files) {
      if (!files || !files.length) {
         alert('You need to save some files first!');
         return;
      }
      var index = 0;
      async.forEach(files, function (file, next) {
         var radio = document.createElement('input');
         radio.name = 'gallery-choice';
         var id = radio.id = 'gallery-choice-' + index;
         radio.type = 'radio';
         radio.value = file;
         if (index === 0) {
            radio.click();
            first = false;
         }
         var container = document.createElement('span');
         nav.appendChild(container);
         new EditorImage(file).read(function (err, data) {
            var label = document.createElement('label');
            label.title = file;
            label.setAttribute('for', id);
            var image = document.createElement('img');
            image.onload = function () {
               container.appendChild(radio);
               container.appendChild(label);
               next();
            }
            image.onerror = function () {}
            var filereader = new FileReader();
            filereader.readAsDataURL(data);
            filereader.onload = function () {
               image.src = filereader.result.replace(/^data:;/,'data:image/png;');
            }
            EditorImage.onclick = function (e) {
               console.log(radio)
               radio.click(e);
            };
            label.appendChild(image);
         });
         index++;
      },
      openDialog('gallery-dialog', function (err, form) {
         if (err) {
            if (err != 'CANCEL') {
               alert(err);
            }
            return;
         }
         var filename = form.querySelector('input:checked').value;
         new EditorImage(filename).read(function (err, data) {
            var image = new Image();
            image.onload = function () {
               document.getElementById('save-name').value = filename;
               canvasUtils.fromImage(image);
            }
            image.onerror = function () {}
            var filereader = new FileReader();
            filereader.readAsDataURL(data);
            filereader.onload = function () {
               image.src = filereader.result.replace(/^data:;/,'data:image/png;');
            }
         });
      })
      );
   });
}