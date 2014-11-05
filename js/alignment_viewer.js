function AlignmentViewer() {
}

AlignmentViewer.prototype._colour_midline = function(midline) {
  return midline.split('').map(function(chr) {
    if(chr === ' ') {
      var cls = 'ml-diff';
    } else if(chr === '+') {
      var cls = 'ml-similar';
    } else {
      var cls = 'ml-match';
    }
    return '<span class="' + cls + '">&nbsp;</span>';
  }).join('');
}

AlignmentViewer.prototype._color_seq = function(seq, seq_type) {
  var letters = seq.split('');
  var prefix = (seq_type === 'nucleic_acid' ? 'na' : 'aa') + '-';
  var coloured = letters.map(function(letter) {
    return '<span class="' + prefix + letter.toLowerCase() + '">' + letter + '</span>';
  });
  return coloured.join('');
}

AlignmentViewer.prototype.view_alignments = function(hsps, query_seq_type, subject_seq_type) {
  var viewer = $('#alignment-viewer');
  var self = this;

  var container = viewer.find('.alignments');
  container.empty();
  Object.keys(hsps).forEach(function(idx) {
    var hsp = hsps[idx];
    var alignment = $('#example-alignment').clone().removeAttr('id');
    alignment.find('.alignment-name').html('Alignment #' + (parseInt(idx, 10) + 1));
    alignment.find('.query-seq').html(  '  Query: ' + self._color_seq(hsp.query_seq, query_seq_type));
    alignment.find('.midline-seq').html('         ' + self._colour_midline(hsp.midline_seq));
    alignment.find('.subject-seq').html('Subject: ' + self._color_seq(hsp.subject_seq, subject_seq_type));
    container.append(alignment);
    viewer.modal('show');
  });
}
