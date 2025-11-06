/*
 * stylotron.js
 *
 *   SOT.text.map:        low level text parser, builds segmented range maps from a series of overlapping regex matches
 *   SOT.PatternSeries:   abstraction of a pattern series, produces SOT.text.maps and layered html
 *
 *   single step markup:  html = SOT.markup( text, patterndefs )
 *
 * stylotron-demo.html provides tutorial and example of use
 *
 * cc0 (public domain) v.010 September 2025, latest version @ github.com/gregsidal
 */

const SOT = {};

/*
 *  html = SOT.markup( text, patterndefs )
 *    marks up matches of of a pattern series, returns html
 *
 *    patterndefs = {def...}
 *      each def is one of these:
 *        'class': regex or string
 *          matches of each regex (or string) are styled with 'class'
 *        'class': {'regex': .., ..opts..}
 *        'class': {'range': {'start': .., 'end': ..}, ..opts..}
 *      opts can include:
 *        htmltag: ..
 *        htmlattrs: {...}
 *
 *  strings can be full regex's like "/.+/g" (a string without slashes in the right places is a literal)
 *  regex's must include 'g' flag or pattern is ignored ('g' is added to regex strings if needed)
 *
 *  matches that overlap/cover others are segmented and marked up in layers, see SOT.map.markup comments
 *  ranges are overlaid (applied last) by default, use opts={overlayranges:false} to apply ranges in order
 *    (the logic for the default is that ranges are usually types of selections, which are typically overlaid)
 *
 *  'htmlattrs' are added to starting tag: htmltag='a', htmlattrs={href:'A',target='B'} produces "<a href='A' target='B'>"
 *    attr strings can include '$_&' replacement wildcard, where $_& == matched text
 *    attr can also be a regex, in which case attr is whatever the regex extracts from matched text
 */
SOT.markup = function( text, defs, opts, callback ) {
  const patterns = new SOT.PatternSeries();
  patterns.add( defs );
  if (callback)
    patterns.setmarkupcallback( callback );
  return patterns.markup( text, undefined, opts );
}

/*
 *  SOT.PatternSeries
 *    registers regex's and ranges with associated CSS classes; produces SOT.text.maps and layered markup
 *
 *    patterns = new SOT.PatternSeries()
 *
 *    patterns.addregex( regex, cls )
 *      adds a regex (or string), matches will be styled with with CSS class 'cls'
 *      (strings can be literals or regex's including slashes and flags, ie "/.+/g")
 *    patterns.addrange( range, cls )
 *      adds a range
 *    patterns.add( defs )
 *      adds one or more defs, refer to SOT.map.markup comments
 *
 *    map = patterns.buildmap( text, map=[], overlayranges=true )
 *      builds a SOT.text.map of 'text'
 *        ('map' can be fed to SOT.map.markup to produce the HTML)
 *      ranges are applied last by default, use overlayranges=false to apply ranges in order
 *    HTML = patterns.markup( text )
 *      marks up defs, see SOT.map.markup
 *
 *    prevcallback = patterns.setmarkupcallback( callback )
 *      see SOT.map.markup for callback spec
 *      callback replaces any other previously set
 */
SOT.PatternSeries = function() {
  var defs = {};
  this.requiredregexflags = 'g';
  this.get = function( cls ) {
    return defs[cls];
  }
  this.addregexstr = function( regexstr, cls, reqflags=this.requiredregexflags, defin, alertiferror ) {
    var regex;
    try {
      //regex = new RegExp( regexstr, flags );
      regex = SOT.text.regexstr2regex( regexstr, reqflags );
    }
    catch( e ) {
      if (alertiferror)
        alert( e );
      return null;
    }
    if (defin)
      defs[cls] = defin;
    else
      defs[cls] = {};
    defs[cls].regexstr = regexstr, defs[cls].regex = regex;
    return regex;
  }
  this.addregex = function( regex, cls, reqflags ) {
    if (regex)
      if (typeof regex == 'string')
        this.addregexstr( regex, cls, reqflags );
      else
        defs[cls] = {'regex':regex};
  }
  this.addrange = function( range, cls ) {
    if (!defs[cls] || defs[cls].range.start != range.start || defs[cls].range.end != range.end) {
      defs[cls] = {'range': range};
      return true;
    }
  }
  this.add = function( defsin ) {
    for( var cls in defsin )
      if (defsin[cls])
        if (typeof defsin[cls] == 'string' || defsin[cls] instanceof RegExp)
          this.addregex( defsin[cls], cls );
        else
          if (defsin[cls].regex && typeof defsin[cls].regex == 'string')
            this.addregexstr( defsin[cls].regex, cls, this.requiredregexflags, defsin[cls] );
          else
            defs[cls] = defsin[cls];
  }
  this.del = function( cls ) {
    if (defs[cls]) {
      delete defs[cls];
      return true;
    }
  }
  this.delregexs = function() {
    var m = {};
    for( var cls in defs )
      if (!defs[cls].regex)
        m[cls] = defs[cls];
    defs = m;
  }
  this.delranges = function() {
    var m = {};
    for( var cls in defs )
      if (!defs[cls].range)
        m[cls] = defs[cls];
    defs = m;
  }
  this.clear = function() {
    defs = {};
  }
  this.buildmatchesmap = function( text, map=[] ) {
    for( var cls in defs  )
      if (defs[cls].regex)
        map = SOT.text.map.addmatches( text, defs[cls].regex, cls, true, map );
    return map;
  }
  this.buildrangesmap = function( text, map=[] ) {
    for( var cls in defs )
      if (defs[cls].range)
        map = SOT.text.map.addrange( text, defs[cls].range, cls, true, map );
    return map;
  }
  this.buildmap = function( text, map=[], overlayranges=true ) {
    if (overlayranges) {
      map = this.buildmatchesmap( text, map );
      map = this.buildrangesmap( text, map );
    }
    else {
      for( var cls in defs )
        if (defs[cls].regex)
          map = SOT.text.map.addmatches( text, defs[cls].regex, cls, true, map );
        else
          if (defs[cls].range)
            map = SOT.text.map.addrange( text, defs[cls].range, cls, true, map );
    }
    return map;
  }
  var markupcallback;
  this.setmarkupcallback = function( callback ) {
    var prev = markupcallback ? markupcallback : function(attrs){return attrs;};
    markupcallback = callback;
    return prev;
  }
  this.markupmap = function( text, map, opts ) {
    return SOT.map.markup( text, map, opts, defs, markupcallback );
  }
  this.markup = function( text, map=[], opts={overlayranges:true} ) {
    return SOT.map.markup( text, this.buildmap(text,map,opts.overlayranges), opts, defs, markupcallback );
  }
}

/*
 *  HTML = SOT.map.markup( text, map, opts, callback )
 *    generates layered html from a SOT.text.map
 *    (a SOT.PatternSeries object can be used to set regex/class associations and create the map)
 *
 *  The set names in the map (see SOT.text.map) are the CSS class names used in the mark up
 *
 *  Segments (intersections of overlapping ranges, see SOT.text.map) are marked up in layers
 *
 *  A segment's CSS class list indicates what part of the original range the segment was synthesized from:
 *    a leftmost segment includes "L" and a rightmost segment includes "R"
 *    a middle segment includes neither "L" nor "R"
 *    an unsegmented range includes both "L" and "R"
 *
 *  Examples:
 *
 *    a range of 'cls1' covers another of 'cls0', will be marked up as follows:
 *
 *      <mark class="cls0 L R">
 *        Some
 *        <mark class="cls1 L R">text</mark>
 *        is here
 *      </mark>
 *
 *    the order the patterns are applied is important, if 'cls1' is background:
 *
 *      <mark class="cls0 L">Some </mark>
 *      <mark class="cls1 L R">
 *        <mark class="cls0">text</mark>
 *      </mark>
 *      <mark class="cls0 R"> is here</mark>
 *
 *  'opts': {'htmltag': ..}
 *    if provided, 'htmltag' will be used instead of "mark" globally
 *      (tags can also be specified per-class in 'defs', see SOT.markup comments)
 *
 *  'callback': attrs = function( params )
 *    optional, will be fired on each tag, params:
 *      'attrs': passed in will be {'class': .., ...}, example: {'class': "cls1 L  "}
 *      'class': the class name
 *      'map': the text map
 *      'mapindex': index in 'map' array
 *      'layerindex': index in 'origs' subarray (see SOT.text.map)
 *      'opts': passed in opts
 *    callback can modify and/or add to 'attrs'
 */
SOT.map = {
  markup: function( fulltext, map, opts, defs, callback ) {
    function _tag( layer, end ) {
      var tag = 'mark';
      if (opts && opts.htmltag)
        tag = opts.htmltag;
      if (defs)
        if (end && defs[layer.setname].htmltagend != undefined)
          tag = defs[layer.setname].htmltagend;
        else
          if (defs[layer.setname].htmltag)
            tag = defs[layer.setname].htmltag;
      return tag;
    }
    function _addattrs( attrs, addattrs, origrange ) {
      for( const a in addattrs )
        if (addattrs[a] instanceof RegExp)
          attrs[a] = SOT.text.extract( fulltext.slice(origrange.start,origrange.end), addattrs[a] );
        else
          if (typeof addattrs[a] == 'string')
            attrs[a] = addattrs[a].replace( "$_&", fulltext.slice(origrange.start,origrange.end) );
      return attrs;
    }
    function _istagdif( seg, compareseg, layerindex ) {
      return (!compareseg || layerindex >= compareseg.origs.length || 
              seg.origs[layerindex].setname != compareseg.origs[layerindex].setname ||
              seg.origs[layerindex].range.setindex != compareseg.origs[layerindex].range.setindex);
    }
    function _difdepth( seg, compareseg ) {
      for( var depth=0; depth<seg.origs.length; depth++ )
        if (_istagdif( seg, compareseg, depth ))
          break;
      return depth;
    }
    /*
     * 
     */
    function _tagstart( seg, layer, mapindex, j, pieceindex, offset, insidetext ) {
      var tag = _tag(layer), t = "";
      /* build class attribute */
      var attrs = {'class': layer.setname};
      if (layer.range.start == seg.start)
        attrs['class'] += " L";
      if (defs && defs[layer.setname].htmlattrs)
        attrs = _addattrs( attrs, defs[layer.setname].htmlattrs, layer.range );
      /* get dynamic attributes if any */
      if (callback)
        attrs = callback( {'attrs':attrs,
                           class:layer.setname,
                           'map':map,
                           'mapindex':mapindex,
                           layerindex:j, 
                           'opts':opts} );
      /* markup html tag with attrs */
      t += "<" + tag;
      for( var a in attrs ) {
        t += " " + a + (attrs[a] ? ('="' + attrs[a]) : '');
        if (a == 'class') {
          t += "  ";
          starts[layer.setname] = {pos: offset+t.length-1, 'pieceindex': pieceindex, 'j': j, 'seg': seg};
        }
        t += attrs[a] ? '"' : '';
      }
      return t + ">";
    }
    function _layersstart( prevseg, seg, mapindex, pieceindex, insidetext ) {
      var j =_difdepth( seg, prevseg );
      for( var tags=""; j<seg.origs.length; j++ )
        tags += _tagstart( seg.range, seg.origs[j], mapindex, j, pieceindex, tags.length, insidetext );
      return {'tags':tags, 'insidetext':insidetext};
    }
    /*
     * 
     */
    function _tagend( layer ) {
      const tag = _tag( layer, true );
      if (!tag)
        return "";
      return "</" + SOT.text.extractto(tag, /^[A-Za-z0-9-_]+/) + ">";
    }
    function _layersend( seg, nextseg ) {
      var j =_difdepth( seg, nextseg );
      for( var t="",k=seg.origs.length-1; k>=j; k-- )
        t += _tagend( seg.origs[k] );
      return {tags:t};
    }
    function _setlayerright( seg ) {
      var piece = "";
      for( const layer of seg.origs ) {
        if (starts[layer.setname] && layer.range.end == seg.range.end) {
          /* (insert 'R' in class list) */
          piece = html[starts[layer.setname].pieceindex];
          piece = piece.slice( 0, starts[layer.setname].pos ) +
                  "R" +
                  piece.slice( starts[layer.setname].pos+1 );
          html[starts[layer.setname].pieceindex] = piece;
          delete starts[layer.setname];
        }
      }
    }
    const html = [];
    function htmladd( piece ) {
      if (piece)
        html.push( piece );
    }
    function htmlstring() {
      var hs = "";
      for( const piece of html )
        hs += piece;
      return hs;
    }
    var text = "", start = {}, end = {}, starts = {};
    var prevseg, seg, nextseg;
    for( var i=0,n=0; i<map.length; prevseg=seg,i++ ) {
      seg = map[i];
      htmladd( SOT.text.raw2HTML(fulltext.slice(n, seg.range.start)) );
      nextseg = i < map.length-1 ? map[i+1] : null;
      start = _layersstart( prevseg, seg, i, text ? html.length+1 : html.length, 
                            SOT.text.raw2HTML(fulltext.slice(seg.range.start,seg.range.end)) );
      if (start.tags) {
        htmladd( text ), text = "";
        htmladd( start.tags );
        htmladd( start.insidetext );
      }
      else
        text += start.insidetext;
      end = _layersend( seg, nextseg );
      if (end.tags) {
        if (text)
          htmladd( text + end.tags ), text = "";
        else
          htmladd( end.tags );
        _setlayerright( seg );
      }
      n = seg.range.end;
    }
    return htmlstring() + SOT.text.raw2HTML( fulltext.slice(n) );
  }
}

/*
 *  Text helpers
 */
SOT.text = {
  str2regex: function( regexstr, flags='' ) {
    regexstr = regexstr.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
    return new RegExp( regexstr, flags );
  },
  parseregexstr: function( str, reqflags='' ) {
    const regexparts = {pattern: SOT.text.extract( str, /(?<=^\/).+(?=\/\w*$)/ )};
    if (regexparts.pattern) {
      regexparts.flags = SOT.text.extract( str, /(?<=^\/.+\/)\w*$/ );
      if (!regexparts.flags)
        regexparts.flags = reqflags;
      else
        if (!SOT.text.extract( regexparts.flags, SOT.text.str2regex(reqflags) ))
          regexparts.flags += reqflags;
    }
    return regexparts;
  },
  regexstr2regex: function( str, reqflags='' ) {
    const regexparts = SOT.text.parseregexstr( str, reqflags );
    var regex;
    if (regexparts.pattern)
      regex = new RegExp( regexparts.pattern, regexparts.flags );
    else
      regex = SOT.text.str2regex( str, reqflags );
    return regex;
  },
  raw2HTML: function( text ) {
    var newtext = text.replace( /&/g, "&amp;" );
    newtext = newtext.replace( />/g, "&gt;" );
    return newtext.replace( /</g, "&lt;" );
  },
  startswith: function( s, sub ) {
    return s && sub && s.substring( 0, sub.length ) == sub;
  },
  extract: function( s, substr ) {
    const x = s.match( substr );
    if (x && x[0] !== null)
      return x[0];
    return null;
  },
  extractto: function( s, sub ) {
    s = s.match( sub );
    return s[0];
  },
  /* replace range */
  paste: function( text, range, replacewith ) {
    var newtext = text.slice( 0, range.start );
    var token = text.substring( range.start, range.end );
    //newtext += token.replace( SOT.text.str2regex(token,''), replacewith );
    newtext += token.replace( token, replacewith );
    newtext += text.slice( range.end );
    return newtext;
  }
}

/*
 *  SOT.text.map
 *    builds segmented range maps from series of regex matches
 *
 *    map = SOT.text.map.addmatches( text, regex, setname, segment?, map=[] )
 *      adds set of ranges matching regex to map
 *
 *    map = SOT.text.map.addrange( text, range, setname, segment?, map=[] )
 *      adds a range to map
 *
 *  Maps are ordered arrays, each element has the form {range:{start:., end:.}, origs:[...]}
 *
 *  Maps are flat, 'segment?' determines how ranges that overlap or cover others are treated when being added:
 *    !: range being added will overwrite any it overlaps or covers (usurped ranges are discarded)
 *    else: overlapping or covered ranges are segmented
 *
 *  The 'origs' array specifies what range(s) a segment was synthesized from:
 *    each element of 'origs' has the form: {setname:"..", range:{start:.,end:.}}
 *      example: intersection segment resulting from a range of "set0" overlapping one of "set1": 
 *               origs = [{setname:"set0", range:..}, {name:"set1", range:..}]
 *    for unsegmented ranges, origs = [{setname:<samename>, range:<samerange>}
 *
 *  Replace operations:
 *
 *    text = SOT.text.map.replace( text, map, i, newtext )
 *      replaces range i in text with newtext
 *
 *    text = SOT.text.map.replaceall( text, map, i, replacewiths )
 *      replaces all ranges, replacewiths = {setname:"new text", ...}
 *      segment's setname determines the replacement text to use (replacewiths[segment.origs[0].setname])
 *
 *   Segmented ranges are ignored during replacements (replace ops on segments are nonsensical)
 */
SOT.text.map = {
  range: {
    neworigs: function( setname, range={start:0,end:0,setindex:0} ) {
      if (typeof setname == 'string')
        return [{'setname':setname, 'range':{start:range.start,end:range.end,'setindex':range.setindex}}];
      return set;
    },
    mk: function( start, end, origs ) {
      return {range:{'start':start, 'end':end}, 'origs':origs};
    },
    copy: function( r ) {
      return {range:{start:r.start, end:r.end}, origs:r.origs};
    },
    isposin: function( pos, map, i ) {
      return (i >= 0 && i < map.length && pos >= map[i].range.start && pos <= map[i].range.end);
    },
    next: function( pos, map ) {
      var i = -1, test = 0;
      if (map.length) {
        if (map[0].range.end > pos)
          i = 0;
        else {
          i = map.length - 1;
          if (pos < map[i].range.start) {
            var j = map.length/2;
            for( i=j;
                 Math.round(j);
                 j/=2, map[Math.round(i)].range.end<=pos ? i+=j : i-=j, test++ ) //(bin search)
              ;
            i = Math.round( i );
          }
        }
        //console.log( "BINSEARCH 0: " + test );
        for( ; i < map.length && map[i].range.end <= pos; i++, test++ )
          ;
        //console.log( "BINSEARCH 1: " + test );
      }
      return i;
    },
    before: function( pos, map ) {
      var i = SOT.text.map.range.next( pos, map );
      if (i >= 0 && SOT.text.map.range.isposin( pos, map, i ))
        i++;
      return i >= 0 ? Math.max(0,i-1) : i;
    },
    after: function( pos, map ) {
      var i = SOT.text.map.range.next( pos, map );
      if (SOT.text.map.range.isposin( pos, map, i ))
        i++;
      return i;
    },
    nearest: function( pos, map ) {
      var i = SOT.text.map.range.next( pos, map );
      i = Math.min( i, map.length-1 );
      if (i > 0 && !SOT.text.map.range.isposin( pos, map, i )) {
        if (pos < ((map[i].range.start - map[i-1].range.end) / 2) + map[i-1].range.end)
          i--;
      }
      return i;
    },
    atpos: function( pos, map ) {
      var i = SOT.text.map.range.next( pos, map );
      if (!SOT.text.map.range.isposin( pos, map, i ))
        i = -1;
     return i;
    }
  },
  /*
   * segmentation loop illustration (_segment):
   *
   *    is0----ie0  is1--ie1        is2----ie2   target sequence, first ie > ms
   *        ms--------------------------me       input (range to add)
   * *
   *    continues while isN < me
   *
   *    is0----ie0
   *        ms--------------------------me
   *    is0-ms-ie0                               segments = [mins,maxs,mine]
   *           ie0----------------------me       next input = [mine,maxe]
   *
   *                is1--ie1
   *           ms-----------------------me
   *           ms---is1--ie1                     segments = [mins,maxs,mine]
   *                     ie1------------me       next input = [mine,maxe]
   *
   *                                is2----ie2
   *                     ms-------------me
   *                     ms---------is2-me       segments = [mins,maxs,mine]
   *                                    me-ie2   next input = [mine,maxe]
   *
   *                                    ms--me   last (dangling) segment
   */
  _seg2: function( m, i, p ) {
    var r = {start:Math.min(m.range.start, i.range.start), end:Math.max(m.range.start, i.range.start)};
    if (r.start < r.end)
      p.newmap.push( SOT.text.map.range.mk(r.start,r.end,r.start<i.range.start?m.origs:i.origs) );
    r = {start:Math.max(m.range.start, i.range.start), end:Math.min(m.range.end, i.range.end)};
    p.newmap.push( SOT.text.map.range.mk(r.start,r.end,[...i.origs,...m.origs]) );
    r = {start:Math.min(m.range.end, i.range.end), end:Math.max(m.range.end, i.range.end)};
    return SOT.text.map.range.mk( r.start, r.end, r.start<m.range.end?m.origs:i.origs );
  },
  _segment: function( start, end, origs, map=[], p ) {
    var m = SOT.text.map.range.mk( start, end, origs );
    if (p.newmap.length && m.range.start < p.newmap[p.newmap.length-1].range.end) {
      /* (edge case: when ranges are added in sequence (regex matches), newmap may contain an iceberg segment) */
      var i = p.newmap.pop();
      m = SOT.text.map._seg2( m, i, p );
    }
    for( ; p.i<map.length && map[p.i].range.start<m.range.end; p.i++ )
      m = SOT.text.map._seg2( m, map[p.i], p );
    if (m.range.start < m.range.end)
      p.newmap.push( m );
    return p;
  },
  /* insert range at current location; discard ranges it overlaps or covers */
  _overwrite: function( start, end, origs, map=[], p ) {
    p.newmap.push( SOT.text.map.range.mk(start,end,origs) );
    for( ; p.i < map.length && map[p.i].range.end <= end; p.i++ )
      ;
    if (p.i < map.length && map[p.i].range.start < end)
      p.i++;
    return p;
  },
  /* insert a range into map; overwrite or segment overlapping/covered ranges */
  _insertrange: function( start, end, set, map, segment, p={newmap:[],i:0,setindex:0} ) {
    for( ; p.i < map.length && map[p.i].range.end <= start; p.i++ )  // add all before entries
      p.newmap.push( map[p.i] );
    var origs = SOT.text.map.range.neworigs( set, {'start':start,'end':end,'setindex':p.setindex} );
    if (segment)
      p = SOT.text.map._segment( start, end, origs, map, p );
    else
      p = SOT.text.map._overwrite( start, end, origs, map, p );
    return p;
  },
  /* add trailing ranges */
  _addendranges: function( map=[], p ) {
    for( ; p.i<map.length; p.i++ )
      p.newmap.push( map[p.i] );
    return p.newmap;
  },
  /* add ranges from regex match to map */
  addmatches: function( text, regex, setname, segment, map=[], alertiferror ) {
    var p = {newmap:[],i:0,setindex:0};
    var matches;
    try {
      matches = text.matchAll( regex );
    }
    catch( e ) {
      if (alertiferror)
        alert( e );
      return map;
    }
    /* (optimization: matches are added in a single pass) */
    for( const match of matches ) {
      p = SOT.text.map._insertrange( match.index, match.index+match[0].length, setname, map, segment, p );
      p.setindex++;
    }
    return SOT.text.map._addendranges( map, p );
  },
  /* add ranges from regex match to map */
  _X_addmatches: function( text, regex, setname, segment, map=[] ) {
    var p = {newmap:[],i:0,setindex:0};
    /* (optimization: matches are added in a single pass) */
    var match;
    while( match = regex.exec(text) )
      if (match[0].length) {
        p = SOT.text.map._insertrange( match.index, match.index+match[0].length, setname, map, segment, p );
        p.setindex++;
      }
      else {
        regex.lastIndex++;
  //console.log( regex );
      }
    return SOT.text.map._addendranges( map, p );
  },
  /* add a range to map */
  addrange: function( text, range, setname, segment, map=[] ) {
    if (range.start > range.end)
      range = {start:range.end, end:range.start};
    var p = SOT.text.map._insertrange( range.start, range.end, setname, map, segment );
    return SOT.text.map._addendranges( map, p );
  },
  /* replace all ranges, replacewiths={setname:"..", ...} */
  replaceall: function( text, map, replacewiths ) {
    if (!map.length)
      return text;
    var newtext = "", token;
    for( var i=0,n=0; i<map.length; i++ ) {
      newtext += text.slice( n, map[i].range.start );
      token = text.substring( map[i].range.start, map[i].range.end );
      if (map[i].origs.length == 1 &&
          map[i].origs[0].range.start == map[i].range.start && map[i].origs[0].range.end == map[i].range.end)
        //newtext += token.replace( SOT.text.str2regex(token,''), replacewiths[map[i].origs[0].setname] );
        newtext += token.replace( token, replacewiths[map[i].origs[0].setname] );
      else
        newtext += token;
      n = map[i].range.end;
    }
    newtext += text.slice( n );
    return newtext;
  },
  /* replace a range */
  replace: function( text, map, i, newtext ) {
    if (i >= map.length)
      return text;
    var replacewiths = {};
    replacewiths[map[i].origs[0].setname] = newtext;
    return SOT.text.map.replaceall( text, [map[i]], replacewiths );
  }
}

