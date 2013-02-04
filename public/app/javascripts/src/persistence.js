window.onload = function () {
   var selectedTool = localStorage.getItem('selectedTool');
   if (selectedTool) {
      document.querySelector('input[name="tool"][value="'+selectedTool+'"]').checked = 'checked';
   }
   var settings = JSON.parse(localStorage.getItem('settings'));
   if (settings) {
      settings.forEach(function (setting) {
         document.getElementById(setting[0]).value = setting[1];
      })
   }
}
window.onunload = function () {
   var tool = document.querySelector('input[name="tool"]:checked');
   localStorage.setItem('selectedTool', tool.value);
   var settingsElements = [].slice.call(document.querySelectorAll('input[id^="setting-"]'));
   var settings = settingsElements.map(function (elem) {
      return [elem.id, elem.value];
   })
   localStorage.setItem('settings', JSON.stringify(settings));
}