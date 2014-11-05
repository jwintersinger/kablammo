function AlignmentExporter() {
}

AlignmentExporter.prototype.export_alignments = function(hsps) {
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
