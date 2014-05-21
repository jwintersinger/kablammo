function AlignmentViewer() {
}

AlignmentViewer.prototype.view_alignment = function(hsp) {
  var viewer = $('#alignment-viewer');
  viewer.find('.query-seq').text(hsp.query_seq);
  viewer.find('.subject-seq').text(hsp.subject_seq);
  viewer.find('.midline-seq').text(hsp.midline_seq);
  viewer.modal('show');
}
