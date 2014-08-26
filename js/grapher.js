"use strict";

function Grapher(alignment_viewer, use_complement_coords) {
  this._graph_colour = { r: 30, g: 139, b: 195 };
  this._matte_colour = { r: 255, g: 255, b: 255 };
  this._min_opacity  = 0.3;
  this._alignment_viewer = alignment_viewer;
  this._use_complement_coords = use_complement_coords;
}

Grapher.prototype.get_graph_colour = function() {
  return this._graph_colour;
}

Grapher.prototype.set_graph_colour = function(graph_colour) {
  this._graph_colour = graph_colour;
}

Grapher.prototype._show_subject_params = function(svg, hsp) {
  svg = $(svg);
  var position_formatter = d3.format(',d');

  var subject_params = [
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
  var sp_contents = subject_params.map(function(param) {
    var key = param[0];
    var value = param[1];
    return '<li><span class="key">' + key + ':</span> ' + value + '</li>';
  }).join('\n');

  svg.parents('.subject')
     .find('.subject-params')
     .html(sp_contents).show();
}

Grapher.prototype._hide_subject_params = function(svg) {
  $(svg).parents('.subject').find('.subject-params').hide();
}

Grapher.prototype._fade_other_polygons = function(svg, hovered_index, opacity) {
   svg.selectAll('.hit')
      .filter(function(hit, index) {
        return index !== hovered_index;
      })
      .transition()
      .duration(200)
      .style('opacity', opacity);
}

Grapher.prototype._rotate_axis_labels = function(text, text_anchor, dx, dy) {
  text.style('text-anchor', text_anchor)
      .attr('x', dx)
      .attr('y', dy)
      // When axis orientation is "bottom", d3 automataically applies a 0.71em
      // dy offset to labels. As Inkscape does not seem to properly interpret
      // such values, force them to be zero. When calling this function, then,
      // you must compensate by adding 0.71em worth of offset to the dy value
      // you provide.
      .attr('dx', 0)
      .attr('dy', 0)
      .attr('transform', 'rotate(-90)');

}

Grapher.prototype._create_axis = function(svg, scale, orientation, height, text_anchor, dx, dy, seq_type) {
  var scinotation_formatter = d3.format('.2s');
  var formatter = function(val) {
    var suffixes = {
      amino_acid:   'aa',
      nucleic_acid: 'b'
    };
    return scinotation_formatter(val) + suffixes[seq_type];
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

Grapher.prototype._rgba_to_rgb = function(rgba, matte_rgb) {
  // Algorithm taken from http://stackoverflow.com/a/2049362/1691611.
  var normalize = function(colour) {
    return colour.map(function(channel) { return channel / 255; });
  };
  var denormalize = function(colour) {
    return colour.map(function(channel) { return Math.round(Math.min(255, channel * 255)); });
  };

  var norm = normalize(rgba.slice(0, 3));
  matte_rgb = normalize(matte_rgb);
  var alpha = rgba[3] / 255;

  var rgb = [
    (alpha * norm[0]) + (1 - alpha) * matte_rgb[0],
    (alpha * norm[1]) + (1 - alpha) * matte_rgb[1],
    (alpha * norm[2]) + (1 - alpha) * matte_rgb[2],
  ];

  return denormalize(rgb);
}

Grapher.prototype._determine_colour = function(level) {
  var opacity = ((1 - this._min_opacity) * level) + this._min_opacity;
  var rgb = this._rgba_to_rgb([
    this._graph_colour.r,
    this._graph_colour.g,
    this._graph_colour.b,
    255 * opacity
  ], [
     this._matte_colour.r,
     this._matte_colour.g,
     this._matte_colour.b,
  ]);
  return 'rgb(' + rgb.join(',') + ')';
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
       return self._determine_colour(hsp.normalized_bit_score);
     }).attr('points', function(hsp) {
       // We create query_x_points such that the 0th element will *always* be
       // on the left of the 1st element, regardless of whether the axis is
       // drawn normally (i.e., ltr) or reversed (i.e., rtl). We do the same
       // for subject_x_points. As our parsing code guarantees start < end, we
       // decide on this ordering based on the reading frame, because it
       // determines whether our axis will be reversed or not.
       var query_x_points = [scales.query.scale(hsp.query_start), scales.query.scale(hsp.query_end)];
       var subject_x_points = [scales.subject.scale(hsp.subject_start), scales.subject.scale(hsp.subject_end)];

       // Axis will be rendered with 5' end on right and 3' end on left, so we
       // must reverse the order of vertices for the polygon we will render to
       // prevent the polygon from "crossing over" itself.
       if(!self._use_complement_coords) {
         if(hsp.query_frame < 0)
           query_x_points.reverse();
         if(hsp.subject_frame < 0)
           subject_x_points.reverse();
       }

       var points = [
         [query_x_points[0],   scales.query.height   + 2],
         [subject_x_points[0], scales.subject.height - 1],
         [subject_x_points[1], scales.subject.height - 1],
         [query_x_points[1],   scales.query.height   + 2],
       ];

       return points.map(function(point) {
        return point[0] + ',' + point[1];
       }).join(' ');
     }).on('mouseover', function(hovered_hsp, hovered_index) {
       self._show_subject_params(svg[0][0], hovered_hsp);
       self._fade_other_polygons(svg, hovered_index, 0.1);
     }).on('mouseout', function(hovered_hsp, hovered_index) {
       self._hide_subject_params(svg[0][0])
       self._fade_other_polygons(svg, hovered_index, 1);
     }).on('click', function(clicked_hsp) {
       self._alignment_viewer.view_alignment(
         clicked_hsp,
         self._results.query_seq_type,
         self._results.subject_seq_type
       );
     });
}

Grapher.prototype._render_axes = function(svg, scales) {
  var query_axis   = this._create_axis(svg, scales.query.scale,   'top',
                                       scales.query.height,   'start', '9px', '2px',
                                       this._results.query_seq_type);
  var subject_axis = this._create_axis(svg, scales.subject.scale, 'bottom',
                                       scales.subject.height, 'end',   '-11px',  '3px',
                                       this._results.subject_seq_type);

  // Create axis labels.
  svg.append('text')
     .attr('class', 'query axis-label')
     .attr('text-anchor', 'end')
     .attr('x', 0.5*svg.attr('width'))
     .attr('y', '12px')
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

  // If we wish to show the HSPs relative to the original (input or DB)
  // sequence rather than its complement (i.e., use_complement_coords = false),
  // even when the HSPs lie on the complement, then we must display the axis
  // with its 5' end on the right and 3' end on the left. In this case, you can
  // imagine the invisible complementary strand (with its 5' end on left and 3'
  // end on right) floating above the rendered original strand, with the hits
  // actually falling on the complementary strand.
  //
  // If we show the HSPs relative to the complementary strand (i.e.,
  // use_complement_coords = true), then we *always* wish to show the axis with
  // its 5' end on the left and 3' end on the right.
  //
  // Regardless of whether this value is true or falase, the rendered polygons
  // will be precisely the same (meaning down to the pixel -- they will be
  // *identical*). Only the direction of the axis, and the coordinates of
  // points falling along it, change.
  if(!this._use_complement_coords) {
    if(hsps[0].query_frame < 0)
      query_range.reverse();
    if(hsps[0].subject_frame < 0)
      subject_range.reverse();
  }

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
  var self = this;

  function handle_mouse_wheel() {
    var evt = d3.event;
    evt.preventDefault();

    var scale_by = 1.4;
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

Grapher.prototype._create_graph = function(query_length, subject_length, hsps, svg_container) {
  var self = this;

  var padding_x = 20;
  var padding_y = 60;
  var canvas_width = 500;
  var canvas_height = 330;

  var svg = svg_container.insert('svg', ':first-child') // Prepend to svg_container
                         .attr('width', canvas_width)
                         .attr('height', canvas_height);
  var scales = this._create_scales(padding_x, padding_y, canvas_width,
                                   canvas_height, query_length, subject_length, hsps);
  this._render_graph(svg, hsps, scales);

  this._configure_panning(svg, hsps, scales);
  this._configure_zooming(svg, hsps, scales);
}

Grapher.prototype._count_total_hits = function(hits) {
  var num_strand_pairs = hits.map(function(hit) {
    return Object.keys(hit.hsps).length;
  });
  return num_strand_pairs.reduce(function(a, b) {
    return a + b;
  });
}

Grapher.prototype.display_blast_results = function(results, results_container, iface) {
  var self = this;
  this._results = results;

  // TODO: determine whether to keep below line.
  //$('#results-container').show(); // Hidden by default at app start.
  $(results_container).children().remove();

  var iterations = this._results.filtered_iterations;
  iterations.forEach(function(iteration, iteration_idx) {
    var hits = iteration.filtered_hits;
    // Do not display iteration if it has no hits (e.g., because they've all
    // been filtered out via subject filter).
    if(hits.length === 0)
      return;

    iface.create_query_header(
      results_container,
      iteration.query_def,
      iteration_idx + 1,
      iterations.length
    );

    var hit_idx = 1;
    var total_hits = self._count_total_hits(hits);

    hits.forEach(function(hit) {
      Object.keys(hit.hsps).forEach(function(strand_pair) {
        var subj_header = $('#example-subject-header').clone().removeAttr('id');
        subj_header.find('.subject-name').text(hit.subject_def +
          ' (' + hit.subject_id + ')');
        subj_header.find('.subject-index').text('Subject ' + hit_idx++ + ' of ' + total_hits);

        var subj_result = $('#example-subject-result').clone().removeAttr('id');
        var svg_container = d3.select(subj_result.find('.subject').get(0));

        self._create_graph(
          iteration.query_length,
          hit.subject_length,
          hit.hsps[strand_pair],
          svg_container
        );

        $(results_container).append(subj_header).append(subj_result);
      });
    });
  });
}
