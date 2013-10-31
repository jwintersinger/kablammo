"use strict";

function BlastParser() {
}

BlastParser.prototype._reorder_hit_positions = function(hsp) {
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

BlastParser.prototype._find_max_bit_score_for_hit =  function(hit) {
  return d3.max(hit.hsps, function(hsp) {
    return hsp.bit_score;
  });
}

BlastParser.prototype._find_max_bit_score_for_iteration = function(iteration) {
  var self = this;
  return d3.max(iteration.hits, function(hit) {
    return self._find_max_bit_score_for_hit(hit);
  });
}

BlastParser.prototype._add_normalized_bit_scores = function(iterations) {
  var self = this;
  var max_global_bit_score = d3.max(iterations, function(iteration) {
    return self._find_max_bit_score_for_iteration(iteration);
  });

  iterations.forEach(function(iteration) {
    iteration.hits.forEach(function(hit) {
      hit.hsps.forEach(function(hsp) {
        hsp.normalized_bit_score = hsp.bit_score / max_global_bit_score;
      });
    });
  });
}

BlastParser.prototype._sort_by_score = function(iterations) {
  var self = this;
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
      var max_bs_a = self._find_max_bit_score_for_hit(a);
      var max_bs_b = self._find_max_bit_score_for_hit(b);
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
      var max_bs_a = self._find_max_bit_score_for_iteration(a);
      var max_bs_b = self._find_max_bit_score_for_iteration(b);
      return _rev_compare(max_bs_a, max_bs_b);
  });
}

BlastParser.prototype._filter_blast_iterations = function(iterations) {
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

BlastParser.prototype._slice_blast_iterations = function(iterations) {
  var max_query_seqs = parseInt($('#max-query-seqs').val(), 10);
  var max_hits_per_query_seq = parseInt($('#max-hits-per-query-seq').val(), 10);

  var sliced_iterations = iterations.slice(0, max_query_seqs);
  sliced_iterations.forEach(function(iteration) {
    iteration.filtered_hits = iteration.filtered_hits.slice(0, max_hits_per_query_seq);
  });

  return sliced_iterations;
}

BlastParser.prototype.parse_blast_results = function(xml_doc) {
  var self = this;
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
      hit_attribs.subject_id = hit.children('Hit_id').text();
      hit_attribs.subject_def = hit.children('Hit_def').text();
      hit_attribs.subject_length = parseInt(hit.children('Hit_len').text(), 10);
      hit_attribs.hsps = hit.children('Hit_hsps').children('Hsp').map(function() {
        var hsp = $(this);
        var hsp_attribs = {
          query_start: parseInt(hsp.find('Hsp_query-from').text(), 10),
          query_end: parseInt(hsp.find('Hsp_query-to').text(), 10),
          query_frame: parseInt(hsp.find('Hsp_query-frame').text(), 10),
          subject_start: parseInt(hsp.find('Hsp_hit-from').text(), 10),
          subject_end: parseInt(hsp.find('Hsp_hit-to').text(), 10),
          subject_frame: parseInt(hsp.find('Hsp_hit-frame').text(), 10),
          alignment_length: parseInt(hsp.find('Hsp_align-len').text(), 10),
          bit_score: parseFloat(hsp.find('Hsp_bit-score').text()),
          evalue: parseFloat(hsp.find('Hsp_evalue').text())
        };

        self._reorder_hit_positions(hsp_attribs);
        return hsp_attribs;
      }).get();

      return hit_attribs;
    }).get();

    return {
      query_id: iteration.find('Iteration_query-ID').text(),
      query_def: iteration.find('Iteration_query-def').text(),
      query_length: parseInt(iteration.find('Iteration_query-len').text(), 10),
      hits: hits,
    }
  }).get();

  iterations = iterations.filter(function(iteration) {
    return iteration !== null;
  });

  this._sort_by_score(iterations);
  this._add_normalized_bit_scores(iterations);

  return {
    iterations: iterations
  };
}

BlastParser.prototype.slice_and_dice = function(blast_results) {
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
  iterations = this._filter_blast_iterations(iterations);
  // Store filtered_iterations_count, as next step slices the variable
  // iterations, meaning the number of filtered iterations pre-slicing will
  // be lost.
  blast_results.filtered_iterations_count = iterations.length;
  blast_results.filtered_hits_count = _calc_num_hits(iterations);

  // Slice iterations and hits.
  iterations = this._slice_blast_iterations(iterations);

  blast_results.filtered_iterations = iterations;
}
