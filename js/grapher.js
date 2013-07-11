"use strict";

function Grapher() {
}

Grapher.prototype._find_topmost_point = function(point_list) {
  var points = point_list.split(' ').map(function(point) {
    return point.split(',').map(function(coord) {
      return parseFloat(coord);
    });
  });

  var top_x = points[0][0];
  var top_y = points[0][1];
  points.forEach(function(point) {
    var x = point[0];
    var y = point[1];

    if(
      y < top_y ||
      (y === top_y && x < top_x)
    ) {
      top_x = x;
      top_y = y;
    }
  });

  return {
    x: top_x,
    y: top_y
  };
};

Grapher.prototype._show_tooltip = function(svg, polygon, hsp) {
  svg = $(svg);
  polygon = $(polygon);

  var svg_pos = svg.offset();
  var topmost_polygon_point = this._find_topmost_point(polygon.attr('points'));

  var position_formatter = d3.format(',d');

  var tooltip_info = [
    ['Bit score', hsp.bit_score],
    ['E value', hsp.evalue],
    ['Query start', position_formatter(hsp.query_start)],
    ['Query end', position_formatter(hsp.query_end)],
    ['Query frame', hsp.query_frame],
    ['Subject start', position_formatter(hsp.subject_start)],
    ['Subject end', position_formatter(hsp.subject_end)],
    ['Subject frame', hsp.subject_frame],
  ];
  var tooltip_contents = tooltip_info.map(function(info) {
    var key = info[0];
    var value = info[1];
    return '<li><span class="key">' + key + ':</span> ' + value + '</li>';
  }).join('\n');

  var tooltip_container = d3.select('#tooltip');
  var tooltip = tooltip_container.select('.list');

  tooltip.html(tooltip_contents);
  tooltip_container.style('left', svg_pos.left + svg.width() + 'px')
                   .style('top', svg_pos.top + topmost_polygon_point.y + 'px')
                   .transition()
                   .duration(200)
                   .style('opacity', 0.9);
}

Grapher.prototype._hide_tooltip = function() {
  var tooltip = d3.select('#tooltip');
  tooltip.transition()
         .duration(200)
         .style('opacity', 0);
}

Grapher.prototype._fade_other_polygons = function(svg, hovered_index, opacity) {
   svg.selectAll('.hit')
      .filter(function(hit, index) {
        return index !== hovered_index;
      }).transition()
      .duration(200)
      .style('opacity', opacity);
}

Grapher.prototype._rotate_axis_labels = function(text, text_anchor, dx, dy) {
  text.style('text-anchor', text_anchor)
      .attr('dx', dx)
      .attr('dy', dy)
      .attr('transform', 'rotate(-90)');
}

Grapher.prototype._create_axis = function(svg, scale, orientation, height, text_anchor, dx, dy) {
  var scinotation_formatter = d3.format('.2s');
  var formatter = function(val) {
    return scinotation_formatter(val) + 'b';
  }

  var axis = d3.svg.axis()
               .scale(scale)
               .tickFormat(formatter)
               .orient(orientation);

  var container = svg.append('g')
     .attr('class', 'axis')
     .attr('transform', 'translate(0,' + height + ')')
     .call(axis);
  this._rotate_axis_labels(container.selectAll('text'), text_anchor, dx, dy);

  return {
    container: container,
    axis:      axis
  };
}

Grapher.prototype._is_domain_within_orig = function(original_domain, new_domain) {
  return original_domain[0] <= new_domain[0] && original_domain[1] >= new_domain[1];
}

Grapher.prototype._zoom_scale = function(scale, original_domain, zoom_from, scale_by) {
  var l = scale.domain()[0];
  var r = scale.domain()[1];

  l = zoom_from - (zoom_from - l) / scale_by;
  r = zoom_from + (r - zoom_from) / scale_by;

  l = Math.round(l);
  r = Math.round(r);
  // If Math.round(r) - Math.round(l) = 1 from previous zoom event, and for
  // this event, fractional parts of l and r such that l rounds up and r rounds
  // down, we end up with l = r. This is bad, since we're telling d3 to create
  // scale consisting of only a single point, not an interval.
  if(l == r)
    r = l + 1;

  var new_domain = [l, r];
  if(this._is_domain_within_orig(original_domain, new_domain))
    scale.domain(new_domain);
  else
    scale.domain(original_domain);
}

Grapher.prototype._pan_scale = function(existing_scale, original_domain, delta) {
  var scale = (existing_scale.domain()[1] - existing_scale.domain()[0]) / (existing_scale.range()[1] - existing_scale.range()[0]);
  var scaled_delta = -delta * scale;

  var domain = existing_scale.domain();
  var l = domain[0] + scaled_delta;
  var r = domain[1] + scaled_delta;
  var new_domain = [l, r];

  if(this._is_domain_within_orig(original_domain, new_domain))
    existing_scale.domain(new_domain);
}

Grapher.prototype._create_graph = function(svg, hit, query_height, query_scale, subject_height, subject_scale) {
  var self = this;

  // Remove all existing child elements.
  svg.selectAll('*').remove();

  // Add polygons.
  svg.selectAll('polygon')
     .data(hit.hsps)
     .enter()
     .append('polygon')
     .attr('class', 'hit')
     .attr('fill', function(hsp) {
       var val = parseInt(255*(1 - hsp.normalized_bit_score), 10);
       var colour = 'rgba(' + [val, val, val].join(',') + ',1.0)';
       return colour;
     }).attr('points', function(hsp) {
       var points = [
         [query_scale(hsp.query_start),     query_height   + 1],
         [subject_scale(hsp.subject_start), subject_height - 1],
         [subject_scale(hsp.subject_end),   subject_height - 1],
         [query_scale(hsp.query_end),       query_height   + 1],
       ];

       return points.map(function(point) {
        return point[0] + ',' + point[1];
       }).join(' ');
     }).on('mouseover', function(hovered_hsp, hovered_index) {
       self._show_tooltip(svg[0][0], this, hovered_hsp);
       self._fade_other_polygons(svg, hovered_index, 0.1);
     }).on('mouseout', function(hovered_hsp, hovered_index) {
       self._hide_tooltip.apply(this, arguments);
       self._fade_other_polygons(svg, hovered_index, 1);
     });

  var query_axis   = self._create_axis(svg, query_scale,   'top',    query_height,   'start', '0.8em', '1em');
  var subject_axis = self._create_axis(svg, subject_scale, 'bottom', subject_height, 'end',   '-1em',  '-0.4em');
}

Grapher.prototype._display_graph = function(iteration, hit, table_row) {
  var self = this;

  var padding_x = 20;
  var padding_y = 50;
  var canvas_width = 500;
  var canvas_height = 300;

  var svg = table_row.append('td')
                     .append('svg')
                     .attr('width', canvas_width)
                     .attr('height', canvas_height);

  var original_subject_domain = [0, hit.subject_length];

  var query_scale = d3.scale.linear()
                         .domain([0, iteration.query_length])
                         .range([padding_x, canvas_width - padding_x]);
  var subject_scale = d3.scale.linear()
                         .domain(original_subject_domain)
                         .range([padding_x, canvas_width - padding_x]);

  var query_height = padding_y;
  var subject_height = canvas_height - padding_y;
  this._create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);

  var last_x = null;
  svg.on('mousedown',  function() { last_x = d3.event.clientX; });
  svg.on('mouseup',    function() { last_x = null;             });
  svg.on('mouseleave', function() { last_x = null;             });
  svg.on('mousemove',  function() {
    if(last_x === null)
      return;

    var new_x = d3.event.clientX;
    var delta = new_x - last_x;
    last_x = new_x;

    self._pan_scale(subject_scale, original_subject_domain, delta);
    self._create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);
  });

  function handle_mouse_wheel() {
    var evt = d3.event;
    evt.preventDefault();

    var scale_by = 2;
    var direction = (evt.deltaY < 0 || evt.wheelDelta > 0) ? 1 : -1;
    if(direction < 0)
      scale_by = 1/scale_by;

    var mouse_coords = d3.mouse(svg[0][0]);
    // Take x-coordinate of mouse, figure out where that lies on subject
    // axis, then place that point on centre of new zoomed axis.
    var zoom_from = subject_scale.invert(mouse_coords[0]);

    self._zoom_scale(
      subject_scale,
      original_subject_domain,
      zoom_from,
      scale_by,
      hit.subject_length
    );
    self._create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);
  }
  svg.on('mousewheel', handle_mouse_wheel); // Chrome
  svg.on('wheel',      handle_mouse_wheel); // Firefox, IE
}

Grapher.prototype.display_blast_iterations = function(iterations, results_table, iface) {
  var self = this;

  $('#results-container').show(); // Hidden by default at app start.
  $(results_table).find('tr').remove();

  iterations.forEach(function(iteration) {
    var hits = iteration.filtered_hits;
    // Do not display iteration if it has no hits (e.g., because they've all
    // been filtered out via subject filter).
    if(hits.length === 0)
      return;

    iface.create_header(results_table, iteration.query_def);
    hits.forEach(function(hit) {
      var table_row = d3.select(results_table).append('tr');
      var label_cell = table_row.append('td')
      label_cell.html('<strong>ID:</strong> ' + hit.subject_id +
        '<br /><strong>Def:</strong> ' + hit.subject_def);
      self._display_graph(iteration, hit, table_row);
    });
  });
}
