(function(){

  var version = '0.4.0'
    , boards = {}
    , board = {}
    , pins = []
    , pin_count = 0
    , username;

  // make sure user is on a profile page
  if (match = location.href.match(/^https:\/\/www\.pinterest\..*?\/([a-z0-9_]{1,30})/i)) {
    username = match[1];
    getResource('Boards', {username: username, field_set_key: 'detailed'}, start);
  } else {
    alert('Log in and visit your profile (pinterest.com/username) or board to start');
    return false;
  }

  // show overlay
  function start(json) {

    // check if overlay is already open
    if (document.querySelector('#pboverlay')) return false;

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
  <p><a href="http://pinback.github.io">Pinback v'+version+'</a></p>\
</form>';

    // add overlay to document
    document.querySelector('body').appendChild(overlay);
    var select = document.querySelector('#pboverlay select');
    var option = document.createElement('option');
    option.text = ' - All public pins - ';
    option.value = 'all';
    select.add(option);

    // add dropdown options for each board
    Array.prototype.forEach.call(json.resource_response.data, function(b, i) {
      var option = document.createElement('option');
      option.text = b.name;
      option.value = b.id;
      option.selected = (location.pathname == b.url);
      select.add(option);
    });

    // set export button
    document.querySelector('#pboverlay button').onclick = function() {
      document.querySelector('#pboverlay .controls').innerHTML = '<meter min="0" max="100"></meter>';
      status('Exporting...');
      var selected = select.querySelector('option:checked');
      if (selected.value == 'all') {
        status('Exporting all pins...');
        getResource('User', {username: username}, parseBoard);
      } else {
        status('Exporting ' + selected.text + '...');
        getResource('Board', {board_id: selected.value}, parseBoard);
      }
      return false;
    };

    // set up close button
    document.querySelector('#pboverlay .close').onclick = function() {
      location.href = location.pathname;
      return false;
    };
  }
  
  // parse selected board 
  function parseBoard(json) {
    board = json.resource_response.data;
    getFeed();
  }
  
  // fetch pins
  function getFeed(bookmarks) {
    if (board.type == 'user') {
      getResource('UserPins', {username: username, page_size: 25, bookmarks: bookmarks}, parseFeed);
    } else {
      getResource('BoardFeed', {board_id: board.id, page_size: 25, bookmarks: bookmarks}, parseFeed);
    }
  }
  
  // parse incoming pins from selected board
  function parseFeed(json) {
    json.resource_response.data.forEach(function(p, i) {
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
        progress(pin_count++, board.pin_count);
      }
    })
    
    var bookmarks = json.resource.options.bookmarks;
    if (bookmarks[0] == '-end-') {
      done();
    } else {
      getFeed(bookmarks);
    }
  }

  // handle api calls
  function getResource(resource, options, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
    	if (xhr.status >= 200 && xhr.status < 300) {
        callback(JSON.parse(xhr.responseText));
    	} else {
    		alert('An error has occurred.')
    		console.log(JSON.parse(xhr.responseText));
    	}
    };
    xhr.open('GET', '/resource/'+resource+'Resource/get/?data='+encodeURIComponent(JSON.stringify({options: options})));
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*, q=0.01');
    xhr.send();
  }

  // set export status
  function status(s) {
    document.querySelector('#pboverlay h1').innerText = s;
  }

  // set export progress
  function progress(a, b) {
    status('Exporting ' + a + ' of ' + b + '...');
    document.querySelector('#pboverlay meter').value = (a/b)*100;
  }

  // borrowed PRIVATE attribute format from Delicious
  function privacy(p) {
    return (p != 'public') ? 1 : 0;
  }

  // simple escape html
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
    var filename = (board.url || username).replace(/^\/|\/$/g, '').replace(/\//g,'-')+".html";
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
