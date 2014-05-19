"use strict";

function Interface(grapher, loader) {
  this._grapher = grapher;
  this._loader = loader;
  this._navbar_elements = $('.navbar .nav li');
  this._configure_nav();
  this._configure_colour_picker();
  this._form = $('#load-results-form');
  this._local_chooser = $('#local-file-chooser');
  this._server_results_chooser = $('#server-results-chooser');

  this._is_local_file_chosen = false;
  this._configure_tab_switching();

  var self = this;
  $.getJSON('data/blast_results.json', function(data) {
    self._populate_blast_results_chooser(data.blast_results);
  });

  this._configure_file_chooser();
  this._configure_query_form();
  this._configure_example_results_display();
}

Interface.prototype._configure_tab_switching = function() {
  var self = this;
  $('#control-panel-load [data-toggle="tab"]').on('shown.bs.tab', function(e) {
    var active_tab = $(e.target).attr('id');

    if(active_tab === 'load-server-nav') {
      self._enable_form_submission(true);
    } else {
      // This ensures that if user chooses file, switches to "load server" tab,
      // then switches back to "load local" tab, the button will remain
      // enabled.
      self._enable_form_submission(self._is_local_file_chosen);
    }
  });
}

Interface.prototype._enable_form_submission = function(enable) {
  var submit_control = this._form.find('[type=submit]');
  if(enable) {
    submit_control.removeClass('disabled');
  } else {
    submit_control.addClass('disabled');
  }
}

Interface.prototype._set_local_file_chosen = function(is_file_chosen) {
  this._is_local_file_chosen = is_file_chosen;
  this._enable_form_submission(is_file_chosen);
}

Interface.prototype._configure_colour_picker = function() {
  var choose_colour = $('#choose-graph-colour');
  var default_colour = this._grapher.get_graph_colour();
  var colour_example = $('#graph-colour-example');
  colour_example.css('backgroundColor', '#' + $.colpick.rgbToHex(default_colour));

  var self = this;
  var picker = choose_colour.colpick({
    onChange: function(hsb, hex, rgb, cont) {
      self._grapher.set_graph_colour(rgb);
      colour_example.css('backgroundColor', '#' + hex);
    },
    submit: false,
    color: default_colour,
  });
  colour_example.click(function() {
    choose_colour.click();
  });
}

Interface.prototype._configure_nav = function() {
  var self = this;

  this._navbar_elements.click(function() {
    if($(this).hasClass('disabled-nav'))
      return;

    if($(this).hasClass('active')) {
      self._deactivate_active_panel();
    } else {
      self._activate_panel(this);
    }
  });
}

Interface.prototype._resolve_panel_for_nav = function(nav_elem) {
  var target = nav_elem.children('a').attr('href').substring(1);
  return $('#control-panel-' + target);
}

Interface.prototype._activate_panel = function(nav_target) {
  nav_target = $(nav_target);

  $('.control-panel').slideUp();
  this._navbar_elements.removeClass('active');

  nav_target.addClass('active');
  this._resolve_panel_for_nav(nav_target).slideDown();
}

Interface.prototype._deactivate_active_panel = function() {
  var active_nav = this._navbar_elements.filter('.active');
  // If no navigation active, then no panel should be closed.
  if(active_nav.length === 0)
    return;

  var panel = this._resolve_panel_for_nav(active_nav);
  panel.slideUp({
    complete: function() {
      active_nav.removeClass('active');
    }
  });
}

Interface.prototype.update_results_info = function(blast_results) {
  // Don't also update "max query seqs" form field's max value, as if user
  // chooses different BLAST result set, she may want to also input a max value
  // higher than the number of sequences in the current data set.

  // TODO: reintroduce these in new interface
  /*$('#query-seqs-count').text(blast_results.iterations_count);
  $('#filtered-query-seqs-count').text(blast_results.filtered_iterations_count);
  $('#hits-count').text(blast_results.hits_count);
  $('#filtered-hits-count').text(blast_results.filtered_hits_count);*/
}

Interface.prototype._populate_blast_results_chooser = function(valid_sources) {
  var self = this;
  valid_sources.forEach(function(source) {
    self._server_results_chooser.append($('<option>', {
      value: source,
      text:  source
    }));
  });
}

Interface.prototype.create_query_header = function(container, label, query_index, num_queries) {
  // Don't show label if no valid one present.
  if(label === 'No definition line')
    label = '';
  var header = $('#example-query-header').clone().removeAttr('id');
  header.find('.query-name').text(label);
  header.find('.query-index').text('Query ' + query_index + ' of ' + num_queries);
  $(container).append(header);
}

Interface.prototype._configure_file_chooser = function() {
  var self = this;

  $('#choose-file').click(function(evt) {
    evt.preventDefault();
    self._local_chooser.click();
  })

  self._local_chooser.change(function() {
    var label = $(this).parent().find('.file-label');
    var file = self._local_chooser.get(0).files[0];

    if(file) {
      var label_text = file.name;
      self._set_local_file_chosen(true);
    } else {
      var label_text = '';
      self._set_local_file_chosen(false);
    }

    // Before setting text, remove any elements contained within.
    label.html('').text(label_text);
  });
}

Interface.prototype._on_load_server = function() {
  this._deactivate_active_panel();

  var self = this;
  Interface.show_curtain(function() {
    var server_results_chooser = $('#server-results-chooser');
    var blast_results_filename = server_results_chooser.val();
    self._loader.load_from_server(blast_results_filename, function(results) {
      self._display_results(results);
    });
  });
}

Interface.prototype._on_load_local = function() {
  // This ensures that if user submitted form by pressing enter in control
  // instead of clicking button, further processing will occur only if valid
  // data has been loaded. (The "Display results" button is enabled/disabled
  // separately.)
  if(!this._is_local_file_chosen)
    return;

  var file = this._local_chooser.get(0).files[0];
  // User hasn't selected file.
  if(!file)
    return;

  this._deactivate_active_panel();
  var self = this;
  Interface.show_curtain(function() {
    self._loader.load_local_file(file, function(results) {
      self._display_results(results);
    });
  });
}

Interface.prototype._configure_query_form = function() {
  var self = this;

  this._form.submit(function(evt) {
    evt.preventDefault();

    var active_id = $(this).find('.tab-pane.active').attr('id');

    if(active_id === 'load-server') {
      self._on_load_server();
    } else if(active_id === 'load-local') {
      self._on_load_local();
    } else {
      throw 'Invalid active tab ID: ' + active_id;
    }
  });
}

Interface.prototype._configure_example_results_display = function() {
  var self = this;
  $('#show-example-results').click(function() {
    // Switch to this tab in the (hidden) navigation, so that if user opens "load
    // results," the tab corresponding to the displayed results will be shown.
    $('#load-server-nav').tab('show');
    self._on_load_server();
  });
}

Interface.error = function(msg) {
  // Hide curtain in case it is showing, which would obscure error.
  Interface.hide_curtain();

  var container = $('#errors');
  var error = $('#example-error').clone().removeAttr('id');
  error.find('.message').text(msg);
  container.append(error);
}

Interface.show_curtain = function(on_done) {
  $('#curtain').fadeIn(500, on_done);
}

Interface.hide_curtain = function(on_done) {
  $('#curtain').fadeOut(500, on_done);
}

Interface.prototype._display_results = function(results) {
  this._grapher.display_blast_results(results, '#results-container', this);
  this.update_results_info(results);
  Interface.hide_curtain();
  $('html, body').scrollTop(0);
}
