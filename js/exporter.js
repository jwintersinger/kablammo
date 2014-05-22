function Exporter(container_selector, export_svg_selector, export_png_selector) {
  var self = this;
  var handle_click = function(export_callback) {
    return function() {
      var svg = $(this).parents('.subject').find('svg');
      var styles = self._get_styles(window.document);
      var serialized = self._serialize_svg(svg.get(0), styles);

      var subject_label = $(this).parents('.row').prev().find('.subject-name').text();
      export_callback.call(self, svg, serialized, subject_label);
    };
  };

  var container = $(container_selector);
  container.on('click', export_svg_selector, handle_click(this._export_svg));
  container.on('click', export_png_selector, handle_click(this._export_png));
}

Exporter.prototype._get_styles = function(doc) {
  // Based on https://github.com/NYTimes/svg-crowbar.
  var styles      = '';

  // Note that doc.styleSheets is only array-like and not an actual array, so
  // can't use forEach with it.
  for(var i = 0; i < doc.styleSheets.length; i++) {
    process_ss(doc.styleSheets[i]);
  }

  function process_ss(ss) {
    // "svg-css" class indicates that this stylesheet's rules *should* be
    // included in the exported SVG.
    if(ss.ownerNode.className.indexOf('svg-css') === -1)
      return;

    // See if we can access ss.cssRules. Note that cssRules respects
    // same-origin policy, as per
    // https://code.google.com/p/chromium/issues/detail?id=49001#c10.
    try {
      // In Chrome, if stylesheet originates from a different domain,
      // ss.cssRules simply won't exist. I believe the same is true for IE, but
      // I haven't tested it.
      //
      // In Firefox, if stylesheet originates from a different domain, trying
      // to access ss.cssRules will throw a SecurityError. Hence, we must use
      // try/catch to detect this condition in Firefox.
      if(!ss.cssRules)
        return;
    } catch(e) {
      // Rethrow exception if it's not a SecurityError. Note that SecurityError
      // exception is specific to Firefox.
      if(e.name !== 'SecurityError')
        throw e;
      return;
    }

    // Stylesheet should be included in SVG and has accessible cssRules, so
    // serialize rules into string.
    for(var i = 0; i < ss.cssRules.length; i++) {
      var rule = ss.cssRules[i];
      if(rule.type === CSSRule.IMPORT_RULE) {
        process_ss(rule.styleSheet);
      } else {
        // Illustrator will crash on descendant selectors. To circumvent this,
        // we should ignore such selectorsl. (See the original svg-crowbar.js
        // for a means of doing this.)
        styles += '\n' + rule.cssText;
      }
    }
  }

  return styles;
}

Exporter.prototype._sanitize_filename = function(str) {
  var san = str.replace(/[^a-zA-Z0-9=_\-]/g, '_');
  // Replace runs of underscores with single one.
  san = san.replace(/_{2,}/g, '_');
  // Remove any leading or trailing underscores.
  san = san.replace(/^_/, '').replace(/_$/, '');
  return san;
}

Exporter.prototype._serialize_svg = function(svg, styles) {
  // Based on https://github.com/NYTimes/svg-crowbar.

  // We do not wish any of our changes to affect the SVG inserted in the
  // document, as the user may choose to export it again. As such, work on a
  // clone instead.
  svg = svg.cloneNode(true);

  d3.select(svg).attr('version', '1.1')
    .insert('defs', ':first-child')
    .append('style')
    .attr('class', 'exported-css')
    .attr('type', 'text/css')
    .node()
    .textContent = styles;

  // I don't understand the below fully from svg-crowbar.js. In short, it's
  // removing existing namespace declarations (both for the default namespace
  // and for XLink), then declaring new ones. I removed calls to check if the
  // namespaced attributes exist before setting them, as I believe they're
  // rendered unnecessary by the calls to removeAttribute(), which
  // svg-crowbar.js also did.
  //
  // Note that mixing namespaced (indicated by the "NS" suffix) and
  // non-namespaced DOM calls should be avoided, at least according to the W3
  // DOM spec. I do it because svg-crowbar.js did it, so it must work. I
  // suppose the non-namespaced version will remove the attributes regardless
  // of whether they are namespaced, or what that namespace is, which must be
  // the desired behaviour.
  svg.removeAttribute('xmlns');
  svg.removeAttribute('xlink');
  svg.setAttributeNS(d3.ns.prefix.xmlns, 'xmlns', d3.ns.prefix.svg);
  svg.setAttributeNS(d3.ns.prefix.xmlns, 'xmlns:xlink', d3.ns.prefix.xlink);

  // Note that only the first instance of "</style>" is replaced, so we can be
  // confident that we are replacing the one we inserted at the start of the
  // document.
  var source = (new XMLSerializer()).serializeToString(svg);
  var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC ' +
                '"-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
  return doctype + source;
}

Exporter.prototype._download_file = function(url, filename) {
  var a = d3.select('body')
            .append('a')
            .style('display', 'none')
            .attr('download', filename)
            .attr('href', url);
  a.node().click();
  return a;
}

Exporter.prototype._export_svg = function(svg, serialized_svg, filename_prefix) {
  var blob = new Blob([serialized_svg], { type: 'text/xml' });
  var url = window.URL.createObjectURL(blob);
  var filename = this._sanitize_filename(filename_prefix) + '.svg';

  var a = this._download_file(url, filename);
  // If URL revoked immediately, download doesn't work.
  setTimeout(function() {
    a.remove();
    window.URL.revokeObjectURL(url);
  }, 100);
}

Exporter.prototype._export_png = function(svg, serialized_svg, filename_prefix) {
  var canvas = document.getElementById('png-exporter');
  svg = $(svg);
  var raster_scale_factor = 5;
  canvas.width  = svg.width()  * raster_scale_factor;
  canvas.height = svg.height() * raster_scale_factor;

  var img = new Image();
  var self = this;
  img.onload = function() {
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    var url = canvas.toDataURL('image/png');
    var filename = self._sanitize_filename(filename_prefix) + '.png';
    var a = self._download_file(url, filename);
    setTimeout(function() {
      a.remove();
    }, 100);
  };

  img.src = 'data:image/svg+xml;base64,' + window.btoa(serialized_svg);
}
