Package.describe({
    summary: 'Generate an icon font from SVG files',
    version: '0.0.1',
    git:     'https://github.com/aheissenberger/meteor-iconfont.git',
    name:    'aheissenberger:iconfont',
    documentation: 'README.md'
});

Package.registerBuildPlugin({
  name: "aheissenberger:iconfont",
  use: ['caching-compiler@1.0.0', 'ecmascript@0.1.5', 'underscore@1.0.4'],
  sources: [
    'plugin/iconfont.js'
  ],
  npmDependencies: {
    'fs-extra':         '0.16.5',
    'lodash':           '2.4.1',
    'MD5':              '1.2.1',
    'svg2ttf':          '1.2.0',
    'svgicons2svgfont': '1.0.0',
    'temp':             '0.7.0',
    'ttf2eot':          '1.3.0',
    'ttf2woff':         '1.2.0',    
  }
});

Package.onUse(function (api) {
    api.versionsFrom('1.2.0.2');
    api.use('isobuild:compiler-plugin@1.0.0');
    // api.use('aheissenberger:iconfont-css',{weak:true, unordered: false});
    // api.use('aheissenberger:iconfont-sass',{weak:true, unordered: false});
    api.addAssets('tpl/stylesheet-css.tpl', 'server');
    api.addAssets('tpl/stylesheet-sass.tpl', 'server');
});



Package.on_test(function (api) {
    api.use('aheissenberger:iconfont');
    api.use('tinytest');

    api.addFiles('iconfont_tests.js');
});

