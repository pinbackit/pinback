(function(){

  var version = '0.3.1'
    , boards = {}
    , board = {}
    , selected_board
    , pins = []
    , pin_count = 0
    , delay = 1000
    , timer;

  // make sure user is logged in and on profile page
  if (location.hostname.match(/pinterest.[a-z.]{2,5}$/i) && document.querySelector('.profileBoardsFeed')) {
    // already on profile page
    start();
  } else {
    alert('Log in and visit your profile to start (pinterest.com/username)');
    return false;
  }

  // show overlay
  function start() {

    // check if overlay is already open
    if (document.querySelector('#pboverlay')) return false;

    // start at top of page
    window.scrollTo(0,0);

    // create overlay
    var overlay = document.createElement('div');
    overlay.id = 'pboverlay';
    overlay.innerHTML = '\
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
</form>';

    // add overlay to document
    document.querySelector('body').appendChild(overlay);

    // find boards
    var select = document.querySelector('#pboverlay select');
    var option = document.createElement('option');
    option.text = ' - All public pins - ';
    option.value = '/' + location.pathname.split('/')[1] + '/pins/';
    option.dataset.name = 'all public pins';
    select.add(option);

    Array.prototype.forEach.call(document.querySelectorAll('.cardWrapper a'), function(el, i) {
      var name = el.innerText.trim().split('\n')[0]; // first line of text
      var option = document.createElement('option');
      option.text = name;
      option.value = el.getAttribute('href');
      option.dataset.name = name;
      option.selected = (selected_board == el.href);
      select.add(option);
    });

    document.querySelector('#pboverlay button').onclick = function() {
      var selected = select.querySelector('option:checked');
      var name = selected.dataset.name;

      if (select.selectedIndex == 0) {
        document.querySelectorAll('.tabItem')[1].click()
      } else {
        var link = document.querySelector('a[href="'+selected.value+'"]');
        link.href = selected.value+'?'+Date.now();
        link.click();
      }

      status('Exporting ' + name + '...');
      document.querySelector('#pboverlay .controls').innerHTML = '<meter min="0" max="100"></meter>';

      return false;
    };

    document.querySelector('#pboverlay .close').onclick = function() {
      window.scrollTo(0,0);
      location.href = location.pathname;
      return false;
    };

    // watch for ajax
    XMLHttpRequest.prototype.open = (function(orig){
      return function(){
        // always retrieve first page
        if (pin_count == 0) arguments[1] = arguments[1].replace('-end-','')
        return orig.apply(this, arguments);
      };
    })(XMLHttpRequest.prototype.open);

    XMLHttpRequest.prototype.send = (function(orig){
      return function(){

        this.addEventListener('loadend', function(e){
          if (e.target.getResponseHeader('content-type').match(/json/)) {
            var json = JSON.parse(e.target.response);
            // regular resources
            if (json.resource && json.resource_response && json.resource_response.data) {
              parse_resource(json.resource, json.resource_response.data);
            }
            // cached resources
            else if (json.resource_data_cache) {
              json.resource_data_cache.forEach(function(el, i) {
                if (el.resource) parse_resource(el.resource, el.data);
              });
            }
          }
        }, false);

        return orig.apply(this, arguments);
      };
    })(XMLHttpRequest.prototype.send);
  }

  // parse incoming ajax responses
  function parse_resource(r, data) {
    if (pin_count >= board.pin_count) return;

    if (r.name == 'UserResource' || r.name == 'BoardResource') {
      board = data;
      pins = [];
    }
    if (r.name == 'UserPinsResource' || r.name == 'BoardFeedResource') {
      data.forEach(function(p, i) {
        if (p.type == 'pin') {
          // add board if not already
          if (!boards[p.board.name]) boards[p.board.name] = {
            id:           p.board.id,
            name:         p.board.name,
            url:          "https://www.pinterest.com"+p.board.url,
            privacy:      p.board.privacy,
            pins:         []
          }
          // add pin to board
          boards[p.board.name].pins.push({
            id:           p.id,
            link:         p.link,
            description:  p.description,
            url:          "https://www.pinterest.com/pin/"+p.id,
            image:        p.images.orig.url,
            color:        p.dominant_color,
            longitude:    (p.place && p.place.longitude) || null,
            latitude:     (p.place && p.place.latitude) || null,
            pinner:       p.pinner.username,
            privacy:      p.privacy,
            date:         Date.parse(p.created_at)
          });
          pin_count++;
        }
      });

      progress(pin_count, board.pin_count);

      // scroll page to find more pins
      var next = (typeof(r.options.bookmarks) !== "undefined") ? r.options.bookmarks[0] : null;
      if (timer) clearTimeout(timer);
      if (pin_count >= board.pin_count || next == '-end-') {
        // found the end
        if (pin_count > 0) done();
      } else {
        // keep going
        timer = setTimeout(function() {
          window.scrollTo(0, document.body.scrollHeight);
        }, delay);
      }
    }
  }

  function status(s) {
    document.querySelector('#pboverlay h1').innerText = s;
  }

  function progress(a, b) {
    if (b) {
      status('Exporting ' + a + " of " + b + '...');
      document.querySelector('#pboverlay meter').value = (a/b)*100;
    } else {
      status('Exporting ' + a + '...');
      document.querySelector('#pboverlay meter').value = a*100;
    }
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

    for (var name in boards) {
      var b = boards[name];
      // board
      data += '<DT><H3 GUID="'+b.id+'" ORIGLINK="'+b.url+'" PRIVATE="'+privacy(b.privacy)+'">'+escapeHtml(b.name)+'</H3>\n<DL><p>\n';

      // pins
      b.pins.forEach(function(p, i) {
        data += '<DT><A HREF="'+(p.link||p.url)+'" GUID="'+p.id+'" ORIGLINK="'+p.url+'" IMAGE="'+p.image+'" COLOR="'+p.color+'" AUTHOR="'+p.pinner+'" PRIVATE="'+privacy(p.privacy)+'">'+escapeHtml(p.description)+'</A>\n';
      });

      // board footer
      data += '</DL><p>\n';
    }

    // template footer
    data += '</DL><p>';

    // create file
    var filename = location.pathname.replace(/^\/|\/$/g, '').replace(/\//g,'-')+".html";
    var blob = new Blob([data], {type: 'text/html'});
    var url = URL.createObjectURL(blob);

    // add save button
    document.querySelector('#pboverlay .controls').innerHTML = '<a href="'+url+'" download="'+filename+'" class="Button btn rounded primary"><span class="buttonText">Save export file</span></a>';

    // add note for browsers that don't support download attribute
    if (typeof(document.createElement('a').download) === "undefined") {
      document.querySelector('#pboverlay .controls a').onclick = function() {
        alert('Choose File > Save As in your browser to save a copy of your export');
      }
    }
  }

})();
