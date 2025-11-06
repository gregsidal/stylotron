/*
 * stylotroneditor.js: foundation for WYSIWYG editor using stylotron.js for dynamic markup
 *
 *   UI.stylotroneditor.Styler:     uses a SOT.PatternSeries object to mark up content in a UI.TextEditor as it changes
 *
 *   UI.stylotroneditor.Selections: souped up selection and multi-selections support
 *   UI.stylotroneditor.Search:     regex search and replace; marks up matched, current, and replaced ranges
 *
 *   UI.StylotronEditor:            a UI.TextEditor with Styler and other opt-in attachments
 *
 *   single step init:              editor = UI.stylotroneditor.createinit( texteditorid, opts, patterndefs )
 *
 * Requires stylotron.js and texteditor.js
 *
 * See texteditor.html and stylotronIDE.html for examples of use
 *
 * cc0 (public domain) v.010 September 2025, latest version @ github.com/gregsidal
 */

/*
 * Single-step setup
 */
UI.stylotroneditor = {
  createinit: function( texteditorid, opts, patterndefs={} ) {
    const editor = new UI.StylotronEditor( texteditorid, opts );
    editor.styler.patterns().add( patterndefs );
    editor.texteditor.initrefresh();
    return editor;
  }
}

/*
 * Texteditor with styler; also optional undo/redo, fontpicker, and search attachments
 */
UI.StylotronEditor = function( texteditorid, opts={} ) {
  /* setup text editor with undo/redo and fontpicker if indicated */
  this.components = new UI.texteditor.Components( texteditorid, opts );
  this.texteditor = this.components.get( 'texteditor' );
  /* attach patterns component */
  this.styler = this.components.add( 'styler', new UI.stylotroneditor.Styler() );
  this.styler.init( this.texteditor );
  /* attach optional selections component */
  if (opts.selections) {
    this.selections = this.components.add( 'selections', new UI.stylotroneditor.Selections() );
    this.selections.init( this.texteditor, this.styler, opts.selections.profiles );
  }
  /* attach optional search component */
  if (opts.search) {
    this.search = this.components.add( 'search', new UI.stylotroneditor.Search() );
    this.search.init( this.texteditor, this.styler, opts.search );
  }
}

/*
 * Styler attachment for a TextEditor
 *   marks up content in a text editor with CSS classes using stylotron.js
 *
 * To set up:
 *   styler = new UI.stylotroneditor.Styler();
 *   styler.init( texteditor );
 *
 * An internal SOT.PatternSeries object determines what ranges of text are marked up
 *   to get: patterns = styler.patterns()
 *   regexs and ranges can be added to 'patterns' as described in SOT.PatternSeries comments
 */
UI.stylotroneditor.Styler = function() {
  this.init = function( texteditor ) {
    _i.texteditor = texteditor;
    _i.patterns = new SOT.PatternSeries();
    _i.prevbeforetextchangecallback = texteditor.setcallback( 'beforetextchange', _i.oneditorbeforetextchange );
    _i.prevchangecallback = texteditor.setcallback( 'statechanged', _i.oneditorstatechange );
    _i.prevremarkupcallback = texteditor.setcallback( 'remarkup', _i.oneditorremarkup );
  }
  this.patterns = function() {return _i.patterns};
  /* get text map (map of all regex matches) */
  this.textmap = function( recreate ) {
    if (recreate || !_i.currenttextmap)
      _i.currenttextmap = _i.patterns.buildmatchesmap( _i.texteditor.get() );
    return _i.currenttextmap;
  }
  this.reset = function() {
    this.textmap( true );
    return _i.texteditor.refresh();
  }
  // internals
  var _i = {
    texteditor: null, profiles: {},
    oneditorbeforetextchange: function( e2 ) {
      const ret = _i.prevbeforetextchangecallback( e2 );
      _i.currenttextmap = null; //_i.patterns.buildmatchesmap( _i.textarea.get() );
      return ret;
    },
    oneditorstatechange: function( e2 ) {
      var refresh = _i.prevchangecallback( e2 );
      refresh = e2.textchanged || refresh;
      return refresh;
    },
    oneditorremarkup: function( text, e2 ) {
      //var HTML = _i.prevremarkupcallback( e2 );
      if (!_i.currenttextmap)
        _i.currenttextmap = _i.patterns.buildmatchesmap( text );
      var fullmap = _i.patterns.buildrangesmap( text, _i.currenttextmap );
      return _i.patterns.markupmap( text, fullmap );
    }
  }
}

/*
 *  Multiple selections attachment for a TextEditor
 *
 *  To set up:
 *    selections = new UI.stylotroneditor.Selections();
 *    selections.init( texteditor, texteditorstyler, profiles = {default} );
 *
 *  To select/deselect a range:
 *    selections.selectrange = function( profilename, range, refresh )
 *    selections.clrrange = function( profilename, refresh )
 *
 *  To insert text and select it with a profile:
 *    selections.inserttext( text, e2={action:"insertFromCustomInsert"}, range, profilename )
 *
 *  Profiles:
 *    cls: range is marked up with this class when selected
 *    trackselection: when set, selected range will mirror browser's (native) selection
 *    removewhen:
 *      focused:        selection removed when editor focused
 *      blurred:        - when editor blurred
 *      caretmoved:     - when caret is moved
 *      textchanged:    - when text changes
 *
 *  Default profile marks up browser's selection with class 'texteditor-selected' when not focused:
 *    'selection-notfocused': {cls:'texteditor-selected', trackselection:true, removewhen:{focused:true}}
 */
UI.stylotroneditor.Selections = function() {
  this.init = function( texteditor, texteditorstyler, profiles=
           {'selection-notfocused': {cls:'texteditor-selected', trackselection:true, removewhen:{focused:true}}} ) {
    _i.texteditor = texteditor;
    _i.editorstyler = texteditorstyler;
    _i.profiles = profiles;
    _i.prevchangecallback = texteditor.setcallback( 'statechanged', _i.oneditorstatechange );
  }
  this.profiles = function() {return _i.profiles};
  this.selectrange = function( profilename, range, refresh ) {
    const needsrefresh = _i.sel( profilename, range );
    if (refresh && needsrefresh)
      _i.texteditor.refresh();
    return needsrefresh;
  }
  this.clrrange = function( profilename, refresh ) {
    const needsrefresh = _i.clr( profilename );
    if (refresh && needsrefresh)
      _i.texteditor.refresh();
    return needsrefresh;
  }
  /* insert text into range (default selected range) and mark it with a profile */
  this.inserttext = function( text, e2={action:"insertFromCustomInsert"}, range, profilename ) {
    e2.insertedprofilename = profilename;
    return _i.texteditor.insert( text, e2, range, false );
  }
  // internals
  var _i = {
    texteditor: null, profiles: {},
    oneditorstatechange: function( e2 ) {
      var refresh = _i.prevchangecallback( e2 );
      if (_i.testall( e2 ))
        refresh = true;
      return refresh;
    },
    sel: function( profilename, r ) {
      if (!r || r.start == r.end)
        return _i.clr( profilename );
      _i.profiles[profilename].range = r;
      var m = _i.editorstyler.patterns().get( _i.profiles[profilename].cls );
      if (!m || m.range.start != r.start || m.range.end != r.end) {
        _i.editorstyler.patterns().addrange( r, _i.profiles[profilename].cls );
        return true;
      }
    },
    clr: function( profilename ) {
      _i.profiles[profilename].range = null;
      var m = _i.editorstyler.patterns().get( _i.profiles[profilename].cls );
      if (m) {
        _i.editorstyler.patterns().del( _i.profiles[profilename].cls );
        return true;
      }
    },
    test: function( profilename, e2 ) {
      var remove = false;
      const profile = _i.profiles[profilename];
      const removewhen = profile.removewhen ? profile.removewhen : {};
      if (removewhen.focused && e2.focused)
        remove = true;
      if (removewhen.blurred && !e2.focused)
        remove = true;
      if (removewhen.textchanged)
        if (!e2.insertedprofilename || e2.insertedprofilename != profilename)
          if (e2.textchanged)
            remove = true;
      if (removewhen.caretmoved)
        if (SOT.text.startswith( e2.action, 'selchange' ))
          remove = true;
      var refresh;
      if (remove) {
        if (_i.clr( profilename ))
          refresh = true;
      }
      else {
        if (profile.trackselection)
          profile.range = e2.selrange;
        else
          if (e2.insertedprofilename && e2.insertedprofilename == profilename && e2.insertedrange)
            profile.range = e2.insertedrange;
        if (_i.sel( profilename, profile.range ))
          refresh = true;
      }
      return refresh;
    },
    testall: function( e2 ) {
      var refresh = false;
      for( const profilename in _i.profiles )
        if (_i.test( profilename, e2 ))
          refresh = true;
      return refresh;
    }
  }
}

/*
 *  Search/replace attachment for a TextEditor
 *
 *  To set up:
 *    search = new UI.stylotroneditor.Search();
 *    search.init( texteditor, texteditorstyler, ids=UI.search.defaultids, classes=UI.search.defaultclasses );
 *
 *  The controls in 'ids' trigger the search/replace functions 
 *
 *  CSS class classes.match is applied to text matching search results
 *  classes.current is applied to current match
 *  classes.replaced is applied to replacement text
 *
 *  Current match is determined by position of the caret
 *    (navigation repositions the caret which in turn repositions the current match)
 */
UI.stylotroneditor.search = {
  defaultopts: {
    ids: {
      find:           'search-find',        //input
      findbtn:        'search-findbtn',
      nextbtn:        'search-nextbtn',
      scrolltobtn:    'search-scrolltobtn',
      prevbtn:        'search-prevbtn',
      clearbtn:       'search-clearbtn',
      replace:        'search-replace',     //input
      replacebtn:     'search-replacebtn',
      replaceallbtn:  'search-replaceallbtn'
    },
    classes: {
      match:          'search-match',
      current:        'search-current',
      currentflash:   'search-currentflash',
      currentblink:   'search-currentblink',
      replaced:       'search-replaced'
    },
    miscopts: {
      currentblinkduration: 1100,
      replaceanimationdelay: 350
    },
    lockctls: true
  }
};
UI.stylotroneditor.Search = function() {
  this.init = function( texteditor, texteditorstyler, opts = UI.stylotroneditor.search.defaultopts ) {
    _i.texteditor = texteditor;
    _i.editorstyler = texteditorstyler;
    _i.prevbeforetextchangecallback = texteditor.setcallback( 'beforetextchange', _i.oneditorbeforetextchange );
    _i.prevchangecallback = texteditor.setcallback( 'statechanged', _i.oneditorstatechange );
    _i.ids = opts.ids ? opts.ids : UI.stylotroneditor.search.defaultopts.ids;
    _i.classes = opts.classes ? opts.classes : UI.stylotroneditor.search.defaultopts.classes;
    _i.miscopts = opts.miscopts ? opts.miscopts : UI.stylotroneditor.search.defaultopts.miscopts;
    _i.searchsets[0].classes = {match: _i.classes.match};
    this.lockctls( opts.lockctls == undefined ? UI.stylotroneditor.search.defaultopts.lockctls : opts.lockctls );
  }
  this.lockctls = function( lock=true ) {
    _i.ctlslocked = lock;
    if (lock) {
      UI.h.listen( _i.ids.findbtn, "click", _i.find );
      UI.h.listen( _i.ids.nextbtn, "click", _i.next );
      UI.h.listen( _i.ids.scrolltobtn, "click", _i.viewcurrent );
      UI.h.listen( _i.ids.prevbtn, "click", _i.prev );
      UI.h.listen( _i.ids.clearbtn, "click", _i.clear );
      UI.h.listen( _i.ids.replacebtn, "click", _i.replace );
      UI.h.listen( _i.ids.replaceallbtn, "click", _i.replaceall );
      UI.h.seteditproperties( _i.ids.find, true );
      UI.h.seteditproperties( _i.ids.replace, true );
      UI.h.listen( _i.ids.find, "input", _i.clear );
      _i.resetctls();
    }
    else {
      UI.h.ignore( _i.ids.findbtn, "click", _i.find );
      UI.h.ignore( _i.ids.nextbtn, "click", _i.next );
      UI.h.ignore( _i.ids.scrolltobtn, "click", _i.viewcurrent );
      UI.h.ignore( _i.ids.prevbtn, "click", _i.prev );
      UI.h.ignore( _i.ids.clearbtn, "click", _i.clear );
      UI.h.ignore( _i.ids.replacebtn, "click", _i.replace );
      UI.h.ignore( _i.ids.replaceallbtn, "click", _i.replaceall );
      UI.h.ignore( _i.ids.find, "input", _i.clear );
    }
  }
  this.clear = function( keepmatches, refresh ) {
    _i.clear( null, keepmatches, refresh );
  }
  this.activate = function( active ) {
    _i.activate( active );
  }
  this.find = function( verbose=true ) {
    _i.find( verbose );
  }
  this.next = function( dir=1, verbose=true ) {
    _i.next( dir, verbose );
  }
  this.scrollcurrentintoview = function( opts ) {
    _i.scrollcurrentintoview( opts );
  }
  this.scrollreplacedintoview = function( opts ) {
    _i.scrollreplacedintoview( opts );
  }
  this.replace = function() {
    return _i.replace();
  }
  this.replaceall = function() {
    return _i.replaceall();
  }
  this.quickreplaceall_DONOTUSE = function() {
    if (!_i.searchset().found)
      alert( "No matches" );
    else {
      var map = _i.textmap();
      if (!map.length)
        alert( "No matches" );
      else {
        var text = _i.texteditor.get();
        var replacewiths = {};
        replacewiths[_i.classes.match] = UI.h.get( _i.ids.replace );
        text = SOT.text.map.replaceall( text, map, replacewiths );
        _i.texteditor.put( text, {action:'insertFromReplaceAll'} );
      }
    }
  }
  // internals
  var _i = {
    texteditor: null, active:0, searchsets: [{found:"", regex:null, mapindex:-1}],
    searchset: function() {return _i.active >= 0 ? _i.searchsets[_i.active] : null;},
    action: function( e, t ) {
      return e && e.action && e.action.substring( 0, t.length ) == t;
    },
    oneditorbeforetextchange: function( e2 ) {
      const ret = _i.prevbeforetextchangecallback( e2 );
      _i.searchset().currenttextmap = null;
      return ret;
    },
    /* reposition the current match when caret moves/text changes */
    oneditorstatechange: function( e2 ) {
      function reposcurrent() {
        var redraw = false;
        var map = _i.textmap();
        const pro = _i.searchset();
        var i = SOT.text.map.range.nearest( e2.selrange.start, map );
        if (i != pro.mapindex || e2.textchanged || _i.action(e2,'insertFromReplace')) {
          if (!_i.action( e2, 'insertFromReplace' ))
            if (_i.editorstyler.patterns().get( _i.classes.replaced ))
              _i.editorstyler.patterns().del( _i.classes.replaced ), redraw = true;
          pro.mapindex = i;
          if (pro.mapindex >= 0)
            _i.editorstyler.patterns().addrange( map[pro.mapindex].range, _i.classes.current ), redraw = true;
          else
            if (_i.editorstyler.patterns().get( _i.classes.current ))
              _i.editorstyler.patterns().del( _i.classes.current ), redraw = true;
        }
        return redraw;
      }
      var refresh = _i.prevchangecallback( e2 );
      if (_i.searchset().awake)
        if (e2.textchanged) {
          _i.resetctls();
          reposcurrent();
          refresh = true;
        }
        else
          if (_i.action( e2, 'selchange' ) && e2.selrange.start == e2.selrange.end && 
              (e2.selrange.start != e2.prevselrange.start || 
               e2.selrange.end != e2.prevselrange.end ||
               _i.action( e2, 'selchangeFromFind') ||
               _i.action( e2, 'selchangeFromActivate'))) {
            if (reposcurrent())
              refresh = true;
          }
      return refresh;
    },
    /* build a text map of current search set */
    newmap: function( text ) {
      const patterns = new SOT.PatternSeries();
      if (_i.searchset().regex)
        patterns.addregex( _i.searchset().regex, _i.searchset().classes.match );
      return patterns.buildmatchesmap( text ? text : _i.texteditor.get() );
    },
    /* get map of regex matches in search set */
    textmap: function( regen ) {
      var map;
      if (_i.searchsets.length) {
        if (regen || !_i.searchset().currenttextmap)
          _i.searchset().currenttextmap = _i.newmap();
        if (regen)
          _i.editorstyler.textmap( regen );
        map = _i.searchset().currenttextmap;
      }
      else
        map = _i.editorstyler.textmap( regen );
      return map;
    },
    resetctls: function() {
      const canfind = UI.h.get( _i.ids.find );
      const matches = _i.textmap().length;
      const canmove = canfind && _i.textmap().length != 1;
      if (_i.ctlslocked) {
        UI.h.enable( _i.ids.findbtn, canfind );
        UI.h.enable( _i.ids.nextbtn, canmove );
        UI.h.enable( _i.ids.scrolltobtn, matches );
        UI.h.enable( _i.ids.prevbtn, canmove );
        UI.h.enable( _i.ids.clearbtn, matches );
        UI.h.enable( _i.ids.replacebtn, matches );
        UI.h.enable( _i.ids.replaceallbtn, _i.textmap().length > 1 );
      }
    },
    clear: function( e, keepmatches, refresh=true ) {
      const pro = _i.searchset();
      if (!pro)
        return;
      pro.awake = 0;
      pro.mapindex = -1;
      if (!keepmatches) {
        _i.editorstyler.patterns().del( pro.classes.match );
        pro.found = "", pro.regex = null;
      }
      _i.editorstyler.patterns().del( _i.classes.current );
      _i.editorstyler.patterns().del( _i.classes.replaced );
      _i.textmap( true );
      if (refresh)
        _i.texteditor.refresh();
      _i.resetctls();
    },
    activate: function( searchsetindex=0 ) {
      _i.active = searchsetindex;
      _i.searchset().awake = 1;
      _i.texteditor.setcaretpos( -1, {action:'selchangeFromActivate'} );
      //_i.scrollcurrentintoview();
      _i.resetctls();
    },
    find: function( verbose=true, dir=1 ) {
      try {
        _i.searchset().found = UI.h.get( _i.ids.find );
        _i.searchset().regex = SOT.text.regexstr2regex( _i.searchset().found, 'g' );
        _i.searchset().awake = 1;
        _i.searchset().mapindex = -1;
        _i.editorstyler.patterns().del( _i.classes.current );
        _i.editorstyler.patterns().del( _i.classes.replaced );
        _i.editorstyler.patterns().addregex( _i.searchset().regex, _i.searchset().classes.match );
        _i.textmap( true );
        _i.resetctls();
        _i.movecurrent( dir, verbose, {action:'selchangeFromFind'} );
      }
      catch( e ) {
        _i.clear();
        if (verbose)
          alert( e ); //"Invalid regular expression" );
      }
    },
    scrollmarkintoview: function( cls, opts ) {
      const els = _i.texteditor.el().getElementsByClassName( cls );
      if (els && els.length) {
        /*if (opts.blink)
          opts.blink.targets = els;*/
        _i.texteditor.scrollelemsintoview( els, opts );
      }
    },
    scrollcurrentintoview: function( opts ) {
      _i.scrollmarkintoview( _i.classes.current, 
              {blink: {class:_i.classes.currentflash, duration:_i.miscopts.currentblinkduration}} );
    },
    viewcurrent: function( e ) {
      _i.scrollmarkintoview( _i.classes.current, 
              {blink: {class:_i.classes.currentblink, duration:_i.miscopts.currentblinkduration}} );
    },
    scrollreplacedintoview: function( opts ) {
      _i.scrollmarkintoview( _i.classes.replaced, opts );
    },
    movecurrent: function( dir=1, verbose=true, e2={action:'selchangeFromNav'} ) {
      if (!_i.searchset().found)
        return _i.find( true, dir );
      _i.editorstyler.patterns().del( _i.classes.current );
      _i.editorstyler.patterns().del( _i.classes.replaced );
      var pos = -1, map = _i.textmap();
      /* find start position of next/prev */
      if (map.length) {
        var i = _i.searchset().mapindex + dir;
        i = i < 0 ? map.length-1 : (i >= map.length ? 0 : i);
        pos = map[i].range.start;
      }
      else {
        if (verbose)
          alert( "No matches" );
      }
      /* reposition the caret (will cause current match to update) */
      _i.texteditor.setcaretpos( pos, e2 );
      /* at this point, current match is updated so make sure it's in view */
      _i.scrollcurrentintoview();
    },
    next: function( e ) {
      _i.movecurrent( 1 );
      if (e)
        e.preventDefault();
    },
    prev: function( e ) {
      _i.movecurrent( -1 );
      if (e)
        e.preventDefault();
    },
    _replace: function( group ) {
      if (group)
        group.more = false;
      if (!_i.searchset().found || _i.searchset().mapindex < 0)
        alert( "No matches" );
      else {
        var map = _i.textmap();
        if (!map.length)
          alert( "No matches" );
        else {
          var text = _i.texteditor.get();
          var len = text.length;
          var i = _i.searchset().mapindex;
          var r = map[i].range;
          var e2 = {action:'insertFromReplace'};
          if (group) {
            group.more = i < map.length - 1;
            e2.group = group;
          }
          text = SOT.text.map.replace( text, map, _i.searchset().mapindex, UI.h.get(_i.ids.replace) );
          /* calculate replaced text range */
          r = {start:r.start, end:r.end + (text.length - len)};
          /* ready caret to be repositioned to the next match if any */
          /*   (replacement can change the match count, so that is taken into account) */
          var newpos = r.end;
          var newmap = _i.newmap( text );
          if (newmap.length) {
            i += newmap.length - map.length;
            i = i >= newmap.length-1 ? 0 : i+1;
            newpos = newmap[i].range.start;
          }
          _i.searchset().mapindex = -1;
          _i.editorstyler.patterns().addrange( r, _i.classes.replaced );
          /* put the new text (will reposition the caret, causing current match to update) */
          _i.texteditor.put( text, e2, {start:newpos, end:newpos} );
          /* at this point, replacement is styled, make sure it's in view */
          _i.scrollreplacedintoview( {smooth:!group} );
        }
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
        if (group && group.more)
          setTimeout( repl1, _i.miscopts.replaceanimationdelay );
      }
      var group = {start:true};
      repl1();
    }
  }
}

