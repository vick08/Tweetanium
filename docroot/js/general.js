// Globals
var Timelines = [];

YUI({
	//combine: true,
	modules: {
		'gallery-yql': {
			fullpath: 'http://yui.yahooapis.com/gallery-2010.01.27-20/build/gallery-yql/gallery-yql-min.js',
			requires: ['get','event-custom'],
			optional: [],
			supersedes: []
		},
		'Timeline': {
			fullpath: 'http://tweetanium.net/js/timeline.js',
			requires: [],
			optional: [],
			supersedes: []
		},
		'Bucket': {
			fullpath: 'http://tweetanium.net/js/bucket.js',
			requires: [],
			optional: [],
			supersedes: []
		},
		'Tweet': {
			fullpath: 'http://tweetanium.net/js/tweet.js',
			requires: [],
			optional: [],
			supersedes: []
		},
		'Twitter': {
			fullpath: 'http://tweetanium.net/js/twitter.js',
			requires: ['io-base', 'gallery-yql', 'json'],
			optional: [],
			supersedes: []
		},
		'User': {
			fullpath: 'http://tweetanium.net/js/user.js',
			requires: [],
			optional: [],
			supersedes: []
		},
		'List': {
			fullpath: 'http://tweetanium.net/js/list.js',
			requires: [],
			optional: [],
			supersedes: []
		},
	}
}).use('node', 'dom', 'event', 'Timeline', 'Bucket', 'Tweet', 'Twitter', 'User', 'List', function(Y) {
	
	function newState() {
		var state 	 = null;
		var config 	 = {};
		var Timeline = {};
		var timelineCount = 0;
		
		timelineCount = Timelines.length;
		
		for(var i=0; i < timelineCount; i++) {
			Timelines[i].destroy();
			Timelines.splice(i, 1); // Splice, instead of delete, to not leave any holes in the array.
		}
		if (timeline = getHashStringParameter('timeline')) {
			config = {
				type: "timeline",
				timeline: timeline
			};
		} 
		else if (query = getHashStringParameter('query')) {
			//query = Y.one("#search-box input[type=text]").get("value");
			config = {
				type: "search",
				query: query
			};
		}
		else if (list = getHashStringParameter('list')) {
			config = {
				type: "list",
				list: list
			};
		}
		else {
			throw ("Unknown state");
		}
		
		if (config.type) {
			Timeline = Object.create(Y.Timeline);
			Timeline.init(config);

			window.Timelines.push(Timeline);
		}
	}
	
	// Load the initial state and loop to detect any URL Hash changes
	setTimeout(newState, 100);
	(function () {
		var lastHash = location.hash;
		if (lastHash == '')
			window.location.hash = "#timeline=home";
			
		return setInterval(function() {
		    if(lastHash !== location.hash) {
				lastHash = location.hash;
				newState();
		    }
		}, 200);
	})();	
	
	
	// Recalculate timestamps
	setInterval(function() {
		Y.all(".timestamp").each(function(node){
			node.setContent(relative_time(node.getAttribute('title')));
		})
	}, 60000); // Once per minute


	// Load in the user's lists
	(function(){
		var request = {};
		request.type = "lists";
		Y.Twitter.call(request, function(lists){
			var html = '';
			for(var i in lists) {
				List = Object.create(Y.List);
				List.init(lists[i]);
				html += List.asHtml();
			}
			Y.one("#lists").setContent(html);
		});
	})();

	// Load in the user's saved searches
	(function(){
		var request = {};
		request.type = "saved_searches";
		Y.Twitter.call(request, function(searches){
			var html = '';
			for(var i in searches) {
				html += "<li><a href='#query=" + encodeURIComponent(searches[i].query) + "'>" + searches[i].name + "</li>";
			}
			Y.one("#saved-searches").setContent(html);
		});
	})();


	// Check on the rate limiting
	var checkRateLimitStatus = function(){
		Y.Twitter.call({"type": "rate_limit_status"}, function(response){
			var current_timestamp = Math.round(new Date().getTime() / 1000);
			var seconds_till_reset = response['reset-time-in-seconds'].content - current_timestamp;
			var minutes_till_reset = Math.round(seconds_till_reset / 60);
			
			Y.one("#rate-reset-time").setContent(minutes_till_reset);
			Y.one("#rate-remaining-hits").setContent(response['remaining-hits'].content);
		})
	};
	setTimeout(checkRateLimitStatus, 2000);
	setInterval(checkRateLimitStatus, 75217); // Every 75 seconds, staggered
	
	
	// reset the trends
	var resetTrends = function () {
		var request = {};
		request.type = "trends";
		Y.Twitter.call(request, function(trends){
			var html = '';
			for(var i in trends) {
				html += "<li><a href='#query=" + encodeURIComponent(trends[i].query) + "'>" + trends[i].name + "</li>";
			}
			Y.one("#trends").setContent(html);
		});
	};
	resetTrends();
	setInterval(resetTrends, 60000 * 5); // Every 5 minutes


	var recalculateStatusCharCount = function(){
		var status = Y.one("#compose-status").get("value");
		Y.one("#character-count").setContent(140-status.length);
	}
	document.getElementById("compose-status").onkeyup = recalculateStatusCharCount;
	
	
	function closeSideboxHandler() {
		Y.one("#sidebox").addClass("hidden");
	}
	
	function updateStatusHandler() {
		var status = Y.one("#compose-status").get("value");
		updateStatus(status, function(response){
			Y.one("#compose-status").set("value", "");
			recalculateStatusCharCount();
		});
	}
	
	function userHandler(e) {
		var User = Object.create(Y.User);
		var username = Y.one(e.target).get("innerHTML");
		
		User.init({"username":username});
		Y.one("#sidebox .inner").setContent("Loading...");
		Y.one("#sidebox").removeClass("hidden");
		
		User.load(function(U){
			Y.one("#sidebox .inner").setContent(U.asHtml());
		});
	}
	
	function searchHandler(e) {
		var query = Y.one("#search-box input[type=text]").get("value");
		window.location.hash = '#query=' + (query) + '';
	}
	
	function searchBoxHandler(e) {
		if (e.type === "focus") {
			e.target.set("value", "").setStyle("color", "#000000");
		}
		else if (e.type === "blur" && e.target.get("value") === "") {
			e.target.set("value", "Twitter Search").setStyle("color", "#999999");
		}
	}
	
	function replyHandler(e) {
		var username = Y.one(e.target).ancestor(".tweet").one(".username").get("innerHTML");
		var in_reply_to = Y.one(e.target).ancestor(".tweet").get("id").replace("tweetid-", "");
		
		var html = [];
		html.push("<div>");
		html.push("	 <input type='text' value='@" + username + " ' class='text-reply' id='reply-to-" + in_reply_to + "' style='width:400px;'>");
		html.push("	 <input type='button' class='button-submit-reply' value='send'>");
		html.push("	 <span class='pseudolink link-cancel-reply'>cancel</span>");
		html.push("</div>");
		html = html.join('');
		
		Y.one(e.target).ancestor(".tweet").one(".tweet-extra").setContent(html);
	}
	
	function retweetHandler(e) {
		var username = Y.one(e.target).ancestor(".tweet").one(".username").get("innerHTML");
		var text = Y.one(e.target).ancestor(".tweet").one(".raw-text").get("innerHTML");
		Y.one("#compose-status").set("value", "RT @" + username + ": " + text);
		recalculateStatusCharCount();
	}
	
	function cancelReplyHandler(e) {
		Y.one(e.target).ancestor(".tweet-extra").get('children').remove(true);
	}
	
	function sendReplyHandler(e) {
		var status = Y.one(e.target).ancestor(".tweet").one(".text-reply").get("value");
		var in_reply_to = Y.one(e.target).ancestor(".tweet").get("id").replace("tweetid-", "");
		updateStatus(status, function(){
			Y.one(e.target).ancestor(".tweet-extra").get('children').remove(true);
		})
	} 
	
	function updateStatus(status, callback) {
		Y.Twitter.call({"type":"update", "status":status}, function(response){
			callback(response);
		});		
	}
	
	var allowUpdate = true;
	function unlockUpdating() {
		allowUpdate = true;
	}
	
	Y.on('click', closeSideboxHandler, '#link-close-sidebox');
	Y.on('click', updateStatusHandler, '#update-status');
	Y.on('click', searchHandler, '#search-box input[type=button]');
	Y.on('focus', searchBoxHandler, '#search-box input[type=text]');
	Y.on('blur', searchBoxHandler, '#search-box input[type=text]');
	
	Y.delegate('click', userHandler, '#timeline', '.username');
	Y.delegate('click', replyHandler, '#timeline', '.link-reply');
	Y.delegate('click', retweetHandler, '#timeline', '.link-retweet');
	Y.delegate('click', cancelReplyHandler, '#timeline', '.link-cancel-reply');
	Y.delegate('click', sendReplyHandler, '#timeline', '.button-submit-reply');





	window.onscroll = function() {
		/* <auto-update> */
		    var st = (document.documentElement.scrollTop || document.body.scrollTop);
		    var wh = (window.innerHeight && window.innerHeight < Y.DOM.winHeight()) ? window.innerHeight : Y.DOM.winHeight();
		
			var coverage = st + wh;
			var docHeight = Y.DOM.docHeight();
		
			if (coverage >= (docHeight - 0) && allowUpdate) {
				var t = Timelines[0];
				where = {
					field : "max_id",
					value : t.lowestTweetId() - 1,
				};
				t.addBucket("append").getTweets(t.config, where);
			
				allowUpdate = false;
				setTimeout(unlockUpdating, 3000);
			}
		/* </auto-update> */
		
		
		/* <sticky sidebox> */
			var offset = 30;
			if( window.XMLHttpRequest ) {
				//Moving
				if (document.documentElement.scrollTop > offset || self.pageYOffset > offset) {
					document.getElementById('sidebox').style.position = 'fixed';
					document.getElementById('sidebox').style.top = 0;
				} 
				// At top
				else if (document.documentElement.scrollTop < offset || self.pageYOffset < offset) {
					document.getElementById('sidebox').style.position = 'absolute';
					document.getElementById('sidebox').style.top = offset + 'px';
				}
			}
		/* </sticky sidebox> */
	}
});

// Helper functions

function ratelimit(fn, ms) {
    var last = (new Date()).getTime();
    return (function() {
        var now = (new Date()).getTime();
        if (now - last > ms) {
            last = now;
            fn.apply(null, arguments);
        }
    });
}

function getHashStringParameter(parameter){
	var queryString = {};
	var parameters  = window.location.hash.substring(1).split('&');
	var pos, paramname, paramval;
	
	for (var i in parameters) {
		pos = parameters[i].indexOf('=');
		if (pos > 0) {
			paramname = parameters[i].substring(0,pos);
			paramval  = parameters[i].substring(pos+1);
			queryString[paramname] = unescape(paramval.replace(/\+/g,' '));
		}
		else {
			queryString[parameters[i]] = "";
		}
	}
	
	if (queryString[parameter]) {
		return queryString[parameter];
	}
	else {
		return false;
	}
}
function getHashStringParameter2(param)
{
	var queryString = {};
	var parameters  = window.location.hash.substring(1).split('&');
	var pos;
	var paramname;
	var paramval;
	for (var i in parameters) 
	{
		pos = parameters[i].indexOf('=');
		if (pos > 0)
		{
			paramname = parameters[i].substring(0,pos);
			paramval  = parameters[i].substring(pos+1);
			queryString[paramname] = unescape(paramval.replace(/\+/g,' '));
		}
		else
		{
			queryString[parameters[i]] = "";
		}
	}
	return queryString[param];
}

function relative_time(parsed_date) {
	var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
	var delta 		= parseInt((relative_to.getTime() - parsed_date) / 1000) + (relative_to.getTimezoneOffset() * 60);

	if (delta < 60) {
		return 'less than a minute ago';
	} else if(delta < 120) {
		return 'a minute ago';
	} else if(delta < (45*60)) {
		return (parseInt(delta / 60)).toString() + ' minutes ago';
	} else if(delta < (90*60)) {
		return 'an hour ago';
	} else if(delta < (24*60*60)) {
		return '' + (parseInt(delta / 3600)).toString() + ' hours ago';
	} else if(delta < (48*60*60)) {
		return '1 day ago';
	} else {
		return (parseInt(delta / 86400)).toString() + ' days ago';
	}
}

function addslashes(str) {
	return str.replace(/\\/g,'\\\\').replace(/\'/g,'\\\'').replace(/\"/g,'\\"').replace(/\0/g,'\\0');
}

function stripslashes(str) {
	return str.replace(/\\'/g,'\'').replace(/\\"/g,'"').replace(/\\0/g,'\0').replace(/\\\\/g,'\\');
}

function html_entity_decode(str)
{
    try
	{
		var temp = document.createElement('textarea');
		temp.innerHTML = str; 
		var val = temp.value;
		//temp.parentNode.removeChild(temp);
		return val;
	}
	catch(e)
	{
		//for IE add <div id="htmlconverter" style="display:none;"></div> to the page
		document.getElementById("htmlconverter").innerHTML = '<textarea id="innerConverter">' + str + '</textarea>';
		var content = document.getElementById("innerConverter").value;
		document.getElementById("htmlconverter").innerHTML = "";
		return content;
	}
}
// To prevent the "Console is undefined" bug
try { console.log('Console ready...'); } catch(e) { console = { log: function() {}}; }