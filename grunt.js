
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      files: ['!public/app/javascripts/bundle.js','!public/app/app.appcache','public/app/**'], 
      tasks: [ 'browserify', 'manifest' ]
    },
    manifest: {
      generate: {
        options: {
          basePath: 'public/app',
          verbose: true,
          timestamp: true
        },
        src: [
            'index.html',
            'javascripts/*.js',
            'images/**',
            'stylesheets/**'
        ],
        dest: 'app.appcache'
      }
    },
    browserify: {
      'public/app/javascripts/bundle.js': {
        src: [
          'public/app/javascripts/src/main.js'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-manifest');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');

  // Default task(s).
  grunt.registerTask('default', ['browserify', 'manifest']);

};
