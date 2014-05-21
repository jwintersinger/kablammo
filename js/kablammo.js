"use strict";

function Kablammo() {
  var self = this;

  this._aln_viewer    = new AlignmentViewer();
  this._grapher       = new Grapher(this._aln_viewer);
  this._parser        = new BlastParser();
  this._loader        = new BlastResultsLoader(this._parser);
  this._iface         = new Interface(this._grapher, this._loader);
  this._exporter      = new Exporter('#results-container', '.export-to-svg', '.export-to-png');
}

function main() {
  new Kablammo();
}

main();
