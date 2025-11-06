/*
 * texteditor.js
 *
 *   UI.TextEditor:          controller for editable content
 *   UI.texteditor.UndoRedo: undo/redo attachment for a text editor
 *   UI.texteditor.Search:   basic (notepad-like) search/replace attachment
 *   UI.FontPicker:          font picker
 *   TextFileIO:             open and save files
 *
 *   single step init:       editor = UI.texteditor.createinit( elemid, opts={} )
 *
 * texteditor.html provides example of use
 *
 * cc0 (public domain) v.010 September 2025, latest version @ github.com/gregsidal
 */
const UI = {};

UI.texteditor = UI.texteditor ? UI.texteditor : {
  createinit: function( elemid, opts ) {
    const editor = new UI.texteditor.Components( elemid, opts );
    editor.get('texteditor').initrefresh();
    return editor;
  }
};

/*
 * Create a texteditor with optional undoredo, basic search, and/or fontpicker attachments
 *
 * To initialize with all attachments using default opts:
 *   components = new UI.texteditor.Components( editablecontentelemid, opts={undoredo:{},basicsearch:{},fontpicker:{}} )
 *
 * To get a component:
 *   component = components.get( componentname='texteditor' )
 */
UI.texteditor.Components = function( texteditorid, opts={} ) {
  var components = {};
  /* setup text editor */
  components.texteditor = new UI.TextEditor();
  components.texteditor.init( texteditorid, opts.texteditor );
  /* attach undo/redo component if opted for */
  if (opts.undoredo) {
    components.undoredo = new UI.texteditor.UndoRedo();
    components.undoredo.init( components.texteditor, opts.undoredo );
  }
  /* attach fontpicker if opted for */
  if (opts.fontpicker) {
    function onfontselected( name ) {
      components.texteditor.setfont( name );
    }
    components.fontpicker = new UI.FontPicker();
    components.fontpicker.init( onfontselected, opts.fontpicker );
  }
  /* attach basic search if opted for */
  if (opts.basicsearch) {
    components.basicsearch = new UI.texteditor.Search();
    components.basicsearch.init( components.texteditor, opts.basicsearch );
  }
  this.add = function( componentname, component ) {components[componentname] = component; return component;}
  this.get = function( componentname='texteditor' ) {return components[componentname];}
  this.rem = function( componentname ) {delete components[componentname];}
}


/*
 * Text editor UI control
 *   uses a callback to dynamically mark up text as its edited
 *
 * To initialize:
 *   texteditor = new UI.TextEditor()
 *   texteditor.init( elemorid )
 *   texteditor.setcallback( 'remarkup', remarkupcallback );
 *   texteditor.initrefresh()  // (ingest and markup the initial text in the element)
 *
 * 'elemorid' (div most likely) will be given "contenteditable='plaintext-only'" property.
 *
 * Functionality is designed to minimize remarkups
 *
 * Callbacks:
 *
 *   HTML = remarkup( plaintext, e2 )
 *     callback is fired when refreshing,
 *     should mark up 'plaintext' and return the HTML
 *
 *   refresh? = statechanged( e2 )
 *     callback is fired from any event or API call that changes text or moves caret
 *       (text changes can also move the caret, but the callback is fired only once)
 *     if callback returns true, remarkup will take place
 *       (the default callback returns true when 'e2.textchanged' is true)
 *
 *   beforetextchange( e2 )
 *     triggered just before text changes (fired by 'beforeinput' event and also API calls that change text) 
 *
 *   to set a callback: prevcallback = texteditor.setcallback( 'callback', f )
 *     (callbacks override others previously set; callbacks should save and call 'prevcallback')
 *
 *   the UndoRedo component below provides examples of callback use
 *
 * Callbacks and most API functions work with an 'e2' parameter, which can include:
 *   action: string indicating what's happening
 *   event: browser event if any
 *   textchanged?: true when text has changed
 *   selrange: selected range or caret position
 *   prevselrange: previous selection range
 *
 * All positions, including selection start/end, are absolute in plaintext
 *
 * texteditor.el()
 *   get text editor HTML element
 *
 * texteditor.setfont( fn )
 *   set font
 *
 * texteditor.zoom( incr = 1 )
 *   zoom in or out (-1)
 *
 * texteditor.wrap( w )
 *   set wrap mode
 *
 * texteditor.put( text, e2={action:"insertFromPut"}, selrange={0,0} )
 *   replace entire text (resets caret/selected range to selrange)
 *
 * texteditor.insert( pastetext, e2={action:"insertFromInsert"}, range=selection, select=true )
 *   insert text into specified or selected range, select insertion when select == true
 *
 * texteditor.getselrange( normalize )
 *   get selected range or caret position
 *   selection range has directionality, i.e., end may be before start; 'normalize' forces start <= end
 *
 * texteditor.setselrange( r, e2={action:'selchangeFromReset'} )
 *   set selected range or caret position (when start == end)
 *
 * texteditor.setcaretpos( pos=-1, e2={action:'selchangeFromReset'} )
 *   set caret position, resets to last position when -1
 *
 * texteditor.focusto( e2={action:"focusTo"}, selrange=this.getselrange() )
 *   focus and set caret position/selected range
 *
 * texteditor.refresh( e2={action:'refresh'} )
 *   remarkup, does not fire state change callback
 *
 * texteditor.scrollelemintoview( el, opts )
 *   scroll to a marked up element in innerHTML
 */
UI.texteditor.defaultopts = {
  ids: {
    wraptoggle: 'texteditor-wraptoggle',
    zoominbtn:  'texteditor-zoominbtn',
    zoomoutbtn: 'texteditor-zoomoutbtn'
  }
};
UI.TextEditor = function() {
  /* init */
  this.init = function( texteditorid, opts ) {
    function defaultstatechangecallback( e2 ) {
      return e2.textchanged;
    }
    function defaultremarkupcallback( plaintext, e2 ) {
      return UI.h.text2html( plaintext );
    }
    _i.textarea = UI.h.el( texteditorid );
    this.setproperty( 'contentEditable', "plaintext-only", "true" );
    this.setcallback( 'beforetextchange' );
    this.setcallback( 'statechanged', defaultstatechangecallback );
    this.setcallback( 'remarkup', defaultremarkupcallback );
    _i.textarea.addEventListener( "scroll", _i.onscroll );
    _i.textarea.addEventListener( "focus", _i.onfocus, {passive:false} );
    _i.textarea.addEventListener( "blur", _i.onblur );
    document.addEventListener( "selectionchange", _i.onselect );
    _i.textarea.addEventListener( "beforeinput", _i.onbeforeinput );
    _i.textarea.addEventListener( "input", _i.oninput );
    _i.textarea.addEventListener( "click", _i.onclick );
    this.changed( false );
    this.initctls( opts );
  }
  this.initctls = function( opts=UI.texteditor.defaultopts ) {
    _i.ids = opts.ids ? opts.ids : UI.texteditor.defaultopts.ids;
    UI.h.defocusize( [_i.ids.wraptoggle, _i.ids.zoominbtn, _i.ids.zoomoutbtn] );
    UI.h.listen( _i.ids.wraptoggle, "click", _i.wrap );
    UI.h.listen( _i.ids.zoominbtn, "click", _i.zoomin );
    UI.h.listen( _i.ids.zoomoutbtn, "click", _i.zoomout );
    var initialwrap = true;
    if (UI.h.el( _i.ids.wraptoggle ))
      initialwrap = UI.h.el(_i.ids.wraptoggle).checked;
    this.wrap( initialwrap );
    _i.resetctls();
  }
  /* set a textarea element property */
  this.setproperty = function( attrname, attrvalue, alertonerror ) {
    UI.h.setproperty( _i.textarea, attrname, attrvalue, alertonerror );
  }
  /* set properties for plain (code) editor vs spell-checking editor */
  this.seteditproperties = function( plain, alertonerror ) {
    UI.h.seteditproperties( _i.textarea, plain, alertonerror );
  }
  /* set a callback */
  this.setcallback = function( cbn, cb ) {
    function __f(){};
    const pcb = _i.callbacks[cbn];
    _i.callbacks[cbn] = cb ? cb : __f;
    return pcb;
  }
  /* get editor HTML element; get plaintext of element */
  this.el = this.tel = function() {return _i.textarea;}
  this.get = function() {return _i.textarea.innerText;}
  this.changed = function( setto ) {
    if (setto != undefined)
      _i.changed = setto;
    return _i.changed;
  }
  /* get whether editor is focused */
  this.isfocused = function() {return _i.focused;}
  /* set font */
  this.setfont = function( fn ) {
    _i.textarea.style['font-family'] = fn;
  }
  /* zoom in or out */
  this.zoom = function( incr = 1 ) {
    _i.zoom( incr );
  }
  /* get or set wrap mode */
  this.wrap = function( w ) {
    if (w == undefined)
      return _i.textarea.style['white-space'] == 'pre-wrap';
    _i.wrap( null, w );
    if (UI.h.el( _i.ids.wraptoggle ))
      UI.h.el( _i.ids.wraptoggle ).checked = w;
    return w;
  }
  /* replace text */
  this.put = function( newtext, e2={action:"insertFromPut"}, selrange={start:0,end:0} ) {
    _i.textwillchg( e2 );
    var text = this.get();
    _i.textarea.innerText = newtext;
    _i.textchg( e2, selrange );
    if (selrange.end == 0)
      _i.textarea.scrollLeft = 0, _i.textarea.scrollTop = 0;
    return selrange;
  }
  /* insert text into range (paste) */
  this.insert = function( pastetext, e2={action:"insertFromInsert"}, range, select=true ) {
    _i.textwillchg( e2 );
    var text = this.get();
    range = range ? range : this.getselrange( true );
    var len = text.length;
    text = text.substring(0,range.start) + pastetext + text.substring(range.end);
    range = {start:range.start, end:range.end + (text.length - len)};
    _i.textarea.innerText = text;
    e2.insertedrange = range;
    _i.textchg( e2, select ? range : {start:range.end, end:range.end} );
    return range;
  }
  /* get sel range or caret pos (caret pos is always selrange.end, end may be before start) */
  this.getselrange = function( normalize ) {return _i.getselrange(normalize);}
  this.getcaretpos = function() {return _i.getcaretpos();}
  /* set caret/selection (may fire 'onstatechange' callback) */
  this.setselrange = function( r, e2={action:'selchangeFromReset'} ) {
    return _i.resetselrange( e2, r );
  }
  /* set caret (may cause 'onstatechange' callback to be fired) */
  this.setcaretpos = function( pos=-1, e2 ) {
    pos = pos < 0 ? this.getcaretpos() : pos;
    return this.setselrange( {start:pos, end:pos}, e2 );
  }
  /* raw remarkup (does not fire state change) */
  this.refresh = function( e2={action:'refresh'} ) {
    _i.remarkup( e2 );
  }
  /* full re-markup (fires state change callback) */
  this.textchanged = function( e2={action:"textChanged"} ) {
    _i.textchg( e2 );
  }
  /* full markup of text in textarea HTML (fires callback) */
  this.initrefresh = function() {
    this.textchanged( {action:"insertFromInit"} );
  }
  /* get scroll position */
  this.getscrollpos = function() {
    return {left:_i.textarea.scrollLeft, top:_i.textarea.scrollTop};
  }
  /* scroll to a scroll position */
  this.scrollto = function( scrollpos={left:0,top:0}, opts ) {
    UI.h.scrolltopos( _i.textarea, scrollpos.left, scrollpos.top, opts );
  }
  /* scroll to an marked up element */
  this.scrollelemintoview = function( el, opts ) {
    UI.h.scrollelemintoview( _i.textarea, el, opts );
  }
  /* scroll to a marked up element cluster */
  this.scrollelemsintoview = function( els, opts ) {
    UI.h.scrollelemsintoview( _i.textarea, els, opts );
  }
  /* focus and set caret/selection */
  this.focusto = function( e2={action:"focusTo"}, selrange=this.getselrange() ) {
    _i.focused = true;
    if (!_i.resetselrange( e2, selrange ))
      _i.hardsetselrange();
    _i.textarea.focus();
  }
  /* internals */
  var _i = {
    resetctls: function() {
    },
    wrap: function( e, w ) {
      const curw = _i.textarea.style['white-space'] == 'pre-wrap';
      if (w == undefined)
        w = !curw;
      if (w != curw)
        _i.textarea.style['white-space'] = w ? 'pre-wrap' : 'pre';
    },
    zoom: function( incr = 1 ) {
      UI.h.zoom( incr, _i.textarea );
    },
    zoomin: function( e ) {
      _i.zoom( 1 );
    },
    zoomout: function( e ) {
      _i.zoom( -1 );
    },
    keepselection: true,
    textarea: null,
    callbacks: {},
    selrange: {start:0, end:0}, prevselrange: {start:0, end:0},
    getselrange: function( normalize ) {
      var r = {start:_i.selrange.start, end:_i.selrange.end};
      if (normalize)
        r = r.end < r.start ? {start:r.end, end:r.start} : r;
      return r;
    },
    getcaretpos: function() {
      return _i.getselrange().end;
    },
    getabsselrange: function() {
      var r = UI.h.getabsselrange( _i.textarea );
      if (!r)
        r = _i.selrange;
      return r;
    },
    snapselrange: function() {
      _i.selrange = _i.getabsselrange( _i.textarea );
      _i.conlog( {f:"snapselrange", start:_i.selrange.start, end:_i.selrange.end}, 1 );
      return _i.selrange;
    },
    hardsetselrange: function() {
      if (_i.focused) {
        UI.h.setabsselrange( _i.selrange, _i.textarea );
        _i.conlog( {f:"hardsetselrange", start:_i.selrange.start, end:_i.selrange.end}, 4 );
      }
    },
    resetselrange: function( e2={action:'selchangeFromReset'}, r ) {
      e2.prevselrange = {start: _i.selrange.start, end: _i.selrange.end};
      if (!r)
        r = _i.snapselrange();
      _i.selrange = {start:r.start, end:r.end};
      e2.selrange = r;
      e2.focused = _i.focused;
      var refreshed = _i.callbacks.statechanged( e2 );
      if (refreshed)
        _i.remarkup( e2 );
      _i.conlog( {f:"resetselrange", 'e2':e2, 'refreshed':refreshed}, 3 );
      return refreshed;
    },
    scroll: {left:0, top:0},
    onscroll: function() {
      _i.conlog( {f:"onscroll"}, 1 );
      _i.scroll = {left:_i.textarea.scrollLeft, top:_i.textarea.scrollTop};
    },
    onfocus: function( e ) {
      var r = UI.h.getabsselrange( _i.textarea );
      _i.conlog( {f:"onfocus", 'start':r?r.start:'undef', 'end':r?r.end:'undef', 'e':e}, 4 );
      /* (the assumption is that if the user has scrolled that's what they wanted to do) */
      _i.textarea.scrollLeft = _i.scroll.left, _i.textarea.scrollTop = _i.scroll.top;
    },
    onblur: function() {
      _i.conlog( {f:"onblur"}, 1 );
      _i.focused = false;
      _i.resetselrange( {action:'blur'} );
    },
    onselect: function( e ) {
      var r = UI.h.getabsselrange( _i.textarea );
      if (r) {
        var restoresel, e2 = {action:'selchangeFromSelect', event:e};
        _i.conlog( {f:"onselect", 'start':r.start, 'end':r.end, 'e':e}, 6 );
        if (!_i.focused && r.start == r.end) {
          e2.action = 'selchangeFromFocus';
          const selr = _i.getselrange( true );
          /* restore prev selection if user is focusing by tapping in that selected range */
          /* restore prev caret/selection if it looks like a focus is idiotically forcing a reset to top */
          if (r.end == 0 || (selr.start < selr.end && r.start >= selr.start && r.end <= selr.end)) {
            r = _i.getselrange();
            _i.conlog( {f:"-- RESTORE SEL", 'start':_i.selrange.start, 'end':_i.selrange.end}, 6 );
            restoresel = true;
          }
        }
        const pr = _i.getselrange();
        if (!_i.focused || r.start != pr.start || r.end != pr.end) {
          _i.focused = true;
          if (!_i.resetselrange( e2, r ))
            if (restoresel)
              _i.hardsetselrange();
        }
      }
    },
    onbeforeinput: function( e ) {
      _i.conlog( {f:"onbeforeinput"}, 1 );
      _i.textwillchg( {action:e.inputType, inputType:e.inputType, event:e} );
    },
    oninput: function( e ) {
      _i.conlog( {f:"oninput"}, 1 );
      _i.textchg( {action:e.inputType, inputType:e.inputType, event:e} );
    },
    onclick: function( e ) {
      //_i.conlog( {f:"onclick", 'e':e}, 6 );
      //if (!_i.focused)
        //_i.clicked = true;
      //_i.hardsetselrange();
    },
    textwillchg: function( e2 ) {
      e2.inputType = e2.inputType ? e2.inputType : e2.action;
      return _i.callbacks.beforetextchange( e2 );
    },
    textchg: function( e2={action:"selchangeFromInput"}, r ) {
      _i.changed = true;
      e2.textchanged = true;
      return _i.resetselrange( e2, r );
    },
    remarkup: function( e2 ) {
      _i.conlog( {f:"remarkup", 'action':e2.action, 'e2':e2}, 4 );
      _i.conlog( {f:"remarkup 1", innerText:_i.textarea.innerText}, 3 );
      if (_i.callbacks.remarkup)
        _i.textarea.innerHTML = _i.callbacks.remarkup( _i.textarea.innerText, e2 );
      _i.hardsetselrange();
      _i.conlog( {f:"remarkup 2", innerText:_i.textarea.innerText, innerHTML:_i.textarea.innerHTML}, 3 );
    },
    conmsg: false,
    conmsggroup: 6,
    conlog: function( msg, group ) {
      if (_i.conmsg && _i.conmsggroup == group) console.log( msg );
    }
  }
}

/*
 *  Undo/redo attachment for TextEditor
 *
 *  To set up:
 *    undoredo = new UI.texteditor.UndoRedo();
 *    undoredo.init( texteditor, opts=UI.texteditor.undoredo.defaultopts );
 *
 *  The controls in 'ids' trigger the undo and redo operations when clicked
 */
UI.texteditor.undoredo = {
  defaultopts: {
    ids: {
      undobtn:  'undoredo-undobtn',
      redobtn:  'undoredo-redobtn'
    },
    lockctls: true
  }
}
UI.texteditor.UndoRedo = function() {
  this.init = function( texteditor, opts=UI.texteditor.undoredo.defaultopts ) {
    _i.texteditor = texteditor;
    _i.ids = opts.ids ? opts.ids : UI.texteditor.undoredo.defaultopts.ids;
    _i.prevbeforechangecallback = _i.texteditor.setcallback( 'beforetextchange', _i.onbeforeinput );
    _i.prevchangecallback = _i.texteditor.setcallback( 'statechanged', _i.oneditorstatechange );
    UI.h.defocusize( [_i.ids.undobtn, _i.ids.redobtn] );
    this.lockctls( opts.lockctls );
  }
  this.lockctls = function( lock=true ) {
    if (lock) {
      UI.h.listen( _i.ids.undobtn, "click", _i.undo );
      UI.h.listen( _i.ids.redobtn, "click", _i.redo );
      _i.resetctls();
    }
    else {
      UI.h.ignore( _i.ids.undobtn, "click", _i.undo );
      UI.h.ignore( _i.ids.redobtn, "click", _i.redo );
    }
  }
  this.undo = function() {
    _i.undo();
  }
  this.redo = function() {
    _i.redo();
  }
  this.clear = function() {
    _i.clear();
  }
  this.reset = function() {
    _i.resetctls();
  }
  // internals
  var _i = {
    texteditor: null, ids: {},
    resetctls: function() {
      var states = {canundo: _i.undolog.length,
                    canredo: _i.redolog.length};
      UI.h.enable( _i.ids.undobtn, states.canundo );
      UI.h.enable( _i.ids.redobtn, states.canredo );
    },
    clear: function() {
      _i.undolog = [], _i.redolog = [], _i.mark = false;
      _i.previnputtype = "", _i.wasblank = true;
      _i.resetctls();
    },
    undolog:[], redolog:[],
    log: function( log, text, selrange=_i.texteditor.getselrange(), 
                   wrap=_i.texteditor.wrap(), scrollpos=_i.texteditor.getscrollpos() ) {
      log.push( {'text':text, 'selrange':selrange, 'wrap':wrap, 'scrollpos':scrollpos} );
    },
    unlog: function( log, e2 ) {
      const le = log.pop();
      _i.texteditor.put( le.text, e2, le.selrange );
      _i.texteditor.wrap( le.wrap );
      _i.texteditor.scrollto( le.scrollpos );
    },
    willchange: function( action ) {
      const t = _i.texteditor.get();
      if (t) {
        _i.redolog = [];
        _i.log( _i.undolog, t );
        _i.mark = true;
      }
    },
    haschanged: function() {
      const t = _i.texteditor.get();
      if (_i.mark && t) {  // (remove trailing line feeds)
        var len = t.length;
        for( var i=t.length-1; i>=0; i-- )
          if (t[i] == '\n' || t[i] == ' ')
            len--;
          else
            break;
        if (len < t.length) {
          var t2 = t.slice( 0, len );
          if (t2 == _i.undolog[_i.undolog.length-1])
            _i.undolog.length--;
        }
      }
      _i.mark = false;
      _i.resetctls();
    },
    oneditorstatechange: function( e2 ) {
      var refresh = _i.prevchangecallback( e2 );
      if (e2.group && e2.group.more)
        return refresh;
      if (e2.textchanged) {
        if (e2.action != "insertFromUndo" && e2.action != "insertFromRedo")
          _i.haschanged();
        _i.previnputtype = e2.action;
        _i.resetctls();
      }
      return refresh;
    },
    undo: function() {
      if (!_i.undolog.length)
        return alert( "No edit history" );
      _i.log( _i.redolog, _i.texteditor.get() ); 
      _i.unlog( _i.undolog, {action:"insertFromUndo"} );
    },
    redo: function() {
      if (!_i.redolog.length)
        return alert( "No undo history" );
      _i.log( _i.undolog, _i.texteditor.get() );
      _i.unlog( _i.redolog, {action:"insertFromRedo"} );
    },
    previnputtype: "", wasblank: true,
    onbeforeinput: function( e ) {
      const ret = _i.prevbeforechangecallback( e );
      if (e.inputType == "insertFromUndo" || e.inputType == "insertFromRedo")
        return;
      if (e.group && !e.group.start)
        return;
      //console.log( 'beforeinput previnputtype: ' + _i.previnputtype );
      //console.log( 'beforeinput inputtype: ' + e.inputType );
      //if (e.inputType == "insertLineBreak")
        //return;
      //console.log( "oninput, e=", e );
      function startswith( s, sub ) {
        return s && sub && s.substring( 0, sub.length ) == sub;
      }
      if (startswith( e.inputType, "insertFrom" ) || startswith( _i.previnputtype, "insertFrom" )) 
        _i.willchange( e.inputType );
      else {
        var pt = _i.previnputtype;
        var t = e.inputType;
        const ins = "insert";
        if (startswith( t, "delete" ))
          t = ins;
        if (startswith( pt, "delete" ))
          pt = ins;
        if (t.substring( 0, ins.length ) != pt.substring( 0, ins.length ))
          _i.willchange( e.inputType );
      }
      return ret;
    }
  }
}

/*
 *  Basic (notepad-like) search/replace attachment for a TextEditor
 *
 *  To set up:
 *    search = new UI.texteditor.Search();
 *    search.init( texteditor, ids=UI.search.defaultids );
 *
 *  The controls in 'ids' trigger the search/replace functions
 */
UI.texteditor.search = {
  defaultopts: {
    ids: {
      find:           'search-find',        //input
      findbtn:        'search-findbtn',
      nextbtn:        'search-nextbtn',
      replace:        'search-replace',     //input
      replacebtn:     'search-replacebtn',
      replaceallbtn:  'search-replaceallbtn'
    },
    classes: {
      current:        'search-current'
    },
    regexflags:       'g'
  }
};
UI.texteditor.Search = function() {
  this.init = function( texteditor, opts = UI.texteditor.search.defaultopts ) {
    _i.texteditor = texteditor;
    _i.prevchangecallback = texteditor.setcallback( 'statechanged', _i.oneditorstatechange );
    _i.prevremarkupcallback = texteditor.setcallback( 'remarkup', _i.onremarkup );
    _i.ids = opts.ids ? opts.ids : UI.texteditor.search.defaultopts.ids;
    _i.classes = opts.classes ? opts.classes : UI.texteditor.search.defaultopts.classes;
    _i.regexflags = opts.regexflags ? opts.regexflags : UI.texteditor.search.defaultopts.regexflags;
    //UI.h.defocusize( [_i.ids.findbtn, _i.ids.nextbtn, _i.ids.replacebtn, _i.ids.replaceallbtn] );
    UI.h.listen( _i.ids.findbtn, "click", _i._find );
    UI.h.listen( _i.ids.nextbtn, "click", _i._next );
    UI.h.listen( _i.ids.replacebtn, "click", _i.replace );
    UI.h.listen( _i.ids.replaceallbtn, "click", _i.replaceall );
    UI.h.seteditproperties( _i.ids.find, true );
    UI.h.seteditproperties( _i.ids.replace, true );
    UI.h.listen( _i.ids.find, "input", _i.clear );
    _i.resetctls();
  }
  this.clear = function() {
    _i.clear( null );
  }
  this.find = function( verbose=true ) {
    _i.find( verbose );
  }
  this.next = function( start, verbose ) {
    _i.next( start, verbose );
  }
  this.scrollcurrentintoview = function( opts ) {
    _i.scrollcurrentintoview( opts );
  }
  this.replace = function() {
    return _i.replace();
  }
  // internals
  var _i = {
    texteditor: null,
    action: function( e, t ) {
      return e && e.action && e.action.substring( 0, t.length ) == t;
    },
    oneditorstatechange: function( e2 ) {
      var refresh = _i.prevchangecallback( e2 );
      if (e2.action == 'selchangeFromFocus')
        refresh = true;
      else
        if (!e2.focused)
          if (e2.selrange.start != e2.selrange.end || e2.prevselrange.start != e2.prevselrange.end)
            refresh = true;
      _i.resetctls();
      return refresh;
    },
    onremarkup: function( plaintext, e2 ) {
      var html;
      const sr = _i.texteditor.getselrange( true );
      if (sr.start != sr.end && !e2.focused) {
        html = UI.h.text2html( plaintext.substring(0,sr.start) ) + 
               "<mark class='" + _i.classes.current + "'>" + 
               UI.h.text2html( plaintext.substring(sr.start,sr.end) ) +
               "</mark>" + 
               UI.h.text2html( plaintext.substring(sr.end) );
      }
      else
        html = _i.prevremarkupcallback( plaintext, e2 );
      return html;
    },
    resetctls: function() {
      const cantfind = !UI.h.get( _i.ids.find );
      const sr = _i.texteditor.getselrange();
      const end = sr.end >= (_i.texteditor.get().length-1);
      const cantreplace = sr.start == sr.end;
      UI.h.el( _i.ids.findbtn ).disabled = cantfind;
      UI.h.el( _i.ids.nextbtn ).disabled = cantfind || end;
      UI.h.el( _i.ids.replacebtn ).disabled = cantreplace;
      UI.h.el( _i.ids.replaceallbtn ).disabled = cantreplace;
    },
    clear: function( e ) {
      _i.resetctls();
    },
    nextrange: function( start=-1, text=_i.texteditor.get() ) {
      const regexstr = UI.h.get( _i.ids.find );
      start = start >= 0 ? start : _i.texteditor.getselrange( true ).end;
      const matches = text.matchAll( new RegExp(regexstr,_i.regexflags) );
      var r;
      for( const match of matches ) {
        if (match.index >= start) {
          r = {start:match.index, end:match.index+match[0].length};
          break;
        }
      }
      return r;
    },
    next: function( e2={action:'selchangeFromNext'}, start=_i.texteditor.getselrange(true).end, verbose=true ) {
      var r = _i.nextrange( start );
      if (!r)
        r = {start:_i.texteditor.get().length, end:_i.texteditor.get().length};
      _i.texteditor.setselrange( r, e2 );
      _i.scrollcurrentintoview();
      return r;
    },
    _next: function( e ) {
      return _i.next();
    },
    find: function( verbose=true ) {
      const r = _i.next( {action:'selchangeFromFind'}, 0, verbose );
    },
    _find: function( e ) {
      _i.find();
    },
    scrollmarkintoview: function( cls, opts ) {
      const els = _i.texteditor.el().getElementsByClassName( cls );
      if (els && els.length)
        _i.texteditor.scrollelemintoview( els[0], opts );
    },
    scrollcurrentintoview: function( opts ) {
      _i.scrollmarkintoview( _i.classes.current, opts );
    },
    str2regex: function( regexstr, flags='' ) {
      regexstr = regexstr.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
      return new RegExp( regexstr, flags );
    },
    pastetext: function( text, range, replacewith ) {
      var newtext = text.slice( 0, range.start );
      var token = text.substring( range.start, range.end );
      //newtext += token.replace( str2regex(token,''), replacewith );
      newtext += token.replace( token, replacewith );
      newtext += text.slice( range.end );
      return newtext;
    },
    _replace: function( group ) {
      var sr = _i.texteditor.getselrange( true );
      if (sr.start == sr.end) {
        //alert( "No selection" );
        if (group)
          group.more = false;
      }
      else {
        var e2 = {action:'insertFromReplace'};
        var text = _i.texteditor.get();
        var len = text.length;
        text = _i.pastetext( text, sr, UI.h.get(_i.ids.replace) );
        sr = {start:sr.start, end:sr.end + (text.length - len)};
        var newpos = sr.end;
        sr = _i.nextrange( newpos, text );
        if (group) {
          group.more = sr;
          e2.group = group;
        }
        _i.texteditor.put( text, e2, {start:newpos, end:newpos} );
        newpos = sr ? newpos : text.length;
        _i.next( e2, newpos );
      }
      return group;
    },
    replace: function() {
      return _i._replace();
    },
    replaceall: function() {
      function repl1() {
        group = _i._replace( group );
        group.start = false;
        if (group.more)
          setTimeout( repl1, 250 );
      }
      var group = {start:true};
      repl1();
    }
  }
}

/*
 *  Font picker
 *
 *  To set up:
 *    fontpicker = new UI.FontPicker();
 *    search.init( onselectcallback, ids=UI.fontpicker.defaultids, 
 *                 classes=UI.fontpicker.defaultclasses, fallbacks=UI.fontpicker.fallbacks );
 *
 *  onselectcallback( fontname )
 *
 *  The controls in 'ids' handle selections, etc.
 */
UI.fontpicker = {
  defaultopts: {
    ids: {
      list:                      'fontpicker-list',      //div
      fontname:                  'fontpicker-fontname',  //input
      addbtn:                    'fontpicker-addbtn',
      msg:                       'fontpicker-msg'
    },
    classes: {
      'item-container':          'fontpicker-item-container',         //div
      'item-container-selected': 'fontpicker-item-container-selected',
      item:                      'fontpicker-item'                    //div
    },
    fallbacks: [
            {fullName:"Monospace", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Arial", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Courier New", postscriptName:"", family:"", style:"sans-serif"}, 
            {fullName:"Agency FB", postscriptName:"", family:"", style:"serif"},
            {fullName:"Book Antiqua", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Calibri", postscriptName:"", family:"", style:"sans-erif"}, 
            {fullName:"Cambria", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Comic Sans MS", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Consolas", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Franklin Gothic", postscriptName:"", family:"", style:"sans-serif"}, 
            {fullName:"Garamond", postscriptName:"", family:"", style:"serif"},
            {fullName:"Impact", postscriptName:"", family:"", style:"sans-serif"}, 
            {fullName:"Lucida Sans", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Lucida Handwriting", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Lucida Calligraphy", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Lucida Console", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Mistral", postscriptName:"", family:"", style:"sans-serif"}, 
            {fullName:"Palatino Linotype", postscriptName:"", family:"", style:"serif"},
            {fullName:"Papyrus", postscriptName:"", family:"", style:"sans-serif"}, 
            {fullName:"Segoe UI", postscriptName:"", family:"", style:"sans-serif"},
            {fullName:"Tahoma", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Times New Roman", postscriptName:"", family:"", style:"serif"}, 
            {fullName:"Verdana", postscriptName:"", family:"", style:"sans-serif"}
    ]
  },
  _onselect: function( listid, fontname ) {UI.fontpicker[listid].select( fontname );}
}
UI.FontPicker = function() {
  this.init = function( onselectcallback, opts=UI.fontpicker.defaultopts ) {
    _i.selectcallback = onselectcallback;
    _i.ids = opts.ids ? opts.ids : UI.fontpicker.defaultopts.ids;
    _i.classes = opts.classes ? opts.classes : UI.fontpicker.defaultopts.classes;
    _i.fallbacks = opts.fallbacks ? opts.fallbacks : UI.fontpicker.defaultopts.fallbacks;
    UI.fontpicker[_i.ids.list] = this;
    UI.h.listen( _i.ids.addbtn, "click", _i.add );
    UI.h.seteditproperties( _i.ids.fontname, true );
    UI.h.listen( _i.ids.fontname, "input", _i.fontnameinput );
    _i.fontnameinput();
  }
  this.populatelist = async function() {
    return _i.populatelist();
  },
  this.add = function() {
    return _i.add();
  }
  this.select = function( fontname ) {
    _i.selectcallback( fontname );
    if (_i.selectedid)
      UI.h.class.rem( _i.selectedid, _i.classes['item-container-selected'] );
    _i.selectedid = fontname;
    UI.h.class.add( _i.selectedid, _i.classes['item-container-selected'] );
  }
  // internals
  var _i = {
    selectedid: null,
    fontnameinput: function() {
      UI.h.el(_i.ids.addbtn).disabled = !UI.h.el(_i.ids.fontname).value;
    },
    add: function() {
      //var fn = prompt( "Name of font to add:", "" );
      const fn = UI.h.el(_i.ids.fontname).value;
      if (fn && !({fullName:fn} in _i.fallbacks)) {
        var tmp = [{fullName:fn}];
        for( const fd of _i.fallbacks )
          tmp.push( fd );
        _i.fallbacks = tmp;
        _i.populatelist();
        UI.h.el(_i.ids.list).firstElementChild.scrollIntoView( {behavior: "smooth"} );
      }
    },
    populatelist: async function() {
      var availfonts;
      try {
        availfonts = await window.queryLocalFonts();
        //test availfonts = _i.fallbacks;
        UI.h.el(_i.ids.addbtn).innerHTML = "";
        UI.h.el(_i.ids.msg).innerHTML = "";
      }
      catch( e ) {
        /*if (!_i.listalerted)
          alert( "Web browser does not support font query API, " + 
                 "so some common fonts will be shown.  Fonts not available on device will render with system defaults." );*/
        _i.listalerted = true;
        availfonts = _i.fallbacks;
      }
      var html = "", name, attrs;
      for( var fd of availfonts ) {
        name = fd.fullName ? fd.fullName : (fd.family ? fd.family : fd.style);
        html += UI.h.markuphtml( 'div', { 
             'class':   _i.classes['item-container'] + (_i.selected == name ? " "+_i.classes['item-container-selected'] : ""),
             'id':      name,
             'style':   "font-family:" + name,
             'onclick': "UI.fontpicker._onselect(" + "'" + _i.ids.list + "','" + name + "'" + ")"
            },
            UI.h.markuphtml( 'div', {'class':_i.classes.item}, fd.showName?fd.showName:name) );
      }
      UI.h.el(_i.ids.list).innerHTML = html;
    }
  }
}

/*
 * File open/save/etc.
 */
var TextFileIO = {
  /* make data url */
  __lastobjurl: null,
  todataurl: function( mimetype, content ) {
    if (TextFileIO.__lastobjurl)
      URL.revokeObjectURL( TextFileIO.__lastobjurl );
    var b = new Blob( [content], {type:mimetype} );
    TextFileIO.__lastobjurl = URL.createObjectURL( b );
    return TextFileIO.__lastobjurl;
  },
  /* save content to a file by activating a <href href=".." download=".."> control */
  savedataurl: function( id, fn, mimetype, content ) {
    var e = UI.h.el( id );
    e.download = fn;
    e.href = TextFileIO.todataurl( mimetype, content );
    e.click();
  },
  /* save a text file using a <href href=".." download=".."> control */
  save: function( id, fn, content ) {
    TextFileIO.savedataurl( id, fn, 'text/plain', content );
  },
  /* activate a <input type='file'> control so user can select file(s) */
  selfile: function( idinp ) {
    var e = UI.h.el( idinp );
    e.value = "";
    e.click();
  },
  /* open a text file */
  open: function( callback, file, onlyfiletype="text/*" ) {
    if (!file)
      return;
    var reader = new FileReader();
    reader.onerror = function( e ) {UI.h.el(idout).value = e;}
    reader.onload = function( e ) {
      if (file.type.slice(0,("text").length) == "text" || file.type == "image/svg+xml")
        callback( file.name, e.target.result, file.type );
      else
        alert( "Invalid file type ("+file.type+")" );
    }
    reader.readAsText( file );
  }
}

/*
 *  Popup support
 */
UI.popup = {
  show: function( idbtn, id ) {
    if (idbtn) {
      UI.h.class.rem( idbtn, 'closed' );
      UI.h.class.add( idbtn, 'open' );
    }
    UI.h.class.rem( id, 'closed' );
    UI.h.class.add( id, 'open' );
  },
  hide: function( idbtn, id ) {
    if (idbtn) {
      UI.h.class.rem( idbtn, 'open' );
      UI.h.class.add( idbtn, 'closed' );
    }
    UI.h.class.rem( id, 'open' );
    UI.h.class.add( id, 'closed' );
  },
  toggle: function( idbtn, id, focusonopen, togglecallback ) {
    if (togglecallback)
      if (togglecallback( UI.h.el(id).classList.contains('closed'), idbtn, id ))
        return;
    if (idbtn)
      UI.h.class.toggle( idbtn, 'open', 'closed' );
    UI.h.class.toggle( id, 'open', 'closed' );
    if (focusonopen && id)
      if (UI.h.el(id).classList.contains( 'open' ))
        UI.h.el(id).focus();
  },
  init: function( idgroup, idbtn, idpopup, autoclose=[], sel=[], selcallback, togglecallback ) {
    function btnclick() {
      UI.popup.toggle( idbtn, idpopup, true, togglecallback );
    }
    function clickout( e ) {
      if (idgroup)
        if (!UI.h.isdescendantof( e.target, UI.h.el(idgroup) ))
          UI.popup.hide( idbtn, idpopup );
    }
    var prevsel = '';
    function selclick( e ) {
      prevsel = prevsel ? prevsel : sel[0];
      var close;
      if (selcallback)
        close = selcallback( e.target, idbtn, idpopup );
      UI.popup.select( idbtn, idpopup, e.target.id, prevsel, close );
      prevsel = e.target.id;
    }
    for( var i=0; i<autoclose.length; i++ )
      UI.h.listen( autoclose[i], "click", clickout );
    for( i=0; i<sel.length; i++ )
      UI.h.listen( sel[i], "click", selclick );
    if (idbtn)
      UI.h.listen( idbtn, "click", btnclick );
  },
  prompt: function( idpopup ) {
    UI.popup.show( null, idpopup );
  },
  select: function( idbtn, idpopup, idnewitem, idprevitem, close ) {
    if (idprevitem && UI.h.el(idprevitem).classList.contains( 'open' ))
      UI.popup.hide( null, idprevitem );
    if (idnewitem && UI.h.el(idnewitem).classList.contains( 'closed' ))
      UI.popup.show( null, idnewitem );
    if (close)
      UI.popup.hide( idbtn, idpopup );
  }
}

/*
 *  UI helpers
 */
UI.h = {
  el: function( id ) {
    var e = null;
    if (id)
      if (id instanceof HTMLElement)
        e = id;
      else
        e = document.getElementById( id );
    return e;
  },
  get: function( id ) {
    var e = UI.h.el( id );
    return e ? e.value : "";
  },
  put: function( id, text, append ) {
    var t = "";
    if (append)
      t += UI.h.el( id ).value;
    UI.h.el( id ).value = t + text;
  },
  listen: function( id, eventstr, callback ) {
    const e = UI.h.el( id );
    if (e)
      return e.addEventListener( eventstr, callback );
  },
  ignore: function( id, eventstr, callback ) {
    const e = UI.h.el( id );
    if (e)
      return e.removeEventListener( eventstr, callback );
  },
  /* set element property */
  setproperty: function( id, attrname, attrvalue, alertonerror ) {
    const el = UI.h.el( id );
    try {
      const prevval = el[attrname];
      el[attrname] = attrvalue;
      return prevval;
    }
    catch( e ) {
      if (alertonerror)
        alert( "Browser doesn't support '" + attrname + "' attribute" );
    }
  },
  /* set properties for plain (code) editor vs spell-checking editor */
  seteditproperties: function( id, plain, alertonerror ) {
    UI.h.setproperty( id, 'autocapitalize', plain ? "off" : "on", alertonerror );
    UI.h.setproperty( id, 'autocomplete', plain ? "off" : "on", alertonerror );
    UI.h.setproperty( id, 'autocorrect', plain ? "off" : "on", alertonerror );
    UI.h.setproperty( id, 'spellcheck', plain ? false : true, alertonerror );
  },
  defocusize: function( elems ) {
    for ( const el of elems )
      UI.h.listen( el, "mousedown", function(e){e.preventDefault();} );
  },
  enable: function( id, enable ) {
    const e = UI.h.el( id );
    if (e)
      return e.disabled = !enable;
  },
  zoom: function( incr = 1, id ) {
    var z = UI.h.el( id ).style['font-size'];
    z = z ? z : "100%";
    z = z.slice( 0, z.length-1 ) * 1;
    z += incr * 6; if (z < 40) z = 40;
    UI.h.el( id ).style['font-size'] = z + "%";
  },
  setstyle: function( id, c, v ) {
    UI.h.el( id ).style[c] = v;
  },
  setdisplay: function( id, dis ) {
    UI.h.setstyle( id, 'display', dis );
  },
  /* determine if 'el' is inside 'parel' */
  isdescendantof: function( el, parel ) {
    //el = UI.h.el( el );
    //parel = UI.h.el( parel );
    while (el && el != parel)
      el = el.parentNode;
    return el;
  },
  /* get selection range relative to innerText (plaintext) of 'parel' */
  getabsselrange: function( parel ) {
    var sr;
    const s = window.getSelection();
    if (s.rangeCount && UI.h.isdescendantof(s.anchorNode,parel) && UI.h.isdescendantof(s.focusNode,parel)) {
      sr = {start:0, end:0};
      const r = s.getRangeAt( 0 );
      const pfx = r.cloneRange();
      pfx.selectNodeContents( parel );
      pfx.setEnd( s.anchorNode, s.anchorOffset );
      sr.start = pfx.toString().length;
      pfx.setEnd( s.focusNode, s.focusOffset );
      sr.end = pfx.toString().length;
    }
    return sr;
  },
  /* get position in DOM of pos in innerText (plaintext) of 'parel' */
  getDOMposofabspos: function( pos, parel ) {
    for( const node of parel.childNodes) {
      if (node.nodeType == Node.TEXT_NODE) {
        if (node.length >= pos)
          return {'node':node, offset:pos};
        else
          pos -= node.length;
      }
      else {
        const DOMpos = UI.h.getDOMposofabspos( pos, node );
        if (DOMpos)
          return DOMpos;
        pos -= node.innerText.length;
      }
    }
  },
  /* set selection in innerText (plaintext) of 'parel' */
  setabsselrange: function( sr, parel ) {
    const s = window.getSelection();
    s.removeAllRanges();
    const r = document.createRange();
    var DOMpos1 = DOMpos2 = UI.h.getDOMposofabspos( Math.min(parel.innerText.length,sr.start), parel );
    if (DOMpos1) {
      if (sr.end != sr.start)
        DOMpos2 = UI.h.getDOMposofabspos( Math.min(parel.innerText.length,sr.end), parel );
      if (DOMpos2)
        s.setBaseAndExtent( DOMpos1.node, DOMpos1.offset, DOMpos2.node, DOMpos2.offset );
    }
    return sr;
  },
  unionclientrects: function( els ) {
    var r, ur = {};
    for( var i=0; i<els.length; i++ ) {
      r = els[i].getBoundingClientRect();
      if (ur.left == undefined || r.left < ur.left)
        ur.left = r.left;
      if (ur.top == undefined || r.top < ur.top)
        ur.top = r.top;
      if (ur.right == undefined || r.right > ur.right)
        ur.right = r.right;
      if (ur.bottom == undefined || r.bottom > ur.bottom)
        ur.bottom = r.bottom;
    }
    return ur;
  },
  /* smooth scroll an element to a pixel position */
  scrolltopos: function( el, posx, posy, opts={} ) {
    opts.smooth = opts.smooth == undefined ? true : opts.smooth,
    opts.delay = opts.delay == undefined ? 20 : opts.delay;
    opts.maxsteps = opts.maxsteps == undefined ? 20 : opts.maxsteps;
    opts.minincr = opts.minincr == undefined ? 5 : opts.minincr;
    var delta = {
      x: (posx - el.scrollLeft) / opts.maxsteps,
      y: (posy - el.scrollTop) / opts.maxsteps
    }
    delta.x = delta.x < 0 ? Math.min(delta.x,opts.minincr) : Math.max(delta.x,opts.minincr);
    delta.y = delta.y < 0 ? Math.min(delta.y,opts.minincr) : Math.max(delta.y,opts.minincr);
    var nextpos = {
      x: el.scrollLeft,
      y: el.scrollTop
    }
    function anim() {
      nextpos.x += delta.x,
      nextpos.y += delta.y;
      nextpos.x = delta.x < 0 ? Math.max(nextpos.x,posx) : Math.min(nextpos.x,posx);
      nextpos.y = delta.y < 0 ? Math.max(nextpos.y,posy) : Math.min(nextpos.y,posy);
      nextpos.x = opts.smooth ? nextpos.x : posx;
      nextpos.y = opts.smooth ? nextpos.y : posy;
      el.scrollLeft = nextpos.x;
      el.scrollTop = nextpos.y;
      if (nextpos.x != posx || nextpos.y != posy)
        setTimeout( anim, opts.delay );
      else
        if (opts.scrollingdonecallback)
          opts.scrollingdonecallback();
    }
    anim();
  },
  /* scroll to and center a rect in an element */
  scrolltorect: function( el, r={left:0,right:0,top:0,bottom:0}, opts={} ) {
    function inside( pt, r ) {
      return (pt.x >= r.left && pt.x < r.right && 
              pt.y >= r.top && pt.y < r.bottom);
    }
    function toobigx( r, cr ) {
      var w = r.right - r.left;
      var cw = cr.right - cr.left;
      return (w > cw);
    }
    function toobigy( r, cr ) {
      var h = r.bottom - r.top;
      var ch = cr.bottom - cr.top;
      return (h > ch);
    }
    opts.center = opts.center == undefined ? true : opts.center;
    const ebr = el.getBoundingClientRect();
    var vr = {
      left: el.scrollLeft,
      right: el.scrollLeft + ebr.width,
      top: el.scrollTop,
      bottom: el.scrollTop + ebr.height
    };
    /* (if rect is already visible, no scrolling takes place) */
    if (inside( {x:r.left, y:r.top}, vr ) && inside( {x:r.right, y:r.bottom}, vr )) {
      if (opts.scrollingdonecallback)
        opts.scrollingdonecallback();
    }
    else {
      var pt = {x: r.left + ((r.right - r.left) / 2),
                y: r.top + ((r.bottom - r.top) / 2)};
      if (toobigx( r, ebr ))
        /* scroll to left if rect is too wide to fit in client */
        pt.x = r.left - 10;
      else {
        /* (the bias is to scroll to 0 horizontally (don't center) if rect in leftmost area) */
        if (r.right < ebr.width)
          pt.x = 0;
        else
          if (opts.center)
            /* move x to center if entire width not already visible */
            if (r.left < vr.left || r.right > vr.right)
              pt.x -= ebr.width / 2;
            else
              pt.x = el.scrollLeft;
      }
      if (toobigy( r, ebr ))
        /* scroll to top if rect is too long to fit in client */
        pt.y = r.top - 10;
      else
        if (opts.center)
          /* move y to center if entire length not already visible */
          if (r.top < vr.top || r.bottom > vr.bottom)
            pt.y -= ebr.height / 2;
          else
            pt.y = el.scrollTop;
      UI.h.scrolltopos( el, pt.x, pt.y, opts );
      return true;
    }
  },
  /* scroll container to an element cluster */
  scrollelemsintoview: function( containerel, insideels, opts={} ) {
    const ir = UI.h.unionclientrects( insideels );
    const cr = containerel.getBoundingClientRect();
    const oir = {
      left: ir.left - cr.left + containerel.scrollLeft,
      right: ir.right - cr.left + containerel.scrollLeft,
      top: ir.top - cr.top + containerel.scrollTop,
      bottom: ir.bottom - cr.top + containerel.scrollTop
    };
    function scrollingdone() {
      if (opts.blink) {
        var t = opts.blink.targets;
        if (!t)
          t = insideels;
        for( var i=0; i<t.length; i++ )
          UI.h.class.add( t[i], opts.blink.class );
        function blinkdone() {
          for( var j=0; j<t.length; j++ )
            UI.h.class.rem( t[j], opts.blink.class );
        }
        setTimeout( blinkdone, opts.blink.duration );
      }
      delete opts.scrollingdonecallback;
    }
    opts.scrollingdonecallback = scrollingdone;
    UI.h.scrolltorect( containerel, oir, opts );
  },
  /* scroll container to an element, centered (default) */
  scrollelemintoview: function( containerel, insideel, opts={} ) {
    UI.h.scrollelemsintoview( containerel, [insideel], opts );
  },
  markuphtml: function( tag, attrs, innerhtml ) {
    var html = '<' + tag;
    for( var a in attrs )
      html += " " + a + '="' + attrs[a] + '"';
    return html + '>' + innerhtml + '</' + tag + '>';
  },
  text2html: function( text ) {
    var newtext = text.replace( /&/g, "&amp;" );
    newtext = newtext.replace( />/g, "&gt;" );
    return newtext.replace( /</g, "&lt;" );
  },
  class: {
    add: function( id, c ) {
      var e = UI.h.el( id );
      if (e)
        e.classList.add( c );
    },
    rem: function( id, c ) {
      var e = UI.h.el( id );
      if (e && e.classList.contains( c ))
        e.classList.remove( c );
    },
    toggle: function( id, c1, c2 ) {
      var e = UI.h.el( id );
      if (e)
        if (e.classList.contains( c1 )) {
          e.classList.remove( c1 );
          if (c2) e.classList.add( c2 );
        }
        else {
          if (c2) e.classList.remove( c2 );
          e.classList.add( c1 );
        }
    },
    replace: function( id, c1, c2 ) {
      var e = UI.h.el( id );
      if (e) {
        if (e.classList.contains( c1 ))
          e.classList.remove( c1 );
        if (c2) e.classList.add( c2 );
      }
    }
  }
}
