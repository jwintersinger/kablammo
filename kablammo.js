"use strict";

function update_blast_results(server_results_chooser, loader, grapher, iface) {
  loader.load_from_server(server_results_chooser.val(), function(blast_results) {
    grapher.display_blast_iterations(blast_results.filtered_iterations, '#hits', iface);
    iface.update_results_info(blast_results);
  });
}

function main() {
  var server_results_chooser = $('#server-results-chooser');

  var iface = new Interface(server_results_chooser);
  var grapher = new Grapher();
  var loader = new BlastResultsLoader();

  iface.configure_display_results(function(evt) {
    evt.preventDefault();
    update_blast_results(server_results_chooser, loader, grapher, iface);
  });
  update_blast_results(server_results_chooser, loader, grapher, iface);
}

main();
