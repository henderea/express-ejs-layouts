/*jslint sloppy:true indent:2 plusplus:true regexp:true*/

var contentPattern = '&&<>&&';

const block = {
  layout(name) {
    return `${contentPattern}${name}${contentPattern}`;
  },
  start(name) {
    return `${contentPattern}<${name}>${contentPattern}`;
  },
  end(name) {
    return `${contentPattern}</${name}>${contentPattern}`;
  }
};

function parseContents(locals) {
  let str = locals.body;
  const layoutRegex = new RegExp('\n?' + contentPattern + '([^<>\n]+?)' + contentPattern + '\n?', 'g');
  const layoutMatches = layoutRegex.exec(str);
  if(layoutMatches != null) {
    locals.layout = layoutMatches[1];
  }
  str = str.replace(layoutRegex, '');
  const regex = new RegExp('\n?' + contentPattern + '<([^/].*?)>' + contentPattern + '\n?([\\s\\S]*?)\n?' + contentPattern + '</\\1>' + contentPattern + '\n?', 'g')
  let match;
  while((match = regex.exec(str)) !== null) {
    let name = match[1];
    locals[name] = match[2];
  }
  str = str.replace(regex, '');
  locals.body = str;
}

function parseScripts(locals) {
  var str = locals.body, regex = /\<script[\s\S]*?\>[\s\S]*?\<\/script\>/g;

  if (regex.test(str)) {
    locals.body = str.replace(regex, '');
    locals.script = str.match(regex).join('\n');
  }
}

function parseStyles(locals) {
  var str = locals.body, regex = /(?:\<style[\s\S]*?\>[\s\S]*?\<\/style\>)|(?:\<link[\s\S]*?\>(?:\<\/link\>)?)/g;

  if (regex.test(str)) {
    locals.body = str.replace(regex, '');
    locals.style = str.match(regex).join('\n');
  }
}

function parseMetas(locals) {
  var str = locals.body, regex = /\<meta[\s\S]*?\>/g;

  if (regex.test(str)) {
    locals.body = str.replace(regex, '');
    locals.meta = str.match(regex).join('\n');
  }
}

module.exports = function (req, res, next) {
  if(!res.__render) res.__render = res.render;

  res.render = function (view, options, fn) {
    var layout, self = this, app = req.app,
      defaultLayout = app.get('layout');

    options = options || {};
    if (typeof options === 'function') {
      fn = options;
      options = {};
    }

    if (options.layout === false || ((options.layout || defaultLayout) === false)) {
      res.__render.call(res, view, options, fn);
      return;
    }

    layout = options.layout || res.locals.layout || defaultLayout;
    if (layout === true || layout === undefined) {
      layout = 'layout';
    }

    options.block = block;
    res.__render.call(res, view, options, function (err, str) {
      var l, locals;

      if (err) { return fn ? fn(err) : next(err); }

      console.log(str);

      function layoutBlock(name) {
        return locals[name] || (locals.__fallback[name] && locals.__fallback[name]()) || '';
      }
      layoutBlock.fallback = function(name, fallback) {
        locals.__fallback = locals.__fallback || {};
        locals.__fallback[name] = () => { fallback(); return ''; };
      }
      locals = {
        body: str,
        block: layoutBlock
      };

      for (l in options) {
        if (options.hasOwnProperty(l) && l !== 'layout' && l !== 'block') {
          locals[l] = options[l];
        }
      }

      if (typeof locals.body !== 'string') {
        res.__render.call(self, view, locals, fn);
        return;
      }

      if (options.extractScripts === true || (options.extractScripts === undefined && app.get('layout extractScripts') === true)) {
        locals.script = '';
        parseScripts(locals);
      }

      if (options.extractStyles === true || (options.extractStyles === undefined && app.get('layout extractStyles') === true)) {
        locals.style = '';
        parseStyles(locals);
      }

      if (options.extractMetas === true || (options.extractMetas === undefined && app.get('layout extractMetas') === true)) {
        locals.meta = '';
        parseMetas(locals);
      }

      console.log(locals);
      parseContents(locals);
      console.log(locals);
      res.__render.call(self, layout, locals, fn);
    });
  };
  next();
};
