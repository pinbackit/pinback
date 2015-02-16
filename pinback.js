(function() {

  var version = '0.1'
    , boards = {}
    , board = {}
    , pins = []
    , pin_count = 0;

  // check if overlay is already open
  if ($('#pboverlay').length > 0) return false;
  
  // make sure user is logged in and on profile page
  if (location.hostname.match(/pinterest.com$/) && $('.usernameLink').length > 0) {
    if ($('.boardLinkWrapper').length > 0) {
      // already on profile page
      start();
    } else {
      // send to profile page
      var profile_link = ($('.thumbUserInfo a, .BoardCount').length > 0) ? $('.thumbUserInfo a, .BoardCount') : $('.usernameLink');
      var selected_board = location.pathname;
      $(document).bind('DOMNodeInserted', function(e) {
        // wait for boards to be loaded
        if ($(e.target).find('.boardLinkWrapper').length > 0) {
          $(document).unbind('DOMNodeInserted');
          start(selected_board);
        }
      });
      profile_link.click();
    }
  } else {
    alert('Log in and visit your profile to start (pinterest.com/username)');
    return false;
  }
  
  // show overlay
  function start(selected_board) {
    // start at top of page
    window.scrollTo(0,0);
    
    $('body').append('\
<div id="pboverlay">\
<style>\
  #pboverlay { display: block; bottom: 0; left: 0; right: 0; top: 0; z-index: 9999; position: fixed; background: rgba(0, 0, 0, 0.8); color: white; text-align: center; }\
  #pboverlay .close { color: white; position: absolute; top:10px; right:20px; font-size: 30px; }\
  #pboverlay .standardForm { top: 50%; margin-top: -100px; position: absolute; width: 100%; max-width: none; }\
  #pboverlay h1 { color: white; }\
  #pboverlay .controls a { display: inline-block; }\
  #pboverlay select, #pboverlay meter { width: 100%; max-width: 300px; !important }\
  #pboverlay .btn { -webkit-box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.34) !important; box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.34) !important; margin-left: 10px;}\
</style>\
<a href="#" class="close">&times;</a>\
<form class="standardForm">\
  <h1>Choose a board to export</h1>\
  <p class="controls">\
    <select></select>\
    <button class="Button btn rounded primary">\
      <span class="buttonText">Export</span>\
    </button>\
  </p>\
  <p><a href="http://www.pinback.it">Pinback v'+version+'</a></p>\
</form>\
</div>');
  
    var select = $('#pboverlay select');
    select.append($("<option>", {
      text: ' - All public pins - ',
      value: '/' + location.pathname.split('/')[1] + '/pins/',
      data: {name: 'all public pins'}
    }));
    
    $('.boardLinkWrapper').each(function() {
      var name = $.trim($(this).find('.boardName').text());
      select.append($("<option>", {
        text: name,
        value: $(this).attr('href'),
        data: {name: name},
        selected: (selected_board == $(this).attr('href'))
      }));
    });
    
    $('#pboverlay button').on('click', function(e) {
      e.preventDefault();
      var name = select.find('option:selected').data('name');
      $('a[href="'+select.val()+'"]').attr('href',select.val()+'?'+Date.now()).click();
      status('Exporting ' + name + '...');
      $('#pboverlay .controls').html('<meter min="0" max="100"></meter>');
    });
      
    $('#pboverlay .close').on('click', function(e) {
      e.preventDefault();
      window.scrollTo(0,0);
      location.href = location.pathname;
    });
    
    // watch for ajax
    $(document).ajaxComplete(function(event, xhr, settings) {
      if (!xhr.responseJSON) return false;
      // regular resources
      if (xhr.responseJSON.resource && xhr.responseJSON.resource_response && xhr.responseJSON.resource_response.data) {
        parse_resource(xhr.responseJSON.resource, xhr.responseJSON.resource_response.data);
      }
      // cached resources
      else if (xhr.responseJSON.resource_data_cache) {
        $.each(xhr.responseJSON.resource_data_cache, function() {
          if (this.resource) parse_resource(this.resource, this.data);
        });
      }
    });
  }
  
  // parse incoming ajax responses
  function parse_resource(r, data) {
    if (r.name == 'UserResource' || r.name == 'BoardResource') {
      board = data;
      pins = [];
    }
    if (r.name == 'UserPinsResource' || r.name == 'BoardFeedResource') {
      $.each(data, function() {
        if (this.id) {
          // add board if not already
          if (!boards[this.board.name]) boards[this.board.name] = {
            id: this.board.id,
            name: this.board.name,
            url: "https://www.pinterest.com"+this.board.url,
            privacy: this.board.privacy,
            pins: []
          }
          // add pin to board
          boards[this.board.name].pins.push({
            id: this.id,
            link: this.link,
            description: $.trim(this.description),
            url: "https://www.pinterest.com/pin/"+this.id,
            image: this.images.orig.url,
            color: this.dominant_color,
            longitude: (this.place && this.place.longitude) || null,
            latitude: (this.place && this.place.latitude) || null,
            pinner: this.pinner.username,
            privacy: this.privacy,
            date: Date.parse(this.created_at)
          });
          pin_count++;
        }
      });
      
      progress(pin_count, board.pin_count);
      
      // scroll page to find more pins
      var next = (typeof(r.options.bookmarks) !== "undefined") ? r.options.bookmarks[0] : null;
      if (pin_count >= board.pin_count || next == '-end-') {
        // found the end
        if (pin_count > 0) done();
      } else {
        // keep going
        setTimeout(function() {
          $("html, body").animate({ scrollTop: document.body.scrollHeight }, 1000);
        }, 1000);
      }
    }
  }
  
  function status(s) {
    $('#pboverlay h1').text(s);
  }
  
  function progress(a, b) {
    status('Exporting ' + a + " of " + b + '...');
    $('#pboverlay meter').val((a/b)*100);
  }
  
  function privacy(p) {
    // borrowed PRIVATE attribute format from Delicious
    return (p != 'public') ? 1 : 0;
  }
  
  function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  
  // generate Netscape bookmark file
  function done() {
    
    status('Export complete!');

    // template header 
    var data = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n\
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n\
<TITLE>Bookmarks</TITLE>\n\
<H1>Bookmarks</H1>\n\
<DL><p>\n';
  
    $.each(boards, function() {
      // board
      data += '<DT><H3 GUID="'+this.id+'" ORIGLINK="'+this.url+'" PRIVATE="'+privacy(this.privacy)+'">'+escapeHtml(this.name)+'</H3>\n<DL><p>\n';
      
      // pins
      $.each(this.pins, function(i, p) {
        data += '<DT><A HREF="'+(p.link||p.url)+'" GUID="'+p.id+'" ORIGLINK="'+p.url+'" IMAGE="'+p.image+'" COLOR="'+p.color+'" AUTHOR="'+p.pinner+'" PRIVATE="'+privacy(p.privacy)+'" ADD_DATE="'+p.date+'" LONGITUDE="'+(p.longitude||'')+'" LATITUDE="'+(p.latitude||'')+'">'+escapeHtml(p.description)+'</A>\n';
      });
      
      // board footer
      data += '</DL><p>\n';
    });
  
    // template footer
    data += '</DL><p>';
    
    // create file
    var filename = location.pathname.replace(/^\/|\/$/g, '').replace(/\//g,'-')+".html";
    var blob = new Blob([data], {type: 'text/html'});
    var url = URL.createObjectURL(blob);
    
    // add save button
    $('#pboverlay .controls').html('<a href="'+url+'" download="'+filename+'" class="Button btn rounded primary"><span class="buttonText">Save export file</span></a>');
    
    // add note for browsers that don't support download attribute
    if (typeof(document.createElement('a').download) === "undefined") {
      $('#pboverlay .controls a').on('click', function() {
        alert('Choose File > Save As in your browser to save a copy of your export');
      });
    }
  }

})();
