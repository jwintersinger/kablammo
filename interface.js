function Interface(server_results_chooser) {
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
  this._populate_blast_results_chooser(valid_sources, server_results_chooser);
}

Interface.prototype.update_results_info = function(blast_results) {
  // Don't also update "max query seqs" form field's max value, as if user
  // chooses different BLAST result set, she may want to also input a max value
  // higher than the number of sequences in the current data set.
  $('#query-seqs-count').text(blast_results.iterations_count);
  $('#filtered-query-seqs-count').text(blast_results.filtered_iterations_count);
  $('#hits-count').text(blast_results.hits_count);
  $('#filtered-hits-count').text(blast_results.filtered_hits_count);
}

Interface.prototype._populate_blast_results_chooser = function(valid_sources, server_results_chooser) {
  valid_sources.forEach(function(source) {
    server_results_chooser.append($('<option>', {
      value: source,
      text:  source
    }));
  });
}

Interface.prototype.create_header = function(table, label) {
  var tr = d3.select(table).append('tr');
  tr.append('th').text('Subject');
  tr.append('th').text('Hits for query ' + label);
}

Interface.prototype.configure_display_results = function(on_display_results) {
  $('#results-params').submit(on_display_results);

  $('#choose-file').click(function(evt) {
    evt.preventDefault();
    $('#local-file-chooser').click();
  });
}
