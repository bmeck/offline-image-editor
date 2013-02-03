function clearCanvas() {
   var c = document.getElementById('c');
   var ctx = c.getContext('2d');
   var fill = ctx.fillStyle;
   ctx.fillStyle='rgba(0,0,0,0)';
   ctx.fillRect(0,0,c.width,c.height);
   ctx.fillStyle=fill;
}
function newCanvas(width, height) {
   var c = document.getElementById('c');
   c.width = Math.abs(!width || isNaN(width) ? c.width : width);
   c.height = Math.abs(!height || isNaN(height) ? c.height : height);
   c.style.width = width + 'px';
   c.style.height = height + 'px';
   clearCanvas();
}
function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    return new Blob([ab], {type:mimeString});
}
module.exports = {
   'action-new': {
      'click': function (e) {
         openDialog('new-image-dialog', function (err, form) {
            if (err) {
               if (err != 'CANCEL') alert(err);
            }
            else {
               var width = document.getElementById('new-image-width').value;
               var height = document.getElementById('new-image-height').value;
               newCanvas(width, height);
            }
         });
      }
   },
   'action-gallery': {
      'click': function (e) {
         var nav = document.getElementById('gallery-nav');
         while(nav.childNodes.length) nav.removeChild(nav.firstChild);
         img.list(function (err, files) {
            if (!files || !files.length) {
               alert('You need to save some files first!');
               return;
            }
            files.forEach(function (file) {
               var radio = document.createElement('input');
               radio.name = 'gallery-choice';
               radio.type = 'radio';
               radio.value = file;
               var thumb = document.createElement('img');
               thumb.src = 'pictures/'+file;
               thumb.onclick = radio.click.bind(radio);
               nav.appendChild(radio);
               nav.appendChild(thumb);
            });
            openDialog('gallery-dialog', function (data, form) {
               new img(form.querySelector('input:checked').value).read(function (err, data) {
                  var image = new Image();
                  image.onload = function () {
                     newCanvas(image.naturalWidth, image.naturalHeight);
                     var c = document.getElementById('c');
                     c.getContext('2d').drawImage(image, 0, 0);
                  }
                  image.onerror = function () {}
                  var filereader = new FileReader();
                  filereader.readAsDataURL(data);
                  filereader.onload = function () {
                     image.src = filereader.result.replace(/^data:;/,'data:image/png;');
                  }
               });
            })
         });
      }
   },
   'action-save': {
      'click': function (e) {
         var datauri = document.getElementById('c').toDataURL('image/png;base64')
         var blob = dataURItoBlob(datauri);
         openDialog('save-dialog', function (data, form) {
            new img(form.querySelector('input[type=text]').value).write(blob, function (err) {
               console.log(arguments);
            });
         });
      }
   },
   'action-upload': {
      'change': function (e) {
         var files = document.getElementById('action-upload').files;
         var file = files && files[0];
         if (file) {
            var blob = file.slice();
            var dataURI = webkitURL.createObjectURL(blob);
            var img = new Image();
            img.src = dataURI;
            img.onload = function () {
               newCanvas(img.naturalWidth, img.naturalHeight);
               var c = document.getElementById('c');
               var ctx = c.getContext('2d');
               ctx.drawImage(img, 0, 0)
            }
            img.onerror = function () {
               alert('Unable to load image ' + file.name);
            }
         }
      }
   },
   'action-download': {
      'click': function (e) {
         window.open(document.getElementById('c').toDataURL());
      }
   }
};