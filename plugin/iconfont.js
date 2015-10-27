
var _, cacheFilePath, didInvalidateCache, fs, generateCacheChecksum, generateEOTFont, generateFonts, generateSVGFont, generateStylesheets, generateTTFFont, generateWoffFont, getFiles, getFontSrcURL, handler, loadJSONFile, md5, optionsFile, path, svg2ttf, svgicons2svgfont, temp, ttf2eot, ttf2woff;

_ = Npm.require('lodash');

fs = Npm.require('fs-extra');

path = Npm.require('path');

temp = Npm.require('temp').track();

md5 = Npm.require('MD5');

svg2ttf = Npm.require('svg2ttf');

ttf2eot = Npm.require('ttf2eot');

ttf2woff = Npm.require('ttf2woff');

svgicons2svgfont = Npm.require('svgicons2svgfont');

optionsFile = path.join(process.cwd(), 'iconfont.json');

cacheFilePath = path.join(process.cwd(), '.meteor/iconfont.cache');

//const path = Plugin.path;
//const fs = Plugin.fs;
const Future = Npm.require('fibers/future');
const files = Plugin.files;

Plugin.registerCompiler({
  extensions: ['svg'],
  filenames: ['iconfont.json'],
  archMatching: 'web'
}, () => new IconFontCompiler());

handler = function(compileStep) {
  var options;
  options = fs.existsSync(optionsFile) ? loadJSONFile(optionsFile) : {};
  console.dir(options);
  compileStep.inputPath = 'iconfont.json';
  options = _.extend({
    src: 'svgs',
    dest: 'public/fonts/icons',
    fontFaceBaseURL: '/fonts/icons',
    fontName: 'icons',
    fontHeight: 512,
    stylesheetsDestBasePath: 'client',
    descent: 64,
    normalize: true,
    classPrefix: 'icon-',
    stylesheetFilename: null,
    stylesheetTemplate: '.meteor/local/isopacks/andrefgneves_iconfont/os/packages/andrefgneves_iconfont/plugin/stylesheet.tpl',
    types: ['svg', 'ttf', 'eot', 'woff']
  }, options);
  if (!options.types || !options.types.length) {
    return;
  }
  options.files = getFiles(options.src);
  if (didInvalidateCache(options)) {
    console.log('\n[iconfont] generating');
    options.fontFaceURLS = {};
    options.types = _.map(options.types, function(type) {
      return type.toLowerCase();
    });
    return generateFonts(compileStep, options);
  }
};

didInvalidateCache = function(options) {
  var didInvalidate, newCacheChecksum, oldCacheChecksum;
  didInvalidate = false;
  newCacheChecksum = generateCacheChecksum(options);
  if (!fs.existsSync(cacheFilePath)) {
    didInvalidate = true;
  } else {
    oldCacheChecksum = fs.readFileSync(cacheFilePath, {
      encoding: 'utf8'
    });
    didInvalidate = newCacheChecksum !== oldCacheChecksum;
  }
  if (didInvalidate) {
    fs.writeFileSync(cacheFilePath, newCacheChecksum);
  }
  return didInvalidate;
};

generateCacheChecksum = function(options) {
  var checksums, settingsChecksum;
  checksums = [];
  settingsChecksum = md5(fs.readFileSync(optionsFile));
  _.each(options.files, function(file) {
    var checksum;
    checksum = md5(path.basename(file) + fs.readFileSync(file));
    return checksums.push(checksum);
  });
  return md5(settingsChecksum + JSON.stringify(checksums));
};

generateFonts = function(compileStep, options) {
  return generateSVGFont(options.files, options, function(svgFontPath) {
    if (_.intersection(options.types, ['ttf', 'eot', 'woff']).length) {
      generateTTFFont(svgFontPath, options, function(ttfFontPath) {
        if (_.contains(options.types, 'eot')) {
          generateEOTFont(ttfFontPath, options);
        }
        if (_.contains(options.types, 'woff')) {
          return generateWoffFont(ttfFontPath, options);
        }
      });
    }
    return generateStylesheets(compileStep, options);
  });
};

generateSVGFont = function(files, options, done) {
  var codepoint, fontStream, tempStream;
  codepoint = 0xE001;
  options.glyphs = _.compact(_.map(files, function(file) {
    var matches;
    matches = file.match(/^(?:u([0-9a-f]{4})\-)?(.*).svg$/i);
    if (matches) {
      return {
        name: path.basename(matches[2]).toLowerCase().replace(/\s/g, '-'),
        stream: fs.createReadStream(file),
        codepoint: matches[1] ? parseInt(matches[1], 16) : codepoint++
      };
    }
    return false;
  }));
  fontStream = svgicons2svgfont(options.glyphs, _.extend(options, {
    log: function() {},
    error: function() {}
  }));
  tempStream = temp.createWriteStream();
  return fontStream.pipe(tempStream).on('finish', function() {
    var svgDestPath;
    if (_.contains(options.types, 'svg')) {
      svgDestPath = path.join(process.cwd(), options.dest, options.fontName + '.svg');
      fs.createFileSync(svgDestPath);
      fs.writeFileSync(svgDestPath, fs.readFileSync(tempStream.path));
      options.fontFaceURLS.svg = path.join(options.fontFaceBaseURL, options.fontName + '.svg');
    }
    if (_.isFunction(done)) {
      return done(tempStream.path);
    }
  });
};

generateTTFFont = function(svgFontPath, options, done) {
  var font, tempFile, ttfDestPath;
  font = svg2ttf(fs.readFileSync(svgFontPath, {
    encoding: 'utf8'
  }), {});
  font = new Buffer(font.buffer);
  tempFile = temp.openSync(options.fontName + '-ttf');
  fs.writeFileSync(tempFile.path, font);
  if (_.contains(options.types, 'ttf')) {
    ttfDestPath = path.join(process.cwd(), options.dest, options.fontName + '.ttf');
    fs.createFileSync(ttfDestPath);
    fs.writeFileSync(ttfDestPath, font);
    options.fontFaceURLS.ttf = path.join(options.fontFaceBaseURL, options.fontName + '.ttf');
  }
  if (_.isFunction(done)) {
    return done(tempFile.path);
  }
};

generateEOTFont = function(ttfFontPath, options, done) {
  var eotDestPath, font, tempFile, ttf;
  ttf = new Uint8Array(fs.readFileSync(ttfFontPath));
  font = new Buffer(ttf2eot(ttf).buffer);
  tempFile = temp.openSync(options.fontName + '-eot');
  fs.writeFileSync(tempFile.path, font);
  eotDestPath = path.join(process.cwd(), options.dest, options.fontName + '.eot');
  fs.createFileSync(eotDestPath);
  fs.writeFileSync(eotDestPath, font);
  options.fontFaceURLS.eot = path.join(options.fontFaceBaseURL, options.fontName + '.eot');
  if (_.isFunction(done)) {
    return done(tempFile.path);
  }
};

generateWoffFont = function(ttfFontPath, options, done) {
  var eotDestPath, font, tempFile, ttf;
  ttf = new Uint8Array(fs.readFileSync(ttfFontPath));
  font = new Buffer(ttf2woff(ttf).buffer);
  tempFile = temp.openSync(options.fontName + '-woff');
  fs.writeFileSync(tempFile.path, font);
  eotDestPath = path.join(process.cwd(), options.dest, options.fontName + '.woff');
  fs.createFileSync(eotDestPath);
  fs.writeFileSync(eotDestPath, font);
  options.fontFaceURLS.woff = path.join(options.fontFaceBaseURL, options.fontName + '.woff');
  if (_.isFunction(done)) {
    return done(tempFile.path);
  }
};

generateStylesheets = function(compileStep, options) {
  var classNames, data, fileName, filePath, fontSrcs, glyphCodepointMap, results, srcs, stylesheetDestPath, stylesheets, template, templatePath;
  fontSrcs = [];
  glyphCodepointMap = {};
  classNames = _.map(options.glyphs, function(glyph) {
    return '.' + options.classPrefix + glyph.name.replace(/\s+/g, '-');
  });
  _.each(options.glyphs, function(glyph) {
    return glyphCodepointMap[glyph.name] = glyph.codepoint.toString(16);
  });
  if (_.contains(options.types, 'eot')) {
    fontSrcs.push(getFontSrcURL({
      baseURL: options.fontFaceBaseURL,
      fontName: options.fontName,
      extension: '.eot'
    }));
  }
  srcs = [];
  _.each(options.types, function(type) {
    switch (type) {
      case 'svg':
        return srcs.push(getFontSrcURL({
          baseURL: options.fontFaceBaseURL,
          fontName: options.fontName,
          extension: '.svg#' + options.fontName,
          format: 'svg'
        }));
      case 'ttf':
        return srcs.push(getFontSrcURL({
          baseURL: options.fontFaceBaseURL,
          fontName: options.fontName,
          extension: '.ttf',
          format: 'truetype'
        }));
      case 'eot':
        return srcs.push(getFontSrcURL({
          baseURL: options.fontFaceBaseURL,
          fontName: options.fontName,
          extension: '.eot?#iefix',
          format: 'embedded-opentype'
        }));
      case 'woff':
        return srcs.push(getFontSrcURL({
          baseURL: options.fontFaceBaseURL,
          fontName: options.fontName,
          extension: '.woff',
          format: 'woff'
        }));
    }
  });
  fontSrcs.push(srcs.join(', '));
  if (!options.stylesheets) {
    stylesheets = {};
    options.stylesheetFilename = options.stylesheetFilename || (options.fontName + '.css');
    stylesheets[options.stylesheetFilename] = options.stylesheetTemplate;
  } else {
    stylesheets = options.stylesheets;
  }
  results = [];
  for (fileName in stylesheets) {
    filePath = stylesheets[fileName];
    templatePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(templatePath)) {
      console.log("\n[iconfont] template file not found at " + templatePath);
      continue;
    }
    template = fs.readFileSync(templatePath, 'utf8');
    data = _.template(template, {
      glyphCodepointMap: glyphCodepointMap,
      classPrefix: options.classPrefix,
      classNames: classNames.join(', '),
      fontName: options.fontName,
      fontFaceBaseURL: options.fontFaceBaseURL,
      types: options.types,
      fontSrcs: fontSrcs
    });
    stylesheetDestPath = path.join(options.stylesheetsDestBasePath, fileName);
    fs.ensureFileSync(stylesheetDestPath);
    fs.writeFileSync(stylesheetDestPath, data);
    if (path.extname(stylesheetDestPath) === '.css') {
      results.push(compileStep.addStylesheet({
        path: stylesheetDestPath,
        data: data
      }));
    } else {
      results.push(void 0);
    }
  }
  return results;
};

getFontSrcURL = function(options) {
  var parts;
  parts = ['url("', options.baseURL, '/', options.fontName, options.extension, '")'];
  if (_.isString(options.format && options.format.length)) {
    parts = parts.concat([' format("', options.format, '")']);
  }
  return parts.join('');
};

getFiles = function(srcPaths) {
  var matches;
  if (_.isString(srcPaths)) {
    srcPaths = [srcPaths];
  }
  matches = _.map(srcPaths, function(srcPath) {
    srcPath = path.join(process.cwd(), srcPath);
    if (!fs.existsSync(srcPath)) {
      return false;
    }
    return fs.readdirSync(srcPath).map(function(file) {
      if (path.extname(file) === '.svg') {
        return path.join(srcPath, file);
      }
      return false;
    });
  });
  return _.uniq(_.compact(_.flatten(matches)));
};

loadJSONFile = function(filePath) {
  var content, error, error1;
  content = fs.readFileSync(filePath);
  try {
    return JSON.parse(content);
  } catch (error1) {
    error = error1;
    console.log('Error: failed to parse ', filePath, ' as JSON');
    return {};
  }
};


var toPosixPath = function (p, partialPath) {
  // Sometimes, you can have a path like \Users\IEUser on windows, and this
  // actually means you want C:\Users\IEUser
  if (p[0] === "\\" && (! partialPath)) {
    p = process.env.SystemDrive + p;
  }

  p = p.replace(/\\/g, '/');
  if (p[1] === ':' && ! partialPath) {
    // transform "C:/bla/bla" to "/c/bla/bla"
    p = '/' + p[0] + p.slice(2);
  }

  return p;
};

var convertToStandardPath = function (osPath, partialPath) {
  if (process.platform === "win32") {
    return toPosixPath(osPath, partialPath);
  }

  return osPath;
};

function decodeFilePath (filePath) {
  const match = filePath.match(/({(.*)\:(.*)}\/(.*))|(.*)$/);
  if (! match)
    throw new Error('Failed to decode Less path: ' + filePath);

  if (match[1] === '') {
    // app
    return match[5];
  }

  return '.meteor/local/build/programs/server/assets/packages/' + match[2] + '_' + match[3] + '/' + match[4];
}

// CompileResult is {css, sourceMap}.
class IconFontCompiler  {
  processFilesForTarget(files) {
    var options;
    options = fs.existsSync(optionsFile) ? loadJSONFile(optionsFile) : {};
    // console.dir(options);
    options = _.extend({
      src: 'svgs',
      dest: 'public/fonts/icons',
      fontFaceBaseURL: '/fonts/icons',
      fontName: 'icons',
      fontHeight: 512,
      stylesheetsDestBasePath: 'client',
      descent: 64,
      normalize: true,
      classPrefix: 'icon-',
      stylesheetFilename: null,
      stylesheetTemplate: '{aheissenberger:iconfont}/tpl/stylesheet-css.tpl',
      types: ['svg', 'ttf', 'eot', 'woff']
    }, options);
    if (!options.types || !options.types.length) {
      return;
    }
    options.files = [];
    if (typeof(options.src) !== 'string') options.src=[options.src];
    files.map( (file) => {
      options.src.map( (src) => {
        if (file.getDirname().startsWith(src)) options.files.push( path.join(process.cwd(), file.getPathInPackage() ) );
      });
    });
    if (options.files.length==0) return; // no files to process
    //getFiles(options.src);
    if (this.didInvalidateCache(options)) {
      console.log('\n[iconfont] generating');
      options.fontFaceURLS = {};
      options.types = _.map(options.types, function(type) {
        return type.toLowerCase();
      });
      if (!this.generateFonts(options)) return;
      this.generateStylesheets(options, files[0]);
      fs.writeFileSync(cacheFilePath, this.generateCacheChecksum(options));
    }
  }

  didInvalidateCache(options) {
    var didInvalidate, newCacheChecksum, oldCacheChecksum;
    didInvalidate = false;
    newCacheChecksum = this.generateCacheChecksum(options);
    if (!fs.existsSync(cacheFilePath)) {
      didInvalidate = true;
    } else {
      oldCacheChecksum = fs.readFileSync(cacheFilePath, {
        encoding: 'utf8'
      });
      didInvalidate = newCacheChecksum !== oldCacheChecksum;
    }
    // if (didInvalidate) {
    //   fs.writeFileSync(cacheFilePath, newCacheChecksum);
    // }
    return didInvalidate;
  }

  generateCacheChecksum(options) {
    var checksums, settingsChecksum;
    checksums = [];
    settingsChecksum = md5(fs.readFileSync(optionsFile));
    _.each(options.files, function(file) {
      var checksum;
      checksum = md5(path.basename(file) + fs.readFileSync(file));
      return checksums.push(checksum);
    });
    options.types.map( (type) => {
      var checksum;
      DestPath = path.join(process.cwd(),options.dest, options.fontName + '.' + type);
      if (fs.existsSync(DestPath)) {
        checksum = md5(DestPath + fs.readFileSync(DestPath));
        checksums.push(checksum);
      }
    });
    return md5(settingsChecksum + JSON.stringify(checksums));
  };

  generateFonts(options) {
    var svgFontPath = this.generateSVGFont(options.files, options);
    if (_.intersection(options.types, ['ttf', 'eot', 'woff']).length) {
      var ttfFontPath = this.generateTTFFont(svgFontPath, options);
      if (_.contains(options.types, 'eot')) {
        this.generateEOTFont(ttfFontPath, options);
      }
      if (_.contains(options.types, 'woff')) {
        this.generateWoffFont(ttfFontPath, options);
      }
    }
    return true;
  }

  generateSVGFont(files, options) {
    var codepoint, fontStream, tempStream;
    codepoint = 0xE001;

    options.glyphs = _.compact(_.map(files, function(file) {
      var matches;
      matches = file.match(/^(?:u([0-9a-f]{4})\-)?(.*).svg$/i);
      if (matches) {
        return {
          name: path.basename(matches[2]).toLowerCase().replace(/\s/g, '-'),
          stream: fs.createReadStream(file),
          codepoint: matches[1] ? parseInt(matches[1], 16) : codepoint++
        };
      }
      return false;
    }));
    fontStream = svgicons2svgfont(options.glyphs, _.extend(options, {
      log: function() {},
      error: function() {future.ret( );}
    }));
    tempStream = temp.createWriteStream();

    var future = new Future();
    fontStream.pipe(tempStream).on('finish', function() {

      var svgDestPath;
      if (_.contains(options.types, 'svg')) {
        svgDestPath = path.join(process.cwd(), options.dest, options.fontName + '.svg');

        fs.createFileSync(svgDestPath);
        fs.writeFileSync(svgDestPath, fs.readFileSync(tempStream.path));
        options.fontFaceURLS.svg = path.join(options.fontFaceBaseURL, options.fontName + '.svg');
      }
      future.return(tempStream.path);
    });
    return future.wait();
  }

  generateTTFFont(svgFontPath, options) {
    var font, tempFile, ttfDestPath;
    font = svg2ttf(fs.readFileSync(svgFontPath, {
      encoding: 'utf8'
    }), {});
    font = new Buffer(font.buffer);
    tempFile = temp.openSync(options.fontName + '-ttf');
    fs.writeFileSync(tempFile.path, font);
    if (_.contains(options.types, 'ttf')) {
      ttfDestPath = path.join(process.cwd(), options.dest, options.fontName + '.ttf');
      fs.createFileSync(ttfDestPath);
      fs.writeFileSync(ttfDestPath, font);
      options.fontFaceURLS.ttf = path.join(options.fontFaceBaseURL, options.fontName + '.ttf');
    }
    return tempFile.path;
  }

  generateEOTFont(ttfFontPath, options) {
    var eotDestPath, font, tempFile, ttf;
    ttf = new Uint8Array(fs.readFileSync(ttfFontPath));
    font = new Buffer(ttf2eot(ttf).buffer);
    tempFile = temp.openSync(options.fontName + '-eot');
    fs.writeFileSync(tempFile.path, font);
    eotDestPath = path.join(process.cwd(), options.dest, options.fontName + '.eot');
    fs.createFileSync(eotDestPath);
    fs.writeFileSync(eotDestPath, font);
    options.fontFaceURLS.eot = path.join(options.fontFaceBaseURL, options.fontName + '.eot');
  }

  generateWoffFont(ttfFontPath, options) {
    var eotDestPath, font, tempFile, ttf;
    ttf = new Uint8Array(fs.readFileSync(ttfFontPath));
    font = new Buffer(ttf2woff(ttf).buffer);
    tempFile = temp.openSync(options.fontName + '-woff');
    fs.writeFileSync(tempFile.path, font);
    eotDestPath = path.join(process.cwd(), options.dest, options.fontName + '.woff');
    fs.createFileSync(eotDestPath);
    fs.writeFileSync(eotDestPath, font);
    options.fontFaceURLS.woff = path.join(options.fontFaceBaseURL, options.fontName + '.woff');
  }

  generateStylesheets( options, fontFile) {
    // if (!(options.stylesheets || typeof(_iconfontAsset)=='function')) {
    //   console.error('Template missing! Install aheissenberger:iconfont-css, aheissenberger:iconfont-sass or define path to template.');
    //   return;
    // }
    var classNames, data, fileName, filePath, fontSrcs, glyphCodepointMap, results, srcs, stylesheetDestPath, stylesheets, template, templatePath;
    fontSrcs = [];
    glyphCodepointMap = {};
    classNames = _.map(options.glyphs, function(glyph) {
      return '.' + options.classPrefix + glyph.name.replace(/\s+/g, '-');
    });
    _.each(options.glyphs, function(glyph) {
      return glyphCodepointMap[glyph.name] = glyph.codepoint.toString(16);
    });
    if (_.contains(options.types, 'eot')) {
      fontSrcs.push(getFontSrcURL({
        baseURL: options.fontFaceBaseURL,
        fontName: options.fontName,
        extension: '.eot'
      }));
    }
    srcs = [];
    _.each(options.types, function(type) {
      switch (type) {
        case 'svg':
          return srcs.push(getFontSrcURL({
            baseURL: options.fontFaceBaseURL,
            fontName: options.fontName,
            extension: '.svg#' + options.fontName,
            format: 'svg'
          }));
        case 'ttf':
          return srcs.push(getFontSrcURL({
            baseURL: options.fontFaceBaseURL,
            fontName: options.fontName,
            extension: '.ttf',
            format: 'truetype'
          }));
        case 'eot':
          return srcs.push(getFontSrcURL({
            baseURL: options.fontFaceBaseURL,
            fontName: options.fontName,
            extension: '.eot?#iefix',
            format: 'embedded-opentype'
          }));
        case 'woff':
          return srcs.push(getFontSrcURL({
            baseURL: options.fontFaceBaseURL,
            fontName: options.fontName,
            extension: '.woff',
            format: 'woff'
          }));
      }
    });
    fontSrcs.push(srcs.join(', '));
    if (!options.stylesheets) {
      stylesheets = {};
      options.stylesheetFilename = options.stylesheetFilename || (options.fontName + '.css');
      stylesheets[options.stylesheetFilename] = options.stylesheetTemplate;
    } else {
      stylesheets = options.stylesheets;
    }
    results = [];
    for (fileName in stylesheets) {
      filePath = decodeFilePath(stylesheets[fileName]);
      // template = filePath ? _iconfontAsset() : Assets.getText(filePath);
      templatePath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(templatePath)) {
        console.log("\n[iconfont] template file not found at " + templatePath);
        continue;
      }
      template = fs.readFileSync(templatePath, 'utf8');
      data = _.template(template, {
        glyphCodepointMap: glyphCodepointMap,
        classPrefix: options.classPrefix,
        classNames: classNames.join(', '),
        fontName: options.fontName,
        fontFaceBaseURL: options.fontFaceBaseURL,
        types: options.types,
        fontSrcs: fontSrcs
      });
      stylesheetDestPath = path.join(options.stylesheetsDestBasePath, fileName);
      fs.ensureFileSync(stylesheetDestPath);
      fs.writeFileSync(stylesheetDestPath, data);
      if (path.extname(stylesheetDestPath) === '.css') {
        console.log(stylesheetDestPath);
        fontFile.addStylesheet({
          path: stylesheetDestPath,
          data: data
        });
      } 
    }
    return results;
  }

}
