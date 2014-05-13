"use strict";

function Interface(grapher) {
  this._grapher = grapher;
  this._navbar_elements = $('.navbar .nav li');
  this._configure_nav();
  this._configure_colour_picker();
  this._form = $('#load-results-form');
  this._server_results_chooser = $('#server-results-chooser');

  this._valid_data_loaded = false;
  this._local_file_chosen = false;
  this._configure_tab_switching();

  var self = this;
  $.getJSON('data/blast_results.json', function(data) {
    self._populate_blast_results_chooser(data.blast_results);
  });
}

Interface.prototype._configure_tab_switching = function() {
  var self = this;
  $('#control-panel-load [data-toggle="tab"]').on('shown.bs.tab', function (e) {
    var active_tab = $(e.target).attr('href').substring(1);
    if(active_tab === 'load-server') {
      self._set_valid_data_loaded(true);
    } else {
      // This ensures that if user chooses file, switches to "load server" tab,
      // then switches back to "load local" tab, the button will remain
      // enabled.
      self._set_valid_data_loaded(self._local_file_chosen);
    }
  });
}

Interface.prototype._set_valid_data_loaded = function(valid) {
  this._valid_data_loaded = valid;
  var submit_control = this._form.find('[type=submit]');

  if(valid) {
    submit_control.removeClass('disabled');
  } else {
    submit_control.addClass('disabled');
  }
}

Interface.prototype._configure_colour_picker = function() {
  var container = $('#choose-graph-colour');
  var default_colour = this._grapher.get_graph_colour();
  var colour_example = $('#graph-colour-example');
  colour_example.css('backgroundColor', '#' + $.colpick.rgbToHex(default_colour));

  var self = this;
  var picker = container.colpick({
    onChange: function(hsb, hex, rgb, cont) {
      self._grapher.set_graph_colour(rgb);
      colour_example.css('backgroundColor', '#' + hex);
    },
    submit: false,
    color: default_colour,
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

Interface.prototype.configure_query_form = function(on_load_from_server, on_load_local_file) {
  var local_chooser = $('#local-file-chooser');
  var self = this;

  $('#choose-file').click(function(evt) {
    evt.preventDefault();
    local_chooser.click();
  })

  local_chooser.change(function() {
    var label = $(this).parent().find('.file-label');
    var file = local_chooser.get(0).files[0];

    var label_text = file ? file.name : '';
    // Before setting text, remove any elements contained within.
    label.html('').text(label_text);

    self._local_file_chosen = true;
    self._set_valid_data_loaded(true);
  });

  this._form.submit(function(evt) {
    evt.preventDefault();

    // This ensures that if user submitted form by pressing enter in control
    // instead of clicking button, further processing will occur only if valid
    // data has been loaded. (The "Display results" button is enabled/disabled
    // separately.)
    if(!self._valid_data_loaded)
      return;

    var active_id = $(this).find('.tab-pane.active').attr('id');

    if(active_id === 'load-server') {
      var server_results_chooser = $('#server-results-chooser');
      var blast_results_filename = server_results_chooser.val();
      self._deactivate_active_panel();
      Interface.show_curtain(function() {
        on_load_from_server(blast_results_filename);
      });
    } else if (active_id === 'load-local') {
      var file = local_chooser.get(0).files[0];
      // User hasn't selected file.
      if(!file)
        return;
      self._deactivate_active_panel();
      Interface.show_curtain(function() {
        on_load_local_file(file);
      });
    } else {
      throw 'Invalid active tab ID: ' + active_id;
    }
  });
}

Interface.prototype.display_results = function() {
  this._form.submit();
}

Interface.error = function(msg) {
  // Hide curtain in case it is showing, which would obscure error.
  Interface.hide_curtain();

  var container = $('#errors');
  var error = $('#example-error').clone().removeAttr('id');
  error.find('.message').text(msg);
  container.append(error);
}

Interface.scroll_to = function(elem) {
  elem = $(elem);
  $('html, body').animate({
    scrollTop: $(elem).offset().top
  }, {
    duration: 700,
    complete: function() { }
  });
}

Interface.show_curtain = function(on_done) {
  $('#curtain').fadeIn(500, on_done);
}

Interface.hide_curtain = function(on_done) {
  $('#curtain').fadeOut(500, on_done);
}
