function BlastResultsLoader() {
  this._parser = new BlastParser();
}

// TODO: refactor into class to obviate global variable.
var _blast_results_cache = {};
BlastResultsLoader.prototype._fetch_blast_results = function(blast_results_name, on_fetched) {
  if(typeof _blast_results_cache[blast_results_name] !== 'undefined') {
    var results = _blast_results_cache[blast_results_name];
    on_fetched(results);
    return;
  }

  var blast_results_filename = blast_results_name;

  var self = this;
  $.get(blast_results_filename, function(xml_doc) {
    var blast_results = self._parser._parse_blast_results(xml_doc);
    _blast_results_cache[blast_results_name] = blast_results;
    on_fetched(blast_results);
  });
}


BlastResultsLoader.prototype.load_from_local = function() { }

BlastResultsLoader.prototype.load_from_server = function(on_done) {
  var self = this;
  var blast_results_name = $('#blast-results-chooser').val();
  this._fetch_blast_results(blast_results_name, function(blast_results) {
    // Don't slice_and_dice in _fetch_blast_results, as we don't want to cache
    // the sliced-and-diced version.
    self._parser._slice_and_dice(blast_results);
    on_done(blast_results);
  });
}
