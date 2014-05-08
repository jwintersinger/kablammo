$(document).ready(function() {
  var navbar_elements = $('.navbar .nav li');

  navbar_elements.click(function() {
    var self = $(this);

    if(self.hasClass('disabled-nav'))
      return;

    var target = self.children('a').attr('href').substring(1);
    var panel = $('#control-panel-' + target);
    var all_panels = $('.control-panel');

    if(self.hasClass('active')) {
      panel.slideUp({
        complete: function() {
          self.removeClass('active');
          console.log('pants');
        }
      });
    } else {
      navbar_elements.removeClass('active');
      self.addClass('active');

      all_panels.slideUp();
      $(panel).slideDown();
    }
  });
});
