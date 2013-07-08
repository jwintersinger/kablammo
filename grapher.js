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
    ['Subject start', position_formatter(hsp.subject_start)],
    ['Subject end', position_formatter(hsp.subject_end)],
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

Grapher.prototype._create_subject_domain = function(subject_length, subject_zoom_factor, subject_zoom_from) {
  if(subject_zoom_factor === 1)
    return [0, subject_length];

  var visible_length = subject_length / subject_zoom_factor;
  var start = subject_zoom_from - visible_length/2;
  var end = subject_zoom_from + visible_length/2;

  if(start < 0) {
    start = 0;
    end = visible_length;
  } else if(end > subject_length) {
    end = subject_length;
    start = subject_length - visible_length;
  }

  start = Math.round(start);
  end = Math.round(end);
  return [start, end];
}

Grapher.prototype._create_graph = function(svg, hit, query_height, query_scale, subject_height, subject_scale) {
  // Remove all existing child elements.
  svg.selectAll('*').remove();

  // Add polygons.
  var self = this;
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
  var padding_x = 20;
  var padding_y = 50;
  var canvas_width = 500;
  var canvas_height = 300;

  var svg = table_row.append('td')
                     .append('svg')
                     .attr('width', canvas_width)
                     .attr('height', canvas_height);

  var zoom_factor = 1;
  var subject_domain = this._create_subject_domain(hit.subject_length, zoom_factor, 0);

  var query_scale = d3.scale.linear()
                         .domain([0, iteration.query_length])
                         .range([padding_x, canvas_width - padding_x]);
  var subject_scale = d3.scale.linear()
                         .domain(subject_domain)
                         .range([padding_x, canvas_width - padding_x]);

  var query_height = padding_y;
  var subject_height = canvas_height - padding_y;
  this._create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);

  var self = this;
  svg.on('mousewheel', function() {
    var evt = d3.event;
    evt.preventDefault();

    var delta = evt.wheelDelta;
    var scale_by = 2;

    if(delta > 0)
      zoom_factor *= scale_by;
    else if(delta < 0)
      zoom_factor /= scale_by;

    if(zoom_factor < 1)
      zoom_factor = 1;
    if(zoom_factor > hit.subject_length)
      zoom_factor = hit.subject_length;

    var mouse_coords = d3.mouse(svg[0][0]);
    // Take x-coordinate of mouse, figure out where that lies on subject
    // axis, then place that point on centre of new zoomed axis.
    var zoom_from = subject_scale.invert(mouse_coords[0]);
    subject_scale.domain(self._create_subject_domain(hit.subject_length, zoom_factor, zoom_from));
    self._create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);
  });
}

Grapher.prototype.display_blast_iterations = function(iterations, results_table, iface) {
  $(results_table).find('tr').remove();

  var self = this;
  iterations.forEach(function(iteration) {
    var hits = iteration.filtered_hits;
    // Do not display iteration if it has no hits (e.g., because they've all
    // been filtered out via subject filter).
    if(hits.length === 0)
      return;

    iface.create_header(results_table, iteration.query_def);
    hits.forEach(function(hit) {
      var table_row = d3.select(results_table).append('tr');
      table_row.append('td').text(hit.subject_def);
      self._display_graph(iteration, hit, table_row);
    });
  });
}
