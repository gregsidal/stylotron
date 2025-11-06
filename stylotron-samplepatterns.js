/*
 * Patterns Shared by Stylotron Demos and Project Documents
 * cc0 (public domain) v.010 September 2025
 * Stylotron project @ github.com/gregsidal
 *
 * Pattern series must be in 'UserDocument' namespace to be visible to IDE
 * Functions and other javascript can also be added to UserDocument
 * Patterns without g flag in regex are ignored
 *
 * Patterns that will mark up as images, form controls, etc. must be high enough in the pattern order to 
 * prevent them from being segmented
 *
 * Regexs can be tested and optimized using search in Plaintext view
 *   shape of match's endcaps will reveal whether line feeds at match's beginning or end are captured by regex
 *   the browser may timeout when iterating through the matches of some poorly designed regex's
 */
UserDocument.patternseries = {
  /* 
   * whole document container
   */
  document:                {regex: /(?:.*(\n|$))*/g, htmltag: 'div'},
  /*
   * inner containers
   */
  'block multiline':       /.+(?:\n(?!\n).+)+/g,
  'block singleline':      /(?<=\n\n+|^\n*).+(?=\n\n+|\n*$)/g,
  codeblockcontainer:      {regex: /(?:.*(?:[\{<=\\]|\/\*).*(\n(?!\n).+)+)|(?:(?<=\n\n+) +.+(?=$|\n\n+))/g, htmltag: 'div'},
  'codeblock multiline':   {regex: /.*(?:[\{<=\\]|\/\*).*(\n(?!\n).+)+/g, htmltag: 'div'},
  'codeblock snippet':     {regex: /(?<=\n\n+) +.+(?=$|\n\n+)/g, htmltag: 'div'},
  paragraph:               /(?<=\n\n+|^\n*)([A-Z].+[.?!:][ ]*)+.*(?=(?:\n\n+|\n*$))/g,
  heading:                 /(?<=^\n*|\n\n+)(?:[0-9. -]+)*(?:(?:(?:[A-Z0-9@#$][a-z0-9-'",!?]*)|o[rnf]{0,1}|t[o]{0,1}|th[e]{0,1}|a|an|as|and|by|vs|i[sn]*|f|fo|for) *)+(?=\n\n+)/g,
  footnote:                {regex: /(?<=\n)\d +.+(?=$|\n)/g, 
                            htmlattrs: {id: /\d/g}},
  line:                    /.+/g,
  /*
   * patterns that allow buttons (_#...#_) and inputs (_$...$_) to be inserted inline
   * while editing (the default CSS causes the tags to disappear when .FOLDED;
   * controls in real world apps would usually use specialized patterns)
   */
  button:                  {regex: /(?<=_#).+?(?=#_)/g, htmltag: 'button',
                            htmlattrs: {id: "$_&", onclick: 'UserDocument.buttononclick(this)'}},
  inputcontainer:          {regex: /_\$.+?\$_/g, htmltag: 'label',
                            htmlattrs: {id: /(?<=_\$).+?(?=\$_)/g}},
  input:                   {regex: /(?<=_\$.+?)\$_/g, htmltag: 'input', htmltagend: '',
                            htmlattrs: {type: 'text', onchange: 'UserDocument.inputonchange(this)'}},
  /*
   * image in CSS (uses :before, recommended way to handle images)
   */
  'image sample':          {regex: "sample image", htmltag: 'div'},
  /*
   * links to page (caveat: won't capture file names containing spaces)
   */
  'link page':             {regex: /[-\w]+\.html/g, htmltag: 'a', 
                            htmlattrs: {href: "$_&", target: "_blank"}},
  /*
   * links to lib sources
   */
  'link lib main':         {regex: /lib\/(?:\w|\-)+\.(?:js|css)/g, htmltag: 'a', 
                            htmlattrs: {href: "$_&", target: "_blank", tooltip: "view source"}},
  'link lib':              {regex: /[Ss]tylotron-\w*\.(?:js|css)/g, htmltag: 'a', 
                            htmlattrs: {href: "$_&", target: "_blank", tooltip: "view source"}},
  /*
   * patterns that allow italics (_`...`_), bold (_"..."_) and footnote refs (^num) to be
   * added inline while editing (the default CSS causes the tags to disappear when .FOLDED)
   */
  'tag inline':            /_`|`_|_"|"_|_#|#_|_\$|\$_|_@|@_/g,
  'tag inline footref':    /\^(?=\d)/g,
  italic:                  /(?<=_`).*?(?=`_)/g,
  bold:                    /(?<=_").*?(?="_)/g,
  /*
   * comment atoms
   */
  'comment html':          /(?<=^|\W)\<\!--(?:.|\n)+?--\>/g,
  'comment js':            /(?<=^|\W)\/\*(?:.|\n)+?\*\/|\/\/.*/g,
  /* 
   * regexs
   */
  regex:                   /(?<=\W)\/.+\/[gmis]+(?=[ .,;\n\]\}\)])/g,
  regexslashed:            /(?<=\W)\/.+\/(?=[gmis]+[ .,;\n\]\}\)])/g,
  regexpattern:            /(?<=\W\/).+(?=\/[gmis]+[ .,;\n\]\}\)])/g,
  /*
   * code tags
   */
  'tag js':                /(?<=^|[\{\[\(\s,])[\w-]+(?=:)/g,
  'tag json':              /(?<=^|\W)'[\w- ]+'(?=:)/g,
  'tag html':              /(?<=<\/{0,1})\w+(?=[\s\[>])/g,
  /*
   * quoted
   */
  'quoted single':         /(?<=^|\W)'.*?'(?=\W)/g,
  'quoted double':         /(?<=^|\W)".*?"(?=\W)/g,
  /*
   * number-like atoms
   */
  'number dec':            /(?<=^|[^\w.#])[+|-]{0,1}(?:\d+[.]\d+|\d+)(?=$|[^\w.]|\.[ \n]+|px\W|em\W|rem\W)/g,
  'number hex':            /(?<=#)[A-Fa-f0-9]+(?=$|\W)/g,
  'number htmlentity':     /&(?:[a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/g,
  numberprefix:            /[@#$](?=[A-Fa-f0-9]+(?:$|\W))/g,
  footnoteref:             {regex: /(?<=\^)\d/g, htmltag: 'a', htmlattrs: {href: "#$_&"}},
  /*
   * logo
   */
  logoleft:                "STYLO",
  logoright:               "OTRON",
}
/*
 * sample input event handler
 */
UserDocument.inputonchange = function( inputelem ) {
  if (UserDocument.FOLDED) {
    const id = inputelem.parentNode.id;
    alert( `Contents of '` + id + `' is "` + inputelem.value + `"` );
  }
}
/*
 * sample button event handler
 */
UserDocument.buttononclick = function( buttonelem ) {
  if (UserDocument.FOLDED) {
    const id = buttonelem.id;
    alert( `Button '` + id + `' clicked` );
  }
}

