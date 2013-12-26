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
    ['Alignment length', position_formatter(hsp.alignment_length)],
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

Grapher.prototype._render_polygons = function(svg, hsps, scales) {
  var self = this;

  // Remove all existing child elements.
  svg.selectAll('*').remove();

  // Add polygons.
  svg.selectAll('polygon')
     .data(hsps)
     .enter()
     .append('polygon')
     .attr('class', 'hit')
     .attr('fill', function(hsp) {
       var val = parseInt(255*(1 - hsp.normalized_bit_score), 10);
       var colour = 'rgba(' + [val, val, val].join(',') + ',1.0)';
       return colour;
     }).attr('points', function(hsp) {
       // We create query_x_points such that the 0th element will *always* be
       // on the left of the 1st element, regardless of whether the axis is
       // drawn normally (i.e., ltr) or reversed (i.e., rtl). We do the same
       // for subject_x_points. As our parsing code guarantees start < end, we
       // decide on this ordering based on the reading frame, because it
       // determines whether our axis will be reversed or not.
       var query_x_points = [scales.query.scale(hsp.query_start), scales.query.scale(hsp.query_end)];
       if(hsp.query_frame < 0)
         query_x_points.reverse();
       var subject_x_points = [scales.subject.scale(hsp.subject_start), scales.subject.scale(hsp.subject_end)];
       if(hsp.subject_frame < 0)
         subject_x_points.reverse();

       var points = [
         [query_x_points[0],   scales.query.height   + 1],
         [subject_x_points[0], scales.subject.height - 1],
         [subject_x_points[1], scales.subject.height - 1],
         [query_x_points[1],   scales.query.height   + 1],
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
}

Grapher.prototype._render_axes = function(svg, scales) {
  var query_axis   = this._create_axis(svg, scales.query.scale,   'top',
                                       scales.query.height,   'start', '0.8em', '1em');
  var subject_axis = this._create_axis(svg, scales.subject.scale, 'bottom',
                                       scales.subject.height, 'end',   '-1em',  '-0.4em');

  // Create axis labels.
  svg.append('text')
     .attr('class', 'query axis-label')
     .attr('text-anchor', 'end')
     .attr('x', 0.5*svg.attr('width'))
     .attr('y', '1.1em')
     .text('Query');
  svg.append('text')
     .attr('class', 'subject axis-label')
     .attr('text-anchor', 'end')
     .attr('x', 0.5*svg.attr('width'))
     .attr('y', svg.attr('height') - 5)
     .text('Subject');
}

Grapher.prototype._render_graph = function(svg, hsps, scales) {
  this._render_polygons(svg, hsps, scales);
  this._render_axes(svg, scales);
}

Grapher.prototype._find_nearest_scale = function(point, scales) {
  var nearest = null;
  var smallest_distance = Number.MAX_VALUE;

  Object.keys(scales).forEach(function(scale_name) {
    var scale        = scales[scale_name].scale;
    var scale_height = scales[scale_name].height;

    var delta = Math.abs(scale_height - point[1]);
    if(delta < smallest_distance) {
      nearest = scale;
      smallest_distance = delta;
    }
  });

  return nearest;
}

Grapher.prototype._create_scales = function(padding_x, padding_y, canvas_width, canvas_height, query_length, subject_length, hsps) {
  var query_range   = [padding_x, canvas_width - padding_x];
  var subject_range = [padding_x, canvas_width - padding_x];

  if(hsps[0].query_frame < 0)
    query_range.reverse();
  if(hsps[0].subject_frame < 0)
    subject_range.reverse();

  var query_scale = d3.scale.linear()
                         .domain([0, query_length])
                         .range(query_range);
  var subject_scale = d3.scale.linear()
                         .domain([0, subject_length])
                         .range(subject_range);
  query_scale.original_domain = query_scale.domain();
  subject_scale.original_domain = subject_scale.domain();

  var query_height = padding_y;
  var subject_height = canvas_height - padding_y;

  var scales = {
    subject: { height: subject_height, scale: subject_scale },
    query:   { height: query_height,   scale: query_scale   },
  };
  return scales;
}

Grapher.prototype._configure_panning = function(svg, hsps, scales) {
  var self = this;
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

    var mouse_coords = d3.mouse(svg[0][0]);
    var target_scale = self._find_nearest_scale(mouse_coords, scales);

    self._pan_scale(target_scale, target_scale.original_domain, delta);
    self._render_graph(svg, hsps, scales);
  });
}

Grapher.prototype._configure_zooming = function(svg, hsps, scales) {
  function handle_mouse_wheel() {
    var evt = d3.event;
    evt.preventDefault();

    var scale_by = 2;
    var direction = (evt.deltaY < 0 || evt.wheelDelta > 0) ? 1 : -1;
    if(direction < 0)
      scale_by = 1/scale_by;

    var mouse_coords = d3.mouse(svg[0][0]);
    var target_scale = self._find_nearest_scale(mouse_coords, scales);
    // Take x-coordinate of mouse, figure out where that lies on subject
    // axis, then place that point on centre of new zoomed axis.
    var zoom_from = target_scale.invert(mouse_coords[0]);

    self._zoom_scale(
      target_scale,
      target_scale.original_domain,
      zoom_from,
      scale_by
    );
    self._render_graph(svg, hsps, scales);
  }
  svg.on('mousewheel', handle_mouse_wheel); // Chrome
  svg.on('wheel',      handle_mouse_wheel); // Firefox, IE
}

Grapher.prototype._create_graph = function(query_length, subject_length, hsps, table_row) {
  var self = this;

  var padding_x = 20;
  var padding_y = 60;
  var canvas_width = 500;
  var canvas_height = 330;

  var svg = table_row.append('td')
                     .append('svg')
                     .attr('width', canvas_width)
                     .attr('height', canvas_height);
  var scales = this._create_scales(padding_x, padding_y, canvas_width,
                                   canvas_height, query_length, subject_length, hsps);
  this._render_graph(svg, hsps, scales);

  this._configure_panning(svg, hsps, scales);
  this._configure_zooming(svg, hsps, scales);
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
      Object.keys(hit.hsps).forEach(function(strand_pair) {
        var table_row = d3.select(results_table).append('tr');
        var label_cell = table_row.append('td')
        label_cell.html('<strong>ID:</strong> ' + hit.subject_id +
          '<br /><strong>Def:</strong> ' + hit.subject_def);

        self._create_graph(
          iteration.query_length,
          hit.subject_length,
          hit.hsps[strand_pair],
          table_row
        );
      });
    });
  });
}
