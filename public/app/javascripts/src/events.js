module.exports = {
   'action-new': {
      'click': require('./actions/new')
   },
   'action-gallery': {
      'click': require('./actions/open')
   },
   'action-save': {
      'click': require('./actions/save')
   },
   'action-upload': {
      'change': require('./actions/import')
   },
   'action-download': {
      'click': require('./actions/download')
   }
};
Object.keys(module.exports).forEach(function (id) {
   var elem = document.getElementById(id);
   if (elem) Object.keys(module.exports[id]).forEach(function (event) {
      elem.addEventListener(event, module.exports[id][event]);
   });
});