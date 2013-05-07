/*
 * @name BeautyTips
 * @desc a tooltips/baloon-help plugin for jQuery
 *
 * @author Jeff Robbins - Lullabot - http://www.lullabot.com
 * @version 0.9.5 release candidate 1  (5/20/2009)
 */

jQuery.bt = {version: '0.9.7'};

/*
 * @type jQuery
 * @cat Plugins/bt
 * @requires jQuery v1.2+ (not tested on versions prior to 1.2.6)
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * Encourage development. If you use BeautyTips for anything cool
 * or on a site that people have heard of, please drop me a note.
 * - jeff ^at lullabot > com
 *
 * No guarantees, warranties, or promises of any kind
 *
 */

(function($) {
  /**
   * @credit Inspired by Karl Swedberg's ClueTip
   *    (http://plugins.learningjquery.com/cluetip/), which in turn was inspired
   *    by Cody Lindley's jTip (http://www.codylindley.com)
   *
   * @fileoverview
   * Beauty Tips is a jQuery tooltips plugin which uses the canvas drawing element
   * in the HTML5 spec in order to dynamically draw tooltip "talk bubbles" around
   * the descriptive help text associated with an item. This is in many ways
   * similar to Google Maps which both provides similar talk-bubbles and uses the
   * canvas element to draw them.
   *
   * The canvas element is supported in modern versions of FireFox, Safari, and
   * Opera. However, Internet Explorer needs a separate library called ExplorerCanvas
   * included on the page in order to support canvas drawing functions. ExplorerCanvas
   * was created by Google for use with their web apps and you can find it here:
   * http://excanvas.sourceforge.net/
   *
   * Beauty Tips was written to be simple to use and pretty. All of its options
   * are documented at the bottom of this file and defaults can be overwritten
   * globally for the entire page, or individually on each call.
   *
   * By default each tooltip will be positioned on the side of the target element
   * which has the most free space. This is affected by the scroll position and
   * size of the current window, so each Beauty Tip is redrawn each time it is
   * displayed. It may appear above an element at the bottom of the page, but when
   * the page is scrolled down (and the element is at the top of the page) it will
   * then appear below it. Additionally, positions can be forced or a preferred
   * order can be defined. See examples below.
   *
   * To fix z-index problems in IE6, include the bgiframe plugin on your page
   * http://plugins.jquery.com/project/bgiframe - BeautyTips will automatically
   * recognize it and use it.
   *
   * BeautyTips also works with the hoverIntent plugin
   * http://cherne.net/brian/resources/jquery.hoverIntent.html
   * see hoverIntent example below for usage
   *
   * Usage
   * The function can be called in a number of ways.
   * $(selector).bt();
   * $(selector).bt('Content text');
   * $(selector).bt('Content text', {option1: value, option2: value});
   * $(selector).bt({option1: value, option2: value});
   *
   * For more/better documentation and lots of examples, visit the demo page included with the distribution
   *
   */

  jQuery.fn.bt = function(content, options) {
    if (typeof content != 'string') {
      var contentSelect = true;
      options = content;
      content = false;
    } else {
      var contentSelect = false;
    }

    // if hoverIntent is installed, use that as default instead of hover
    if (jQuery.fn.hoverIntent && jQuery.bt.defaults.trigger == 'hover') {
      jQuery.bt.defaults.trigger = 'hoverIntent';
    }

    return this.each(function(index) {
      var opts = jQuery.extend(false, jQuery.bt.defaults, jQuery.bt.options, options);
      var target=this;
      // clean up the options
      opts.spikeLength = numb(opts.spikeLength);
      opts.spikeGirth = numb(opts.spikeGirth);
      opts.overlap = numb(opts.overlap);

      var ajaxTimeout = false;

      /**
       * This is sort of the "starting spot" for the this.each()
       * These are the init functions to handle the .bt() call
       */
      if (opts.killTitle) {
        $(this).find('[title]').andSelf().each(function() {
          if (!$(this).attr('bt-xTitle')) {
            $(this).attr('bt-xTitle', $(this).attr('title')).attr('title', '');
          }
        });
      }

      if (typeof opts.trigger == 'string') {
        opts.trigger = [opts.trigger];
      }
      if(!(opts.trigger.length > 1)){
          if (opts.trigger[0] == 'hoverIntent') {
            var hoverOpts = jQuery.extend(opts.hoverIntentOpts, {
              over: function() {
                this.btOn();
              },
              out: function() {
                this.btOff();
              }});
            $(this).hoverIntent(hoverOpts);
          } else if (opts.trigger[0] == 'hover') {
            $(this).hover(
              function() {
                this.btOn();
              },
              function() {
                this.btOff();
              }
            );
          } else if (opts.trigger[0] == 'now') {
            // toggle the on/off right now
            // note that 'none' gives more control (see below)
            if ($(this).hasClass('bt-active')) {
              this.btOff();
            } else {
              this.btOn();
            }
          } else if (opts.trigger[0] == 'none') {
            // initialize the tip with no event trigger
            // use javascript to turn on/off tip as follows:
            // $('#selector').btOn();
            // $('#selector').btOff();
          }
      } else if (opts.trigger[0] != opts.trigger[1]) {
        $(this)
          .bind(opts.trigger[0], function() {
            this.btOn();
          })
          .bind(opts.trigger[1], function() {
            this.btOff();
          });
      } else {
        // toggle using the same event
        $(this).bind(opts.trigger[0], function() {
          if ($(this).hasClass('bt-active')) {
            this.btOff();
          } else {
            this.btOn();
          }
        });
      }

      /**
       *  The BIG TURN ON
       *  Any element that has been initiated
       */
      this.btOn = function (refreshBoxOnly) {
        var self=this;
        if (typeof $(this).data('bt-box') == 'object') {
          // if there's already a popup, remove it before creating a new one.
          this.btOff();
        }

        // trigger preBuild function
        // preBuild has no argument since the box hasn't been built yet
        opts.preBuild.apply(this);

        // turn off other tips
        $(jQuery.bt.vars.closeWhenOpenStack).btOff();

        // add the class to the target element (for hilighting, for example)
        // bt-active is always applied to all, but activeClass can apply another
        $(this).addClass('bt-active ' + opts.activeClass);

        if (contentSelect && opts.ajaxPath == null) {
          // bizarre, I know
          if (opts.killTitle) {
            // if we've killed the title attribute, it's been stored in 'bt-xTitle' so get it..
            $(this).attr('title', $(this).attr('bt-xTitle'));
          }
          // then evaluate the selector... title is now in place
          content = $.isFunction(opts.contentSelector) ? opts.contentSelector.apply(this) : eval(opts.contentSelector);
          if (opts.killTitle) {
            // now remove the title again, so we don't get double tips
            $(this).attr('title', '');
          }
        }

        // ----------------------------------------------
        // All the Ajax(ish) stuff is in this next bit...
        // ----------------------------------------------
        if (opts.ajaxPath != null && content == false) {
          if (typeof opts.ajaxPath == 'object') {
            var url = eval(opts.ajaxPath[0]);
            url += opts.ajaxPath[1] ? ' ' + opts.ajaxPath[1] : '';
          } else {
            var url = opts.ajaxPath;
          }
          var off = url.indexOf(" ");
          if ( off >= 0 ) {
            var selector = url.slice(off, url.length);
            url = url.slice(0, off);
          }

          // load any data cached for the given ajax path
          var cacheData = opts.ajaxCache ? $(document.body).data('btCache-' + url.replace(/\./g, '')) : null;
          if (typeof cacheData == 'string') {
            content = selector ? $("<div/>").append(cacheData.replace(/<script(.|\s)*?\/script>/g, "")).find(selector) : cacheData;
          } else {
            // set up the options
            var ajaxOpts = jQuery.extend(false,
            {
              type: opts.ajaxType,
              data: opts.ajaxData,
              cache: opts.ajaxCache,
              url: url,
              complete: function(XMLHttpRequest, textStatus) {
                if (textStatus == 'success' || textStatus == 'notmodified') {
                  if (opts.ajaxCache) {
                    $(document.body).data('btCache-' + url.replace(/\./g, ''), XMLHttpRequest.responseText);
                  }
                  ajaxTimeout = false;
                  content = selector ?
                    // Create a dummy div to hold the results
                    $("<div/>")
                      // inject the contents of the document in, removing the scripts
                      // to avoid any 'Permission Denied' errors in IE
                      .append(XMLHttpRequest.responseText.replace(/<script(.|\s)*?\/script>/g, ""))

                      // Locate the specified elements
                      .find(selector) :

                    // If not, just inject the full result
                    XMLHttpRequest.responseText;
                } else {
                  if (textStatus == 'timeout') {
                    // if there was a timeout, we don't cache the result
                    ajaxTimeout = true;
                  }
                  content = opts.ajaxError.replace(/%error/g, XMLHttpRequest.statusText);
                }
                // if the user rolls out of the target element before the ajax request comes back, don't show it
                if ($(target).hasClass('bt-active')) {
                  target.btOn();
                }
              }
            }, opts.ajaxOpts);
            // do the ajax request
            jQuery.ajax(ajaxOpts);
            // load the throbber while the magic happens
            content = opts.ajaxLoading;
          }
        }
        // </ ajax stuff >

       if(!refreshBoxOnly){
          // Add image load listener to refrech box after each load
          var imgsl=0;
          var imgs=$('img',content).add($(content).filter('img')).hide();;
          imgs.load(function(){
            $(this).show();
            target.btOn(true);
            imgsl++;
            // Set content to false only when last image is loaded, else target.btOn() reload content instead of refresh box
            if(imgsl==imgs.length) content=false;
          });
        }
        
        // now we start actually figuring out where to place the tip

        // figure out how to compensate for the shadow, if present
        var shadowMarginX = 0; // extra added to width to compensate for shadow
        var shadowMarginY = 0; // extra added to height
        var shadowShiftX = 0;  // amount to shift the tip horizontally to allow for shadow
        var shadowShiftY = 0;  // amount to shift vertical

        if (opts.shadow && !shadowSupport()) {
          // if browser doesn't support drop shadows, turn them off
          opts.shadow = false;
          // and bring in the noShadows options
          jQuery.extend(opts, opts.noShadowOpts);
        }

        if (opts.shadow) {
          // figure out horizontal placement
          if (opts.shadowBlur > Math.abs(opts.shadowOffsetX)) {
            shadowMarginX = opts.shadowBlur * 2;
          } else {
            shadowMarginX = opts.shadowBlur + Math.abs(opts.shadowOffsetX);
          }
          shadowShiftX = (opts.shadowBlur - opts.shadowOffsetX) > 0 ? opts.shadowBlur - opts.shadowOffsetX : 0;

          // now vertical
          if (opts.shadowBlur > Math.abs(opts.shadowOffsetY)) {
            shadowMarginY = opts.shadowBlur * 2;
          } else {
            shadowMarginY = opts.shadowBlur + Math.abs(opts.shadowOffsetY);
          }
          shadowShiftY = (opts.shadowBlur - opts.shadowOffsetY) > 0 ? opts.shadowBlur - opts.shadowOffsetY : 0;
        }

        if (opts.offsetParent){
          // if offsetParent is defined by user
          var offsetParent = $(opts.offsetParent);
          var offsetParentPos = offsetParent.offset();
          var pos = $(this).offset();
          var top = numb(pos.top) - numb(offsetParentPos.top) + numb($(this).css('margin-top')) - shadowShiftY; // IE can return 'auto' for margins
          var left = numb(pos.left) - numb(offsetParentPos.left) + numb($(this).css('margin-left')) - shadowShiftX;
        } else {
          // if the target element is absolutely positioned, use its parent's offsetParent instead of its own
          var offsetParent = ($(this).css('position') == 'absolute') ? $(this).parents().eq(0).offsetParent() : $(this).offsetParent();
          var pos = $(this).position();
          var top = numb(pos.top) + numb($(this).css('margin-top')) - shadowShiftY; // IE can return 'auto' for margins
          var left = numb(pos.left) + numb($(this).css('margin-left')) - shadowShiftX;
        }
        var width = $(this).outerWidth();
        var height = $(this).outerHeight();

        if (typeof content == 'object') {
          // if content is a DOM object (as opposed to text)
          // use a clone, rather than removing the original element
          // and ensure that it's visible
          var original = content;
          var clone = $(original).clone(true).show();
          // also store a reference to the original object in the clone data
          // and a reference to the clone in the original
          var origClones = $(original).data('bt-clones') || [];
          origClones.push(clone);
          $(original).data('bt-clones', origClones);
          $(clone).data('bt-orig', original);
          $(this).data('bt-content-orig', {original: original, clone: clone});
          content = clone;
        }
        if (typeof content == 'null' || content == '') {
          // if content is empty, bail out...
          return;
        }

        // create the tip content div, populate it, and style it
        var $text = $('<div class="bt-content"></div>').css({padding: opts.padding, position: 'absolute', width: (opts.shrinkToFit ? 'auto' : opts.width), zIndex: opts.textzIndex, left: shadowShiftX, top: shadowShiftY}).css(opts.cssStyles);
        // create the wrapping box which contains text and canvas
        // put the content in it, style it, and append it to the same offset parent as the target
        var $box = $('<div class="bt-wrapper"></div>').append($text).addClass(opts.cssClass).css({position: 'absolute', width: opts.width, zIndex: opts.wrapperzIndex, visibility:'hidden'}).appendTo(offsetParent);

        // Add a close button
        $box.find('div.bt-content:first').append(content);
        if(opts.closeButton){
          jQuery('<div class="bt-close">&nbsp;</div>').click(function(){
            self.btOff();
          }).prependTo($box.find('div.bt-content:first'));
        }
		
        // use bgiframe to get around z-index problems in IE6
        // http://plugins.jquery.com/project/bgiframe
        if (jQuery.fn.bgiframe) {
          $text.bgiframe();
          $box.bgiframe();
        }

        $(this).data('bt-box', $box);

        // see if the text box will fit in the various positions
        var scrollTop = numb($(document).scrollTop());
        var scrollLeft = numb($(document).scrollLeft());
        var docWidth = numb($(window).width());
        var docHeight = numb($(window).height());
        var winRight = scrollLeft + docWidth;
        var winBottom = scrollTop + docHeight;
        var space = new Object();
        var thisOffset = $(this).offset();
        space.top = thisOffset.top - scrollTop;
        space.bottom = docHeight - ((thisOffset + height) - scrollTop);
        space.left = thisOffset.left - scrollLeft;
        space.right = docWidth - ((thisOffset.left + width) - scrollLeft);
        var textOutHeight = numb($text.outerHeight());
        var textOutWidth = numb($text.outerWidth());
        if (opts.positions.constructor == String) {
          opts.positions = opts.positions.replace(/ /, '').split(',');
        }
        if (opts.positions[0] == 'most') {
          // figure out which is the largest
          var position = 'top'; // prime the pump
          for (var pig in space) {  //            <-------  pigs in space!
            position = space[pig] > space[position] ? pig : position;
          }
        } else {
          for (var x in opts.positions) {
            var position = opts.positions[x];
            // @todo: acommodate shadow space in the following lines...
            if ((position == 'left' || position == 'right') && space[position] > textOutWidth + opts.spikeLength) {
              break;
            } else if ((position == 'top' || position == 'bottom') && space[position] > textOutHeight + opts.spikeLength) {
              break;
            }
          }
        }

        // horizontal (left) offset for the box
        var horiz = left + interpretPosition(opts.targetAlign,width,0,0,0) - interpretPosition(opts.align,textOutWidth,0,0,0);
        var horizCenter=(left + width * 0.5 - textOutWidth * 0.5);
        // vertical (top) offset for the box
        var vert = top + interpretPosition(opts.targetAlign,0,height,0,0) - interpretPosition(opts.align,0,textOutHeight,0,0);
        var vertCenter=(top + height * 0.5 - textOutHeight * 0.5);
        var points = new Array();
        var textTop, textLeft, textRight, textBottom, textTopSpace, textBottomSpace, textLeftSpace, textRightSpace, crossPoint, textCenter, spikePoint;

        // Yes, yes, this next bit really could use to be condensed
        // each switch case is basically doing the same thing in slightly different ways
        switch(position) {
          // =================== TOP =======================
          case 'top':
            // spike on bottom
            $text.css('margin-bottom', opts.spikeLength + 'px');
            $box.css({top: (top - $text.outerHeight(true)) + opts.overlap + opts.constantOverlap[1], left: horiz + opts.constantOverlap[0]});
            // move text left/right if extends out of window
            var xShift = 0;
            if(opts.windowCheck){
                textRightSpace = (winRight - opts.windowMargin) - ($text.offset().left + $text.outerWidth(true));
                if (textRightSpace < 0) {
                  // shift it left
                  $box.css('left', (numb($box.css('left')) + textRightSpace) + 'px');
                  xShift -= textRightSpace;
                }
                // we test left space second to ensure that left of box is visible
                textLeftSpace = ($text.offset().left + numb($text.css('margin-left'))) - (scrollLeft + opts.windowMargin);
                if (textLeftSpace < 0) {
                  // shift it right
                  $box.css('left', (numb($box.css('left')) - textLeftSpace) + 'px');
                  xShift += textLeftSpace;
                }
            }
            textTop = $text.position().top + numb($text.css('margin-top'));
            textLeft = $text.position().left + numb($text.css('margin-left'));
            textRight = textLeft + $text.outerWidth();
            textBottom = textTop + $text.outerHeight();
            textCenter = {x: textLeft + interpretPosition(opts.centerPointX,textRight-textLeft,0,0,textLeft), y: textTop + interpretPosition(opts.centerPointY,0,textBottom-textTop,textTop,0)};

            xShift += shadowShiftX + (horizCenter - horiz) + (interpretPosition(opts.targetCenterPointX,width,0,0,0) - 0.5 * width);

            points[points.length] = spikePoint = {x: ((textRight-textLeft) * .5) + xShift, y: textBottom + opts.spikeLength, type: 'spike'};

            var overlap=interpretPosition(opts.spikeOverlapX,textRight-textLeft,0,0,-spikePoint.x);

            crossPoint = findIntersectX(spikePoint.x, spikePoint.y, textCenter.x, textCenter.y, textBottom);
            // make sure that the crossPoint is not outside of text box boundaries
            crossPoint.x += overlap;
            crossPoint.x = crossPoint.x < textLeft + opts.spikeGirth/2 + opts.cornerRadius ? textLeft + opts.spikeGirth/2 + opts.cornerRadius : crossPoint.x;
            crossPoint.x =  crossPoint.x > (textRight - opts.spikeGirth/2) - opts.cornerRadius ? (textRight - opts.spikeGirth/2) - opts.CornerRadius : crossPoint.x;
            points[points.length] = {x: crossPoint.x - (opts.spikeGirth/2), y: textBottom, type: 'join'};
            points[points.length] = {x: textLeft, y: textBottom, type: 'corner'};  // left bottom corner
            points[points.length] = {x: textLeft, y: textTop, type: 'corner'};     // left top corner
            points[points.length] = {x: textRight, y: textTop, type: 'corner'};    // right top corner
            points[points.length] = {x: textRight, y: textBottom, type: 'corner'}; // right bottom corner
            points[points.length] = {x: crossPoint.x + (opts.spikeGirth/2), y: textBottom, type: 'join'};
            points[points.length] = spikePoint;
            points[0].x+=overlap;
            break;

          // =================== LEFT =======================
          case 'left':
            // spike on right
            $text.css('margin-right', opts.spikeLength + 'px');
            $box.css({top: (vert + opts.constantOverlap[1]) + 'px', left: ((left - $text.outerWidth(true)) + opts.overlap + opts.constantOverlap[0]) + 'px'});
            // move text up/down if extends out of window
            var yShift = 0;
            if(opts.windowCheck){
                textBottomSpace = (winBottom - opts.windowMargin) - ($text.offset().top + $text.outerHeight(true));
                if (textBottomSpace < 0) {
                  // shift it up
                  $box.css('top', (numb($box.css('top')) + textBottomSpace) + 'px');
                  yShift -= textBottomSpace;
                }
                // we ensure top space second to ensure that top of box is visible
                textTopSpace = ($text.offset().top + numb($text.css('margin-top'))) - (scrollTop + opts.windowMargin);
                if (textTopSpace < 0) {
                  // shift it down
                  $box.css('top', (numb($box.css('top')) - textTopSpace) + 'px');
                  yShift += textTopSpace;
                }
            }
            textTop = $text.position().top + numb($text.css('margin-top'));
            textLeft = $text.position().left + numb($text.css('margin-left'));
            textRight = textLeft + $text.outerWidth();
            textBottom = textTop + $text.outerHeight();
            textCenter = {x: textLeft + interpretPosition(opts.centerPointX,textRight-textLeft,0,0,textLeft), y: textTop + interpretPosition(opts.centerPointY,0,textBottom-textTop,textTop,0)};

            yShift += shadowShiftY + (vertCenter - vert) + (interpretPosition(opts.targetCenterPointY,0,height,0,0) - 0.5 * height);

            points[points.length] = spikePoint = {x: textRight + opts.spikeLength, y: ((textBottom-textTop) * .5) + yShift, type: 'spike'};
            var overlap=interpretPosition(opts.spikeOverlapY,0,textBottom-textTop,-spikePoint.y,0);

            crossPoint = findIntersectY(spikePoint.x, spikePoint.y, textCenter.x, textCenter.y, textRight);
            // make sure that the crossPoint is not outside of text box boundaries
            crossPoint.y += overlap;
            crossPoint.y = crossPoint.y < textTop + opts.spikeGirth/2 + opts.cornerRadius ? textTop + opts.spikeGirth/2 + opts.cornerRadius : crossPoint.y;
            crossPoint.y =  crossPoint.y > (textBottom - opts.spikeGirth/2) - opts.cornerRadius ? (textBottom - opts.spikeGirth/2) - opts.cornerRadius : crossPoint.y;
            points[points.length] = {x: textRight, y: crossPoint.y + opts.spikeGirth/2, type: 'join'};
            points[points.length] = {x: textRight, y: textBottom, type: 'corner'}; // right bottom corner
            points[points.length] = {x: textLeft, y: textBottom, type: 'corner'};  // left bottom corner
            points[points.length] = {x: textLeft, y: textTop, type: 'corner'};     // left top corner
            points[points.length] = {x: textRight, y: textTop, type: 'corner'};    // right top corner
            points[points.length] = {x: textRight, y: crossPoint.y - opts.spikeGirth/2, type: 'join'};
            points[points.length] = spikePoint;
            points[0].y+=overlap;
            break;

          // =================== BOTTOM =======================
          case 'bottom':
            // spike on top
            $text.css('margin-top', opts.spikeLength + 'px');
            $box.css({top: (top + height) - opts.overlap - opts.constantOverlap[1], left: horiz + opts.constantOverlap[0]});
            // move text up/down if extends out of window
            var xShift = 0;
            if(opts.windowCheck){
                textRightSpace = (winRight - opts.windowMargin) - ($text.offset().left + $text.outerWidth(true));
                if (textRightSpace < 0) {
                  // shift it left
                  $box.css('left', (numb($box.css('left')) + textRightSpace) + 'px');
                  xShift -= textRightSpace;
                }
                // we ensure left space second to ensure that left of box is visible
                textLeftSpace = ($text.offset().left + numb($text.css('margin-left')))  - (scrollLeft + opts.windowMargin);
                if (textLeftSpace < 0) {
                  // shift it right
                  $box.css('left', (numb($box.css('left')) - textLeftSpace) + 'px');
                  xShift += textLeftSpace;
                }
            }
            textTop = $text.position().top + numb($text.css('margin-top'));
            textLeft = $text.position().left + numb($text.css('margin-left'));
            textRight = textLeft + $text.outerWidth();
            textBottom = textTop + $text.outerHeight();
            textCenter = {x: textLeft + interpretPosition(opts.centerPointX,textRight-textLeft,0,0,textLeft), y: textTop + interpretPosition(opts.centerPointY,0,textBottom-textTop,textTop,0)};

            xShift += shadowShiftX + (horizCenter - horiz) + (interpretPosition(opts.targetCenterPointX,width,0,0,0) - 0.5 * width);

            points[points.length] = spikePoint = {x: ((textRight-textLeft) * .5) + xShift, y: shadowShiftY, type: 'spike'};

            var overlap=interpretPosition(opts.spikeOverlapX,textRight-textLeft,0,0,-spikePoint.x);

            crossPoint = findIntersectX(spikePoint.x, spikePoint.y, textCenter.x, textCenter.y, textTop);
            // make sure that the crossPoint is not outside of text box boundaries
            crossPoint.x += overlap;
            crossPoint.x = crossPoint.x < textLeft + opts.spikeGirth/2 + opts.cornerRadius ? textLeft + opts.spikeGirth/2 + opts.cornerRadius : crossPoint.x;
            crossPoint.x =  crossPoint.x > (textRight - opts.spikeGirth/2) - opts.cornerRadius ? (textRight - opts.spikeGirth/2) - opts.cornerRadius : crossPoint.x;
            points[points.length] = {x: crossPoint.x + opts.spikeGirth/2, y: textTop, type: 'join'};
            points[points.length] = {x: textRight, y: textTop, type: 'corner'};    // right top corner
            points[points.length] = {x: textRight, y: textBottom, type: 'corner'}; // right bottom corner
            points[points.length] = {x: textLeft, y: textBottom, type: 'corner'};  // left bottom corner
            points[points.length] = {x: textLeft, y: textTop, type: 'corner'};     // left top corner
            points[points.length] = {x: crossPoint.x - (opts.spikeGirth/2), y: textTop, type: 'join'};
            points[points.length] = spikePoint;
            points[0].x+=overlap;
            break;

          // =================== RIGHT =======================
          case 'right':
            // spike on left
            $text.css('margin-left', (opts.spikeLength + 'px'));
            $box.css({top: (vert + opts.constantOverlap[1]) + 'px', left: ((left + width) - opts.overlap - opts.constantOverlap[0]) + 'px'});
            // move text up/down if extends out of window
            var yShift = 0;
            if(opts.windowCheck){
                textBottomSpace = (winBottom - opts.windowMargin) - ($text.offset().top + $text.outerHeight(true));
                if (textBottomSpace < 0) {
                  // shift it up
                  $box.css('top', (numb($box.css('top')) + textBottomSpace) + 'px');
                  yShift -= textBottomSpace;
                }
                // we ensure top space second to ensure that top of box is visible
                textTopSpace = ($text.offset().top + numb($text.css('margin-top'))) - (scrollTop + opts.windowMargin);
                if (textTopSpace < 0) {
                  // shift it down
                  $box.css('top', (numb($box.css('top')) - textTopSpace) + 'px');
                  yShift += textTopSpace;
                }
            }
            textTop = $text.position().top + numb($text.css('margin-top'));
            textLeft = $text.position().left + numb($text.css('margin-left'));
            textRight = textLeft + $text.outerWidth();
            textBottom = textTop + $text.outerHeight();
            textCenter = {x: textLeft + interpretPosition(opts.centerPointX,textRight-textLeft,0,0,textLeft), y: textTop + interpretPosition(opts.centerPointY,0,textBottom-textTop,textTop,0)};

            yShift += shadowShiftY + (vertCenter - vert) + (interpretPosition(opts.targetCenterPointY,0,height,0,0) - 0.5 * height);

            points[points.length] = spikePoint = {x: shadowShiftX, y: ((textBottom-textTop) * .5) + yShift, type: 'spike'};
            var overlap=interpretPosition(opts.spikeOverlapY,0,textBottom-textTop,-spikePoint.y,0);

            crossPoint = findIntersectY(spikePoint.x, spikePoint.y, textCenter.x, textCenter.y, textLeft);
            // make sure that the crossPoint is not outside of text box boundaries
            crossPoint.y += overlap;
            crossPoint.y = crossPoint.y < textTop + opts.spikeGirth/2 + opts.cornerRadius ? textTop + opts.spikeGirth/2 + opts.cornerRadius : crossPoint.y;
            crossPoint.y =  crossPoint.y > (textBottom - opts.spikeGirth/2) - opts.cornerRadius ? (textBottom - opts.spikeGirth/2) - opts.cornerRadius : crossPoint.y;
            points[points.length] = {x: textLeft, y: crossPoint.y - opts.spikeGirth/2, type: 'join'};
            points[points.length] = {x: textLeft, y: textTop, type: 'corner'};     // left top corner
            points[points.length] = {x: textRight, y: textTop, type: 'corner'};    // right top corner
            points[points.length] = {x: textRight, y: textBottom, type: 'corner'}; // right bottom corner
            points[points.length] = {x: textLeft, y: textBottom, type: 'corner'};  // left bottom corner
            points[points.length] = {x: textLeft, y: crossPoint.y + opts.spikeGirth/2, type: 'join'};
            points[points.length] = spikePoint;
            points[0].y+=overlap;
            break;
        } // </ switch >

        var canvas = document.createElement('canvas');
        $(canvas).attr('width', (numb($text.outerWidth(true)) + opts.strokeWidth*2 + shadowMarginX)).attr('height', (numb($text.outerHeight(true)) + opts.strokeWidth*2 + shadowMarginY)).appendTo($box).css({position: 'absolute', zIndex: opts.boxzIndex});


        // if excanvas is set up, we need to initialize the new canvas element
        if (typeof G_vmlCanvasManager != 'undefined') {
          canvas = G_vmlCanvasManager.initElement(canvas);
        }

        if (opts.cornerRadius > 0) {
          // round the corners!
          var newPoints = new Array();
          var newPoint;
          for (var i=0; i<points.length; i++) {
            if (points[i].type == 'corner') {
              // create two new arc points
              // find point between this and previous (using modulo in case of ending)
              newPoint = betweenPoint(points[i], points[(i-1)%points.length], opts.cornerRadius);
              newPoint.type = 'arcStart';
              newPoints[newPoints.length] = newPoint;
              // the original corner point
              newPoints[newPoints.length] = points[i];
              // find point between this and next
              newPoint = betweenPoint(points[i], points[(i+1)%points.length], opts.cornerRadius);
              newPoint.type = 'arcEnd';
              newPoints[newPoints.length] = newPoint;
            } else {
              newPoints[newPoints.length] = points[i];
            }
          }
          // overwrite points with new version
          points = newPoints;
        }

        var ctx = canvas.getContext("2d");

        if (opts.shadow && opts.shadowOverlap !== true) {

          var shadowOverlap = numb(opts.shadowOverlap);

          // keep the shadow (and canvas) from overlapping the target element
          switch (position) {
            case 'top':
              if (opts.shadowOffsetX + opts.shadowBlur - shadowOverlap > 0) {
                $box.css('top', (numb($box.css('top')) - (opts.shadowOffsetX + opts.shadowBlur - shadowOverlap)));
              }
              break;
            case 'right':
              if (shadowShiftX - shadowOverlap > 0) {
                $box.css('left', (numb($box.css('left')) + shadowShiftX - shadowOverlap));
              }
              break;
            case 'bottom':
              if (shadowShiftY - shadowOverlap > 0) {
                $box.css('top', (numb($box.css('top')) + shadowShiftY - shadowOverlap));
              }
              break;
            case 'left':
              if (opts.shadowOffsetY + opts.shadowBlur - shadowOverlap > 0) {
                $box.css('left', (numb($box.css('left')) - (opts.shadowOffsetY + opts.shadowBlur - shadowOverlap)));
              }
              break;
          }
        }

        drawIt.apply(ctx, [points], opts.strokeWidth);
        if(typeof opts.fill=="object"){
            if(opts.fill.type=='gradient'){
                var grd = ctx.createLinearGradient(eval(opts.fill.x1),eval(opts.fill.y1),eval(opts.fill.x2),eval(opts.fill.y2));
                for(var i in opts.fill.colors){
                    grd.addColorStop(opts.fill.colors[i].start,opts.fill.colors[i].color);
                }
                ctx.fillStyle = grd;
            }
        }else{
            ctx.fillStyle = opts.fill;
        }

        if (opts.shadow) {
          ctx.shadowOffsetX = opts.shadowOffsetX;
          ctx.shadowOffsetY = opts.shadowOffsetY;
          ctx.shadowBlur = opts.shadowBlur;
          ctx.shadowColor =  opts.shadowColor;
        }
        ctx.closePath();
        ctx.fill();
        if (opts.strokeWidth > 0) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0)'; //remove shadow from stroke
          ctx.lineWidth = opts.strokeWidth;
          ctx.strokeStyle = opts.strokeStyle;
          ctx.beginPath();
          drawIt.apply(ctx, [points], opts.strokeWidth);
          ctx.closePath();
          ctx.stroke();
        }

        // trigger preShow function
        // function receives the box element (the balloon wrapper div) as an argument
        opts.preShow.apply(this, [$box[0],points]);

        // switch from visibility: hidden to display: none so we can run animations
        $box.css({display:'none', visibility: 'visible'});

        // Here's where we show the tip
        opts.showTip.apply(this, [$box[0]]);

        if (opts.overlay) {
          // EXPERIMENTAL AND FOR TESTING ONLY!!!!
          var overlay = $('<div class="bt-overlay"></div>').css({
              position: 'absolute',
              backgroundColor: 'blue',
              top: top,
              left: left,
              width: width,
              height: height,
              opacity: '.2'
            }).appendTo(offsetParent);
          $(this).data('overlay', overlay);
        }

        if ((opts.ajaxPath != null && opts.ajaxCache == false && !refreshBoxOnly && !imgs.length)  || ajaxTimeout) {
          // if ajaxCache is not enabled or if there was a server timeout,
          // remove the content variable so it will be loaded again from server
          content = false;
        }

        // stick this element into the clickAnywhereToClose stack
        if (opts.clickAnywhereToClose) {
          jQuery.bt.vars.clickAnywhereStack.push(this);
          $(document).click(jQuery.bt.docClick);
        }

        // stick this element into the closeWhenOthersOpen stack
        if (opts.closeWhenOthersOpen) {
          jQuery.bt.vars.closeWhenOpenStack.push(this);
        }

        // trigger postShow function
        // function receives the box element (the balloon wrapper div) as an argument
        opts.postShow.apply(this, [$box[0]]);

        // Close box if close event is outbox
        if(opts.trigger[1]=='outbox'){
            $box.mouseenter(function(){
                $(target).data('inbox',true);
            }).mouseleave(function(){
                $(target).btOff();
                $(target).data('inbox',false);
            });
            $(target).bind('mouseleave',function(){
                setTimeout(function(){ if(!$(target).data('inbox')) $(target).btOff(); },20);
            });
        }
      }; // </ turnOn() >

      this.btOff = function() {

        var box = $(this).data('bt-box');

        // trigger preHide function
        // function receives the box element (the balloon wrapper div) as an argument
        opts.preHide.apply(this, [box]);

        var i = this;

        // set up the stuff to happen AFTER the tip is hidden
        i.btCleanup = function(){
          var box = $(i).data('bt-box');
          var contentOrig = $(i).data('bt-content-orig');
          var overlay = $(i).data('bt-overlay');
          if (typeof box == 'object') {
            $(box).remove();
            $(i).removeData('bt-box');
          }
          if (typeof contentOrig == 'object') {
            var clones = $(contentOrig.original).data('bt-clones');
            $(contentOrig).data('bt-clones', arrayRemove(clones, contentOrig.clone));
          }
          if (typeof overlay == 'object') {
            $(overlay).remove();
            $(i).removeData('bt-overlay');
          }

          // remove this from the stacks
          jQuery.bt.vars.clickAnywhereStack = arrayRemove(jQuery.bt.vars.clickAnywhereStack, i);
          jQuery.bt.vars.closeWhenOpenStack = arrayRemove(jQuery.bt.vars.closeWhenOpenStack, i);

          // remove the 'bt-active' and activeClass classes from target
          $(i).removeClass('bt-active ' + opts.activeClass);

          // trigger postHide function
          // no box argument since it has been removed from the DOM
          opts.postHide.apply(i);

        }

        opts.hideTip.apply(this, [box, i.btCleanup]);

      }; // </ turnOff() >

      var refresh = this.btRefresh = function() {
        this.btOff();
        this.btOn();
      };

    }); // </ this.each() >


    function drawIt(points, strokeWidth) {
      this.moveTo(points[0].x, points[0].y);
      for (i=1;i<points.length;i++) {
        if (points[i-1].type == 'arcStart') {
          // if we're creating a rounded corner
          //ctx.arc(round5(points[i].x), round5(points[i].y), points[i].startAngle, points[i].endAngle, opts.cornerRadius, false);
          this.quadraticCurveTo(round5(points[i].x, strokeWidth), round5(points[i].y, strokeWidth), round5(points[(i+1)%points.length].x, strokeWidth), round5(points[(i+1)%points.length].y, strokeWidth));
          i++;
          //ctx.moveTo(round5(points[i].x), round5(points[i].y));
        }
        else {
          this.lineTo(round5(points[i].x, strokeWidth), round5(points[i].y, strokeWidth));
        }
      }
    }; // </ drawIt() >

    /**
     * For odd stroke widths, round to the nearest .5 pixel to avoid antialiasing
     * http://developer.mozilla.org/en/Canvas_tutorial/Applying_styles_and_colors
     */
    function round5(num, strokeWidth) {
      var ret;
      strokeWidth = numb(strokeWidth);
      if (strokeWidth%2) {
        ret = num;
      }
      else {
        ret = Math.round(num - .5) + .5;
      }
      return ret;
    }; // </ round5() >

    /**
     * Ensure that a number is a number... or zero
     */
    function numb(num) {
      return parseInt(num) || 0;
    }; // </ numb() >

    /**
     * Remove an element from an array
     */
    function arrayRemove(arr, elem) {
      var x, newArr = new Array();
      for (x in arr) {
        if (arr[x] != elem) {
          newArr.push(arr[x]);
        }
      }
      return newArr;
    }; // </ arrayRemove() >

    /**
     * Does the current browser support canvas?
     * This is a variation of http://code.google.com/p/browser-canvas-support/
     */
    function canvasSupport() {
      var canvas_compatible = false;
      try {
        canvas_compatible = !!(document.createElement('canvas').getContext('2d')); // S60
      } catch(e) {
        canvas_compatible = !!(document.createElement('canvas').getContext); // IE
      }
      return canvas_compatible;
    }

    /**
     * Does the current browser support canvas drop shadows?
     */
    function shadowSupport() {

      // to test for drop shadow support in the current browser, uncomment the next line
      // return true;

      // until a good feature-detect is found, we have to look at user agents
      try {
        var userAgent = navigator.userAgent.toLowerCase();
        if (/webkit/.test(userAgent)) {
          // WebKit.. let's go!
          return true;
        }
        if (/gecko|mozilla/.test(userAgent)) {
          var match = userAgent.match(/firefox\/(\d+(?:\.\d+)+)/);
          if (match && match.length >= 2 && parseFloat(match[1]) >= 3.1) {
            // Mozilla 3.1 or higher
            return true;
          }
        }
        if (/trident\/5.0/.test(userAgent)) {
            return true;
        }
      } catch(err) {
        // if there's an error, just keep going, we'll assume that drop shadows are not supported
      }

      return false;

    } // </ shadowSupport() >

    /**
     * Given two points, find a point which is dist pixels from point1 on a line to point2
     */
    function betweenPoint(point1, point2, dist) {
      // figure out if we're horizontal or vertical
      var y, x;
      if (point1.x == point2.x) {
        // vertical
        y = point1.y < point2.y ? point1.y + dist : point1.y - dist;
        return {x: point1.x, y: y};
      } else if (point1.y == point2.y) {
        // horizontal
        x = point1.x < point2.x ? point1.x + dist : point1.x - dist;
        return {x:x, y: point1.y};
      }
    }; // </ betweenPoint() >

    function centerPoint(arcStart, corner, arcEnd) {
      var x = corner.x == arcStart.x ? arcEnd.x : arcStart.x;
      var y = corner.y == arcStart.y ? arcEnd.y : arcStart.y;
      var startAngle, endAngle;
      if (arcStart.x < arcEnd.x) {
        if (arcStart.y > arcEnd.y) {
          // arc is on upper left
          startAngle = (Math.PI/180)*180;
          endAngle = (Math.PI/180)*90;
        } else {
          // arc is on upper right
          startAngle = (Math.PI/180)*90;
          endAngle = 0;
        }
      } else {
        if (arcStart.y > arcEnd.y) {
          // arc is on lower left
          startAngle = (Math.PI/180)*270;
          endAngle = (Math.PI/180)*180;
        } else {
          // arc is on lower right
          startAngle = 0;
          endAngle = (Math.PI/180)*270;
        }
      }
      return {x: x, y: y, type: 'center', startAngle: startAngle, endAngle: endAngle};
    }; // </ centerPoint() >

    /**
     * Find the intersection point of two lines, each defined by two points
     * arguments are x1, y1 and x2, y2 for r1 (line 1) and r2 (line 2)
     * It's like an algebra party!!!
     */
    function findIntersect(r1x1, r1y1, r1x2, r1y2, r2x1, r2y1, r2x2, r2y2) {

      if (r2x1 == r2x2) {
        return findIntersectY(r1x1, r1y1, r1x2, r1y2, r2x1);
      }
      if (r2y1 == r2y2) {
        return findIntersectX(r1x1, r1y1, r1x2, r1y2, r2y1);
      }

      // m = (y1 - y2) / (x1 - x2)  // <-- how to find the slope
      // y = mx + b                 // the 'classic' linear equation
      // b = y - mx                 // how to find b (the y-intersect)
      // x = (y - b)/m              // how to find x
      var r1m = (r1y1 - r1y2) / (r1x1 - r1x2);
      var r1b = r1y1 - (r1m * r1x1);
      var r2m = (r2y1 - r2y2) / (r2x1 - r2x2);
      var r2b = r2y1 - (r2m * r2x1);

      var x = (r2b - r1b) / (r1m - r2m);
      var y = r1m * x + r1b;

      return {x: x, y: y};
    }; // </ findIntersect() >

    /**
     * Find the y intersection point of a line and given x vertical
     */
    function findIntersectY(r1x1, r1y1, r1x2, r1y2, x) {
      if (r1y1 == r1y2) {
        return {x: x, y: r1y1};
      }
      var r1m = (r1y1 - r1y2) / (r1x1 - r1x2);
      var r1b = r1y1 - (r1m * r1x1);

      var y = r1m * x + r1b;

      return {x: x, y: y};
    }; // </ findIntersectY() >

    /**
     * Find the x intersection point of a line and given y horizontal
     */
    function findIntersectX(r1x1, r1y1, r1x2, r1y2, y) {
      if (r1x1 == r1x2) {
        return {x: r1x1, y: y};
      }
      var r1m = (r1y1 - r1y2) / (r1x1 - r1x2);
      var r1b = r1y1 - (r1m * r1x1);

      // y = mx + b     // your old friend, linear equation
      // x = (y - b)/m  // linear equation solved for x
      var x = (y - r1b) / r1m;

      return {x: x, y: y};

    }; // </ findIntersectX() >

    function interpretPosition(p,width,height,top,left){
        if(typeof p !== 'string') return p;
        return eval(p.replace(/%/g,'/100*'+(width?width:height))
            .replace(/top/g,top)
            .replace(/bottom/g,top+height)
            .replace(/left/g,left)
            .replace(/right/g,left+width)
            .replace(/px/g,''));
    }

  }; // </ jQuery.fn.bt() >

  /**
   * A convenience function to run btOn() (if available)
   * for each selected item
   */
  jQuery.fn.btOn = function() {
    return this.each(function(index){
      if (jQuery.isFunction(this.btOn)) {
        this.btOn();
      }
    });
  }; // </ $().btOn() >

  /**
   *
   * A convenience function to run btOff() (if available)
   * for each selected item
   */
  jQuery.fn.btOff = function() {
    return this.each(function(index){
      if (jQuery.isFunction(this.btOff)) {
        this.btOff();
      }
    });
  }; // </ $().btOff() >

  jQuery.bt.vars = {clickAnywhereStack: [], closeWhenOpenStack: []};

  /**
   * This function gets bound to the document's click event
   * It turns off all of the tips in the click-anywhere-to-close stack
   */
  jQuery.bt.docClick = function(e) {
    if (!e) {
      var e = window.event;
    };
    // if clicked element is a child of neither a tip NOR a target
    // and there are tips in the stack
    if (!$(e.target).parents().andSelf().filter('.bt-wrapper, .bt-active').length && jQuery.bt.vars.clickAnywhereStack.length) {
      // if clicked element isn't inside tip, close tips in stack
      $(jQuery.bt.vars.clickAnywhereStack).btOff();
      $(document).unbind('click', jQuery.bt.docClick);
    }
  }; // </ docClick() >

  /**
   * Defaults for the beauty tips
   *
   * Note this is a variable definition and not a function. So defaults can be
   * written for an entire page by simply redefining attributes like so:
   *
   *   jQuery.bt.options.width = 400;
   *
   * Be sure to use *jQuery.bt.options* and not jQuery.bt.defaults when overriding
   *
   * This would make all Beauty Tips boxes 400px wide.
   *
   * Each of these options may also be overridden during
   *
   * Can be overriden globally or at time of call.
   *
   */
  jQuery.bt.defaults = {
    trigger:         'hover',        // trigger to show/hide tip
                                             // use [on, off] to define separate on/off triggers
                                             // also use space character to allow multiple  to trigger
                                             // examples:
                                             //   ['focus', 'blur'] // focus displays, blur hides
                                             //   'dblclick'        // dblclick toggles on/off
                                             //   ['focus mouseover', 'blur mouseout'] // multiple triggers
                                             //   'now'             // shows/hides tip without event
                                             //   'none'            // use $('#selector').btOn(); and ...btOff();
                                             //   'hoverIntent'     // hover using hoverIntent plugin (settings below)
                                             //   'outbox'     // hide tip on mouse leave tooltip
                                             // note:
                                             //   hoverIntent becomes default if available

    clickAnywhereToClose: true,              // clicking anywhere outside of the tip will close it
    closeWhenOthersOpen: false,              // tip will be closed before another opens - stop >= 2 tips being on

    shrinkToFit: false, // should short single-line content get a narrower balloon?
    width: '200px', // width of tooltip box

    padding: '10px', // padding for content (get more fine grained with cssStyles)
    spikeGirth: 10, // width of spike
    spikeLength: 15, // length of spike
    spikeOverlapX: 0, // move edge of the spike
    spikeOverlapY: 0, // move edge of the spike
    overlap: 0, // tooltip overlap (px) onto target direction of overlap depend of position option (can cause problems with 'hover' trigger)
    constantOverlap : [0,0], // tooltip overlap (px) left,top that is not depending of the position option
    overlay: false, // display overlay on target (use CSS to style) -- BUGGY!
    killTitle: true, // kill title tags to avoid double tooltips
    textzIndex: 9999, // z-index for the text
    boxzIndex: 9998, // z-index for the "talk" box (should always be less than textzIndex)
    wrapperzIndex: 9997,
    offsetParent: null, // DOM node to append the tooltip into. Must be positioned relative or absolute. Can be selector or object
    positions: ['most'],  // preference of positions for tip (will use first with available space)
                                     // possible values 'top', 'bottom', 'left', 'right' as an array in order of
                                     // preference. Last value will be used if others don't have enough space.
                                     // or use 'most' to use the area with the most space
                                     // attempting to place within currently visible area
    fill: "rgb(255, 255, 102)",  // fill color for the tooltip box, you can use any CSS-style color definition method
                                                // can be an object to describe a gradient type on canvas {type:'gradient', x1:int, x2:int, y1:int, y2:int, color: [{start:int, color:color},...]}
    windowCheck: true, // adapt position to window size
    windowMargin: 10, // space (px) to leave between text box and browser edge
    strokeWidth: 1, // width of stroke around box, **set to 0 for no stroke**
    strokeStyle: "#000", // color/alpha of stroke
    cornerRadius: 5, // radius of corners (px), set to 0 for square corners
    centerPointX: '50%', // the spike extends from targetCenterPoint of the target edge to centerPoint
                                        // can be combinaison of x%, xpx, top/left/bottom/right (see interpretPosition()) (ex: bottom+10%+20 is valid)
    centerPointY: '50%',
    targetCenterPointX: '50%',
    targetCenterPointY: '50%',
    align: '50%', // align point of box at align to point of target at targetAlign
                          // can be combinaison of x%, xpx, top/left/bottom/right (see interpretPosition()) (ex: bottom+10% is valid)
    targetAlign : '50%',
    shadow: false, // use drop shadow? (only displays in Safari and FF 3.1) - experimental
    shadowOffsetX: 2, // shadow offset x (px)
    shadowOffsetY: 2, // shadow offset y (px)
    shadowBlur: 3, // shadow blur (px)
    shadowColor: "#000", // shadow color/alpha
    shadowOverlap: false, // when shadows overlap the target element it can cause problem with hovering
                                           // set this to true to overlap or set to a numeric value to define the amount of overlap
    noShadowOpts: {strokeStyle: '#999'},  // use this to define 'fall-back' options for browsers which don't support drop shadows
    cssClass: '', // CSS class to add to the box wrapper div (of the TIP)
    cssStyles: {}, // styles to add the text box (ex: {fontFamily: 'Georgia, Times, serif', fontWeight: 'bold'})
    activeClass: 'bt-active', // class added to TARGET element when its BeautyTip is active
    contentSelector: "$(this).attr('title')", // if there is no content argument, use this selector to retrieve the title
                                                                 // a function which returns the content may also be passed here
    ajaxPath: null, // if using ajax request for content, this contains url and (opt) selector
                            // this will override content and contentSelector
                            // examples (see jQuery load() function):
                            //   '/demo.html'
                            //   '/help/ajax/snip'
                            //   '/help/existing/full div#content'
                            // ajaxPath can also be defined as an array
                            // in which case, the first value will be parsed as a jQuery selector
                            // the result of which will be used as the ajaxPath
                            // the second (optional) value is the content selector as above
                            // examples:
                            //    ["$(this).attr('href')", 'div#content']
                            //    ["$(this).parents('.wrapper').find('.title').attr('href')"]
                            //    ["$('#some-element').val()"]

    ajaxError: '<strong>ERROR:</strong> <em>%error</em>', // error text, use "%error" to insert error from server
    ajaxLoading: '<blink>Loading...</blink>', // yes folks, it's the blink tag!
    ajaxData: {}, // key/value pairs
    ajaxType: 'GET', // 'GET' or 'POST'
    ajaxCache: true, // cache ajax results and do not send request to same url multiple times
    ajaxOpts: {}, // any other ajax options - timeout, passwords, processing functions, etc...
    preBuild: function(){}, // function to run before popup is built
    preShow: function(box){}, // function to run before popup is displayed
    showTip: function(box){
      $(box).show();
    },
    postShow: function(box){}, // function to run after popup is built and displayed
    preHide: function(box){}, // function to run before popup is removed
    hideTip: function(box, callback) {
      $(box).hide();
      callback();
    },
    postHide: function(){}, // function to run after popup is removed
    hoverIntentOpts:  { // options for hoverIntent (if installed)
      interval: 300,
      timeout: 500
    },
    closeButton : false
  }; // </ jQuery.bt.defaults >

  jQuery.bt.options = {};

})(jQuery);

// @todo
// use larger canvas (extend to edge of page when windowMargin is active)
// add options to shift position of tip vert/horiz and position of spike tip
// create drawn (canvas) shadows
// use overlay to allow overlap with hover
// experiment with making tooltip a subelement of the target
// handle non-canvas-capable browsers elegantly
