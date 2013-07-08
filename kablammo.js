function update_blast_results(loader, grapher, iface) {
  loader.load_from_server(function(blast_results) {
    var results_table = '#hits';
    grapher.display_blast_iterations(blast_results.filtered_iterations, '#hits', iface);
    iface.update_results_info(blast_results);
  });
}

function main() {
  var iface = new Interface();
  var grapher = new Grapher();
  var loader = new BlastResultsLoader();

  iface.configure_display_results(function(evt) {
    evt.preventDefault();
    update_blast_results(loader, grapher, iface);
  });
  update_blast_results(loader, grapher, iface);
}

main();
