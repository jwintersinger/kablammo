function AlignmentViewer() {
  this._configure_index_tooltips();
}

AlignmentViewer.prototype._configure_index_tooltips = function() {

  var _determine_type = function(trigger) {
    if($(trigger).parents('.query-seq').length > 0) {
      return 'query';
    } else {
      return 'subject';
    }
  };

  var formatter = d3.format(',d');

  $('body').tooltip({
    selector: '.query-seq span:not(.gap), .subject-seq span:not(.gap)',
    container: '#alignment-viewer',
    trigger: 'hover focus click',
    title: function() {
      var trigger = $(this);
      var hsp = trigger.parents('.alignment').data().hsp;
      var type = _determine_type(trigger);
      var frame = hsp[type + '_frame'];

      var idx = parseInt(trigger.attr('data-idx'), 10);
      if(frame >= 0) {
        var position = hsp[type + '_start'] + (idx - 1);
      } else {
        var position = hsp[type + '_end'] - (idx - 1);
      }

      return 'Position ' + formatter(position);
    },
    placement: function(tooltip, trigger) {
      if(_determine_type(trigger) === 'query') {
        // Is query seq
        return 'top';
      } else {
        // Is subject seq
        return 'bottom';
      }
    }
  });
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

  var position = 0;
  var coloured = letters.map(function(letter) {
    var html = '<span';
    if(letter !== '-') {
      position++;
      html += ' data-idx="' + position + '"';
      html += ' class="' + prefix + letter.toLowerCase() + '"';
    } else {
      html += ' class="gap"';
    }
    html += '">' + letter + '</span>';
    return html;
  });
  return coloured.join('');
}

AlignmentViewer.prototype.view_alignments = function(hsps, query_seq_type, query_def, query_id, subject_seq_type, subject_def, subject_id) {
  var viewer = $('#alignment-viewer');

  viewer.find('.subject-title').text(subject_def + ' (' + subject_id + ')');
  viewer.find('.query-title').text(query_def + ' (' + query_id + ')');

  var container = viewer.find('.alignments');
  container.empty();
  var self = this;

  Object.keys(hsps).forEach(function(idx) {
    var hsp = hsps[idx];
    var alignment = $('#example-alignment').clone().removeAttr('id');
    alignment.data('hsp', hsp);
    alignment.find('.alignment-name').html('Alignment #' + (parseInt(idx, 10) + 1));
    alignment.find('.query-seq').html(  '  Query: ' + self._color_seq(hsp.query_seq, query_seq_type));
    alignment.find('.midline-seq').html('         ' + self._colour_midline(hsp.midline_seq));
    alignment.find('.subject-seq').html('Subject: ' + self._color_seq(hsp.subject_seq, subject_seq_type));
    container.append(alignment);
    viewer.modal('show');
  });
}
