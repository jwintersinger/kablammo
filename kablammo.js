function find_topmost_point(point_list) {
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
}

function show_tooltip(svg, polygon, hsp) {
  svg = $(svg);
  polygon = $(polygon);

  var svg_pos = svg.offset();
  var topmost_polygon_point = find_topmost_point(polygon.attr('points'));

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

function hide_tooltip() {
  var tooltip = d3.select('#tooltip');
  tooltip.transition()
         .duration(200)
         .style('opacity', 0);
}

function fade_other_polygons(svg, hovered_index, opacity) {
   svg.selectAll('.hit')
      .filter(function(hit, index) {
        return index !== hovered_index;
      }).transition()
      .duration(200)
      .style('opacity', opacity);
}

function rotate_axis_labels(text, text_anchor, dx, dy) {
  text.style('text-anchor', text_anchor)
      .attr('dx', dx)
      .attr('dy', dy)
      .attr('transform', 'rotate(-90)');
}

function create_axis(svg, scale, orientation, height, text_anchor, dx, dy) {
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
  rotate_axis_labels(container.selectAll('text'), text_anchor, dx, dy);

  return {
    container: container,
    axis:      axis
  };
}

function create_subject_domain(subject_length, subject_zoom_factor, subject_zoom_from) {
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

function create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale) {
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
       show_tooltip(svg[0][0], this, hovered_hsp);
       fade_other_polygons(svg, hovered_index, 0.1);
     }).on('mouseout', function(hovered_hsp, hovered_index) {
       hide_tooltip.apply(this, arguments);
       fade_other_polygons(svg, hovered_index, 1);
     });

  var query_axis = create_axis(svg, query_scale, 'top', query_height, 'start', '0.8em', '1em');
  var subject_axis = create_axis(svg, subject_scale, 'bottom', subject_height, 'end', '-1em', '-0.4em');
}

function reorder_hit_positions(hsp) {
    if(hsp.query_start > hsp.query_end) {
    var tmp = hsp.query_start;
    hsp.query_start = hsp.query_end;
    hsp.query_end = tmp;
  }
  if(hsp.subject_start > hsp.subject_end) {
    var tmp = hsp.subject_start;
    hsp.subject_start = hsp.subject_end;
    hsp.subject_end = tmp;
  }
}

function find_max_bit_score_for_hit(hit) {
  return d3.max(hit.hsps, function(hsp) {
    return hsp.bit_score;
  });

}
function find_max_bit_score_for_iteration(iteration) {
  return d3.max(iteration.hits, function(hit) {
    return find_max_bit_score_for_hit(hit);
  });
}

function add_normalized_bit_scores(iterations) {
  var max_global_bit_score = d3.max(iterations, function(iteration) {
    return find_max_bit_score_for_iteration(iteration);
  });

  iterations.forEach(function(iteration) {
    iteration.hits.forEach(function(hit) {
      hit.hsps.forEach(function(hsp) {
        hsp.normalized_bit_score = hsp.bit_score / max_global_bit_score;
      });
    });
  });
}

function sort_by_score(iterations) {
  var _rev_compare = function(a, b) {
    if(a < b)
      return 1;
    else if(a > b)
      return -1;
    else
      return 0;
  };

  var _sort_hits = function(iteration) {
    iteration.hits.sort(function(a, b) {
      var max_bs_a = find_max_bit_score_for_hit(a);
      var max_bs_b = find_max_bit_score_for_hit(b);
      return _rev_compare(max_bs_a, max_bs_b);
    });
  };
  // Sort hits within each iteration, so that each iteration's first hit will
  // be the one with the highest-scoring HSP.
  iterations.forEach(_sort_hits);

  // Sort iterations by hit scores (so that first iteration has highest-scoring
  // hit of all iterations). This could be optimized, since prior step ensures
  // that each iteration's hits are alredy sorted, but it doesn't seem to be a
  // bottleneck.
  iterations.sort(function(a, b) {
      var max_bs_a = find_max_bit_score_for_iteration(a);
      var max_bs_b = find_max_bit_score_for_iteration(b);
      return _rev_compare(max_bs_a, max_bs_b);
  });
}

function populate_blast_results_chooser(valid_sources) {
  var chooser = $('#blast-results-chooser');

  valid_sources.forEach(function(source) {
    chooser.append($('<option>', {
      value: source,
      text:  source
    }));
  });
}

function filter_blast_iterations(iterations) {
  var query_filter = $('#query-filter').val().toLowerCase();
  var subject_filter = $('#subject-filter').val().toLowerCase();

  if(query_filter === '') {
    var filtered_iterations = iterations;
  } else {
    var filtered_iterations = iterations.filter(function(iteration) {
      var query_name = iteration.query_def;
      return query_name.toLowerCase().indexOf(query_filter) > -1;
    });
  }

  filtered_iterations.forEach(function(iteration) {
    // Don't overwrite original "hits" attribute, as results are cached on
    // first load. Thus, if user changes filter, we must have access to
    // original "hits" value so that we may filter it appropriately.
    if(subject_filter === '') {
      iteration.filtered_hits = iteration.hits;
    } else {
      iteration.filtered_hits = iteration.hits.filter(function(hit) {
        return hit.subject_def.toLowerCase().indexOf(subject_filter) > -1;
      });
    }
  });

  return filtered_iterations;
}

function slice_blast_iterations(iterations) {
  var max_query_seqs = parseInt($('#max-query-seqs').val(), 10);
  var max_hits_per_query_seq = parseInt($('#max-hits-per-query-seq').val(), 10);

  var sliced_iterations = iterations.slice(0, max_query_seqs);
  sliced_iterations.forEach(function(iteration) {
    iteration.filtered_hits = iteration.filtered_hits.slice(0, max_hits_per_query_seq);
  });

  return sliced_iterations;
}

function parse_blast_results(xml_doc) {
  var doc = $(xml_doc);

  // Within BLAST results, you have:
  //   Multiple iterations (i.e., query sequences input by user), each of which has ...
  //     Multiple hits (i.e., subject sequences pulled out of BLAST DB), each of which has ...
  //       Multiple HSPs (high-scoring pairs), corresponding to subset of query and subject
  //       sequences demonstrating sequence similarity
  var iterations = doc.find('BlastOutput_iterations > Iteration').map(function() {
    var iteration = $(this);
    var hits = iteration.find('Iteration_Hits > Hit');
    if(hits.length === 0)
      return null;

    // In Chrome, the below function call is inordinately slow.
    hits = hits.map(function() {
      var hit = $(this);

      var hit_attribs = {};
      hit_attribs.subject_def = hit.children('Hit_def').text();
      hit_attribs.subject_length = parseInt(hit.children('Hit_len').text(), 10);
      hit_attribs.hsps = hit.children('Hit_hsps').children('Hsp').map(function() {
        var hsp = $(this);
        var hsp_attribs = {
          query_start: parseInt(hsp.find('Hsp_query-from').text(), 10),
          query_end: parseInt(hsp.find('Hsp_query-to').text(), 10),
          subject_start: parseInt(hsp.find('Hsp_hit-from').text(), 10),
          subject_end: parseInt(hsp.find('Hsp_hit-to').text(), 10),
          bit_score: parseFloat(hsp.find('Hsp_bit-score').text()),
          evalue: parseFloat(hsp.find('Hsp_evalue').text())
        };

        reorder_hit_positions(hsp_attribs);
        return hsp_attribs;
      }).get();

      return hit_attribs;
    }).get();

    return {
      query_def: iteration.find('Iteration_query-def').text(),
      query_length: parseInt(iteration.find('Iteration_query-len').text(), 10),
      hits: hits,
    }
  }).get();

  iterations = iterations.filter(function(iteration) {
    return iteration !== null;
  });

  sort_by_score(iterations);
  add_normalized_bit_scores(iterations);

  return {
    iterations: iterations
  };
}

// TODO: refactor into class to obviate global variable.
var _blast_results_cache = {};

function fetch_blast_results(blast_results_name, on_fetched) {
  if(typeof _blast_results_cache[blast_results_name] !== 'undefined') {
    var results = _blast_results_cache[blast_results_name];
    on_fetched(results);
    return;
  }

  var blast_results_filename = blast_results_name;

  $.get(blast_results_filename, function(xml_doc) {
    var blast_results = parse_blast_results(xml_doc);

    _blast_results_cache[blast_results_name] = blast_results;
    on_fetched(blast_results);
  });
}

function create_header(table, label) {
  var tr = d3.select(table).append('tr');
  tr.append('th').text('Subject');
  tr.append('th').text('Hits for query ' + label);
}

function display_blast_iterations(iterations) {
  var padding_x = 20;
  var padding_y = 50;
  var canvas_width = 500;
  var canvas_height = 300;

  var results_table = '#hits';
  $(results_table).find('tr').remove();

  iterations.forEach(function(iteration) {
    var hits = iteration.filtered_hits;
    // Do not display iteration if it has no hits (e.g., because they've all
    // been filtered out via subject filter).
    if(hits.length === 0)
      return;

    create_header(results_table, iteration.query_def);
    hits.forEach(function(hit) {
      var table_row = d3.select(results_table).append('tr');
      table_row.append('td').text(hit.subject_def);
      var svg = table_row.append('td')
                         .append('svg')
                         .attr('width', canvas_width)
                         .attr('height', canvas_height);

      var zoom_factor = 1;
      var subject_domain = create_subject_domain(hit.subject_length, zoom_factor, 0);

      var query_scale = d3.scale.linear()
                             .domain([0, iteration.query_length])
                             .range([padding_x, canvas_width - padding_x]);
      var subject_scale = d3.scale.linear()
                             .domain(subject_domain)
                             .range([padding_x, canvas_width - padding_x]);

      var query_height = padding_y;
      var subject_height = canvas_height - padding_y;
      create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);

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
        subject_scale.domain(create_subject_domain(hit.subject_length, zoom_factor, zoom_from));
        create_graph(svg, hit, query_height, query_scale, subject_height, subject_scale);
      });
    });
  });
}

function retrieve_blast_results(on_done) {
  var blast_results_name = $('#blast-results-chooser').val();

  fetch_blast_results(blast_results_name, function(blast_results) {
    var _calc_num_hits = function(iterations) {
      return d3.sum(iterations, function(iteration) {
        return iteration.hits.length;
      })
    };

    var iterations = blast_results.iterations;
    // Store iterations_count to unify interface for determining count, given
    // that we set filtered_iterations_count below.
    blast_results.iterations_count = iterations.length;
    blast_results.hits_count = _calc_num_hits(iterations);

    // Filter iterations and hits.
    iterations = filter_blast_iterations(iterations);
    // Store filtered_iterations_count, as next step slices the variable
    // iterations, meaning the number of filtered iterations pre-slicing will
    // be lost.
    blast_results.filtered_iterations_count = iterations.length;
    blast_results.filtered_hits_count = _calc_num_hits(iterations);

    // Slice iterations and hits.
    iterations = slice_blast_iterations(iterations);

    blast_results.filtered_iterations = iterations;
    on_done(blast_results);
  });
}

function update_results_info(blast_results) {
  // Don't also update "max query seqs" form field's max value, as if user
  // chooses different BLAST result set, she may want to also input a max value
  // higher than the number of sequences in the current data set.
  $('#query-seqs-count').text(blast_results.iterations_count);
  $('#filtered-query-seqs-count').text(blast_results.filtered_iterations_count);
  $('#hits-count').text(blast_results.hits_count);
  $('#filtered-hits-count').text(blast_results.filtered_hits_count);
}

function update_blast_results() {
  retrieve_blast_results(function(blast_results) {
    display_blast_iterations(blast_results.filtered_iterations);
    update_results_info(blast_results);
  });
}

function configure_parameters_form() {
  $('#results-params').submit(function(evt) {
    evt.preventDefault();
    update_blast_results();
  });
  $('#choose-file').click(function(evt) {
    $('#local-file-chooser').click();
    evt.preventDefault();
  });
}

function main() {
  configure_parameters_form();

  var valid_sources = [
    'toxodb_5.3_rrna_hits.xml',
    'toxodb_8.1_rrna_hits.xml',
    'enriched-rd-geneless.toxodb_8.1.blast.xml',
    'enriched-rd-geneless.uniprot_sprot.blast.xml',
    'enriched-rd-genes.toxodb_8.1.blast.xml',
    'enriched-rd-genes.uniprot_sprot.blast.xml',
    'enriched-rd-windows.toxodb_8.1.blast.xml',
    'enriched-rd-windows.uniprot_sprot.blast.xml',
    'overlapping-but-outside.toxodb_8.1.blast.xml',
    'overlapping-but-outside.uniprot_sprot.blast.xml',
  ];
  populate_blast_results_chooser(valid_sources);
  update_blast_results();
}

main();
