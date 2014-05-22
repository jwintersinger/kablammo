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

AlignmentViewer.prototype.view_alignment = function(hsp, query_seq_type, subject_seq_type) {
  var viewer = $('#alignment-viewer');
  viewer.find('.query-seq').html(  '  Query: ' + this._color_seq(hsp.query_seq, query_seq_type));
  viewer.find('.midline-seq').html('         ' + this._colour_midline(hsp.midline_seq));
  viewer.find('.subject-seq').html('Subject: ' + this._color_seq(hsp.subject_seq, subject_seq_type));
  viewer.modal('show');
}
