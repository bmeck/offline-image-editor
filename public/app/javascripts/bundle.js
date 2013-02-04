(function(){
var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/javascripts/src/fs-image.js",function(require,module,exports,__dirname,__filename,process,global){var FSFactory = require('./browserify-fs').FSFactory;
var path = require('path')
exports.createImageImplementation = function (dir, cb) {
   //
   // 25mb?
   //
   FSFactory(1024 * 1024 * 25, 'images', function(err, fs) {
      if (err) {
         cb(err, null);
         return;
      }
      function Image(id) {
         this.file = path.join(dir, id);
         return this;
      }
      Image.prototype.read = function (cb) {
         fs.readFileAsBlob(this.file, cb);
      }
      Image.prototype.write = function (data, cb) {
         fs.writeFile(this.file, data, cb);
      }
      Image.prototype.remove = function (cb) {
         fs.unlink(this.id, cb);
      }
      Image.list = function (cb) {
         fs.readdir(dir, function (err, files) {
            if (err && err.code === err.NOT_FOUND_ERR) {
               files = [];
            }
            cb(null, [].slice.call(files).map(function (file) {
               return file.name;
            }));
         });
      }
      fs.mkdir(dir, function (err) {
         if (err) {
            cb(err, null);
            return;
         }
         cb(null, Image);
      });
    });
}
});

require.define("/javascripts/src/browserify-fs.js",function(require,module,exports,__dirname,__filename,process,global){/**
  fs.js (c) OptimalBits 2012.
  
  A lightweight wrapper for the File System API inspired in nodejs fs module.
  
  authors: manuel@optimalbits.com
           linus@optimalbits.com
           
  Licensed as MIT.
   
*/
(function() {
  
  window.StorageInfo = window.StorageInfo || window.webkitStorageInfo;
  window.RequestFileSystem = window.RequestFileSystem || window.webkitRequestFileSystem;

  var FSFactory = function (size, folder, cb) {
    folder = folder || 'fs_folder';
    window.StorageInfo.requestQuota(PERSISTENT, size, function (grantedBytes) {
      window.RequestFileSystem(PERSISTENT, grantedBytes, function (fs) {
        fs.root.getDirectory(folder, {create:true}, function (entry) {
          cb(null, new FS(fs, entry, grantedBytes));
        }, cb);
      }, cb);
    }, cb);
  };

  /**
    The wrapper object.
  */
  var FS = function (fs, root, grantedBytes) {
    this.fs = fs;
    this.root = root;
    this._availableBytes = this._grantedBytes = grantedBytes;
  }
  
  FS.prototype = {
  
    /**
      rename(oldPath, newPath, callback)
    
      Renames a file or directory.
    */
    rename : function(path, newPath, cb){
      var self = this, root = self.root;
      traverse(root, path, function(err, entry){
        if(entry){
          traverse(root, dirname(newPath), function(err, dstDir){
            if(dstDir){
              entry.moveTo(dstDir, basename(newPath), function(){
                cb();
              }, cb);
            }else{
              cb(err);
            }
          });
        }else{
          cb(err);
        }
      });
    },
    
    truncate : function(path, length, cb){
      // IMPLEMENT using FileWriter truncate.
    },
    
    /**
      stat(path, callback)
      
      Calls the callback with stats object with the following data:
      
      isFile, isDirectory, size, mtime (modification time).
    */
    stats : function(path, cb){
      traverse(this.root, path, function(err, entry){
        if(entry){
          entry.getMetadata(function(meta){
            meta.isFile = function(){return entry.isFile};
            meta.isDirectory = function(){return entry.isDirectory};
            cb(null, meta);
          }, cb)
        }else{
          cb(err);
        }
      });
    },
    
    /** 
      Checks if a file exists or not.
      
      Test whether or not the given path exists by checking with the file system. 
      Then call the callback argument with either true or false
    */
    exists : function(path, cb){
      traverse(this.root, path, function(err){
        cb(err ? false : true);
      });
    },
    
    /**
      unlink(filename, callback)
      remove(filename, callback)
      
      Removes the given file from the filesystem.
    */
    unlink : function (filename, cb) {
      var self = this;
      self.root.getFile(filename, {}, function (fileEntry) {
        fileEntry.remove(function () {
          self._availableBytes += fileEntry.size;
          cb(null, true)
        }, cb)
      }, cb)
    },
    
    /**
      Removes a directory and all its contents.
      (to use if removeRecursively not available, or when wanting to delete
      the root of all filesystems).
    */
    rmdir : function(dirname, cb){
      var root = this.root;
      if(dirname == '/'){
        this.readdir('/', function(err, entries){
          if(!err){
            parallel(entries, function(entry, cb){
              entry.removeRecursively(cb, cb);
            }, cb);
          }else{
            cb(err);
          }
        });
      }else{
        traverse(root, dirname, function(err, entry){
          if(err || !entry.isDirectory){
            cb(err || new Error('Path is not a directory'));  
          }else{
            entry.removeRecursively(cb,cb);
          }
        });
      }
    },
        
    /**
      Creates a directory in the given path. 
      cb(err, entry)
      (Note that it will return error if the subpath does not exist).
    */
    mkdir : function(dirpath, cb){
      var self = this;
      traverse(this.root, dirname(dirpath), function(err, entry){
        if(err || !entry.isDirectory){
          cb(err || new Error('Path is not a directory'));
        }else{
          self._mkdir(entry, basename(dirpath), cb);
        }
      });
    },
    
    _mkdir : function(root, dir, cb){
      root.getDirectory(dir, {create:true}, function(entry){
        cb(null, entry);
      }, cb);
    },
    
    /**
      As mkdir but also creates all the folders in the dirpath if 
      needed.
      cb(err, entry).
    */
    mkpath : function(dirpath, cb){
      var components = dirpath.split('/');
      this._mkpath(this.root, components, cb);
    },
      
    _mkpath : function(root, components, cb){
      var self = this;
      if (components[0] == '.' || components[0] == '') {
        components = components.slice(1);
      }
      self._mkdir(root, components[0], function(err, entry){
        if(entry && components.length){
          self._mkpath(entry, components.slice(1), cb);
        }else{
          cb(err, entry);
        }
      });
    },
    
    /**
      Reads the content of a directory at the given path.
      cb(err, entries {Array of DirectoryEntry:s})
    */
    readdir : function(path, cb){
      traverse(this.root, path, function(err, entry){
        if(err || !entry.isDirectory){
          cb(err || new Error('Path is not a directory'));
        }else{
          var reader = entry.createReader();
          reader.readEntries(function(entries){
            cb(null, entries);
          }, cb);
        }
      });    
    },
    
    /**
      Changes the timestamps of a file or directory at the 
      given path.
    */
    utimes : function(path, atime, mtime, cb){
      // TO IMPLEMENT;
    },
      
    readFile : function(filename, encoding, cb){
      this.read.apply(this, arguments);
    },
    
    readFileAsBlob : function (filename, cb) {
      traverse(this.root, filename, function (err, entry) {
        if(entry){
          entry.file(function (blob) {
            cb(null, blob);
          }, cb);
        }else{
          cb(err);
        }
      });
    },
    
    readFileAsUrl : function (filename, cb) {
      traverse(this.root, filename, function (err, entry) {
        if(entry){
          cb(null, entry.toURL());
        }else{
          cb(err);
        }
      });
    },
    
    writeFile : function(filename, data, cb){
      this.write(filename, new Blob([data]), cb);
    },
    
    appendFile : function(filename, data, cb){
      this.append(filename, new Blob([data]), cb);
    },
    
    /**
      Wipes the whole file system. 
      
      wipe(cb, [full])
      
      Use full = true if you want to wipe the root dir of the filesystem,
      after doing this, the instance cannot be used anymore.
    */
    wipe : function (cb, full) {
      var self = this, folder = self.root.fullPath;
      self.root.removeRecursively(function(){
        if(!full){
          self.fs.root.getDirectory(folder, {create:true}, function (root) {
            self.root = root;
            self._availableBytes = self._grantedBytes;
            cb();
          }, cb);
        }else{
          cb();
        }
      }, cb);
    } 
  }
  
  FS.prototype.remove = FS.prototype.unlink;

  //File.prototype.getAvailableBytes = function(cb) {
  //  cb(null, this._available_bytes);
  //}
  FS.prototype.read = function (filename, encoding, cb) {
    if(arguments.length==2){
      cb = encoding;
      encoding = undefined;
    }
    traverse(this.root, filename, function (err, entry) {
      if(entry){
        entry.file(function (file) {
          var reader = new FileReader();
          reader.onloadend = function (e) {
            cb(null, this.result);
          };
          if(encoding){
            reader.readAsText(file, encoding);
          }else{
            reader.readAsArrayBuffer(file);
          }
        }, cb);
      }else{
        cb(err);
      }
    });
  };
    
  /**
     Writes a blob to a file, and returns fileEntry if succesful.
  */
  FS.prototype.write = function (filename, blob, cb) {
    var self = this;
    self.root.getFile(filename, {create: true, exclusive: true}, function (entry) {
      self.append(filename, blob, cb);
    }, function(err){
      self.remove(filename, function(){
        self.write(filename, blob, cb);
      }, cb);
    });
  };

  FS.prototype.append = function (filename, blob, cb) {
    var self = this;
    this.root.getFile(filename, {create:true}, function (fileEntry) {
      fileEntry.createWriter(function (fileWriter) {
        fileWriter.onwriteend = function (e) {
          self._availableBytes -= fileEntry.size;
          cb(null, fileEntry);
        };
        fileWriter.seek(fileWriter.length);
        fileWriter.onerror = cb;
        fileWriter.write(blob);
      }, cb);
    }, cb);
  };

  FS.prototype.validateFileSize = function(filename, size, cb) {
    traverse(this.root, filename, function (fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        if (fileWriter.length == size) {
          cb(null, true);
        } else {
          cb(new Error('Wrong filesize'));
        }
      }, cb);
    }, cb);
  };
  
  FS.prototype.errorHandler = function (e) {
    var msg = '';

    switch (e.code) {
      case FileError.QUOTA_EXCEEDED_ERR:
        msg = 'QUOTA_EXCEEDED_ERR';
        break;
      case FileError.NOT_FOUND_ERR:
        msg = 'NOT_FOUND_ERR';
        break;
      case FileError.SECURITY_ERR:
        msg = 'SECURITY_ERR';
        break;
      case FileError.INVALID_MODIFICATION_ERR:
        msg = 'INVALID_MODIFICATION_ERR';
        break;
      case FileError.INVALID_STATE_ERR:
        msg = 'INVALID_STATE_ERR';
        break;
      default:
        msg = 'Unknown Error';
        break;
    }

    console.log('File System Error: ' + msg);
  };
  
  /**
     Traverse the file system and returns a FileEntry 
     or a DirectoryEntry (or error if path does not exist).
  */
  function traverse(root, path, cb){    
    function visit(entry, components, index, cb){
      if(index === components.length){
        cb(null, entry);
      }else{
        if(entry.isDirectory){
          entry.getDirectory(components[index], {}, function(entry){
            visit(entry, components, index+1, cb);
          }, function(err){
            if(err && err.code == err.TYPE_MISMATCH_ERR){
              entry.getFile(components[index], {}, function(entry){
                visit(entry, components, index+1, cb);
              }, cb);
            }else{
              cb(err);
            }
          });
        }else{
          cb(new Error(entry.fullPath+' not a valid directory'));
        }
      }
    }
    
    if(path == '/' && path == ''){
      cb(null, root);
    }else{
      visit(root, path.split('/'), 0, cb);
    }
  }
  
  function dirname(path){
    var s = path.split('/'); 
    s.pop();
    return s.join('/');
  }
  
  function basename(path){
    return path.split('/').pop();
  }
  
  function parallel(entries, fn, cb){
    var counter = 0, length = entries.length, error;
    for(var i=0; i < length; i++){
      fn(entries[i], function(err){
        error = error || err;
        counter++;
        if(counter==length){
          cb(error);
        }
      });
    }
  }
  
  // AMD define happens at the end for compatibility with AMD loaders
  // that don't enforce next-turn semantics on modules.
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return FSFactory;
    });
  }else{
    this.FSFactory = FSFactory;
  }
  
}).call(typeof exports == 'object' ? exports : this);

});

require.define("/javascripts/src/events.js",function(require,module,exports,__dirname,__filename,process,global){var async = require('async');
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
               new img(file).read(function (err, data) {
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
                  img.onclick = function (e) {
                     console.log(radio)
                     radio.click(e);
                  };
                  label.appendChild(image);
               });
               index++;
            },
            openDialog('gallery-dialog', function (data, form) {
               var filename = form.querySelector('input:checked').value;
               new img(filename).read(function (err, data) {
                  var image = new Image();
                  image.onload = function () {
                     document.getElementById('save-name').value = filename;
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
            );
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
});

require.define("/node_modules/async/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./index"}
});

require.define("/node_modules/async/index.js",function(require,module,exports,__dirname,__filename,process,global){// This file is just added for convenience so this repository can be
// directly checked out into a project's deps folder
module.exports = require('./lib/async');

});

require.define("/node_modules/async/lib/async.js",function(require,module,exports,__dirname,__filename,process,global){/*global setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root = this,
        previous_async = root.async;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    else {
        root.async = async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    //// cross-browser compatiblity functions ////

    var _forEach = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _forEach(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _forEach(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        async.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
    }
    else {
        async.nextTick = process.nextTick;
    }

    async.forEach = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _forEach(arr, function (x) {
            iterator(x, function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                }
            });
        });
    };

    async.forEachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };

    async.forEachLimit = function (arr, limit, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length || limit <= 0) {
            return callback();
        }
        var completed = 0;
        var started = 0;
        var running = 0;

        (function replenish () {
            if (completed === arr.length) {
                return callback();
            }

            while (running < limit && started < arr.length) {
                started += 1;
                running += 1;
                iterator(arr[started - 1], function (err) {
                    if (err) {
                        callback(err);
                        callback = function () {};
                    }
                    else {
                        completed += 1;
                        running -= 1;
                        if (completed === arr.length) {
                            callback();
                        }
                        else {
                            replenish();
                        }
                    }
                });
            }
        })();
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEach].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);


    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.forEachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _forEach(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _forEach(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                if (err) {
                    callback(err);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    taskComplete();
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.nextTick(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    async.parallel = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEach(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.queue = function (worker, concurrency) {
        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _forEach(data, function(task) {
                    q.tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (q.saturated && q.tasks.length == concurrency) {
                        q.saturated();
                    }
                    async.nextTick(q.process);
                });
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if(q.empty && q.tasks.length == 0) q.empty();
                    workers += 1;
                    worker(task.data, function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if(q.drain && q.tasks.length + workers == 0) q.drain();
                        q.process();
                    });
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _forEach(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

}());

});

require.define("/javascripts/src/editor-tools.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = {
   pen: require('./tools/pen'),
   eyedropper: require('./tools/eyedropper')
}
});

require.define("/javascripts/src/tools/pen.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   ctx.fillStyle = document.getElementById('setting-color').value;
   ctx.fillRect(e.clientX - c.offsetLeft - 5, e.clientY - c.offsetTop - 5, 10, 10);
}
});

require.define("/javascripts/src/tools/eyedropper.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   var rgba = ctx.getImageData(e.clientX - c.offsetLeft, e.clientY - c.offsetTop, 1, 1);
   var color = '#' + ([].slice.call(rgba.data).map(function (chan) {
      return chan < 16 ? '0' + chan.toString(16) : chan.toString(16);
   }).join('')).slice(0,-2);
   document.getElementById('setting-color').value = color
}
});

require.define("/javascripts/src/main.js",function(require,module,exports,__dirname,__filename,process,global){require('./fs-image').createImageImplementation('pictures', function (err, imageImplementation) {
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

});
require("/javascripts/src/main.js");

})();
