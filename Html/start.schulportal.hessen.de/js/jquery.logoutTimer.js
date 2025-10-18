jQuery.cachedScript = function (url, options) {

    // Allow user to set any option except for dataType, cache, and url
    options = $.extend(options || {}, {
        dataType: "script",
        cache: true,
        url: url
    });

    // Use $.ajax() since it is more flexible than $.getScript
    // Return the jqXHR object so we can chain callbacks
    return jQuery.ajax(options);
};



if (typeof logoutTimerRefreshLogin == "undefined")
    var logoutTimerRefreshLogin = false;
var logoutTimerTimer = null;
var logoutPrompt = false;
var oldTitel;

(function ($) {
    $.logoutTimer = function (options) {
        if (!$('.logoutTimer').length == 0) {
            $('.logoutTimer').prepend('<div class="alert alert-danger" id="logoutTimer" style="display: none;"><b>Automatischer Logout:</b> Es konnte längere Zeit keine Aktion auf dieser Seite festgestellt werden. <br/>Der automatische Logout erfolgt daher in <span id="timer"></span> Sekunden! <a class="btn btn-danger" onclick="$.breaklogoutTimer();" data-wx="no">Ich möchte weiter arbeiten, bitte nicht ausloggen</a></div>');
        }
        //Send Session-Check, if Window gets new focus
        $(window).focus(function () {
            document.title = oldTitel;
            if (logoutTimerTimer != null)
                $.callbacklogoutTimer(opts);
        });

        $(window).blur(function () {
            if (logoutTimerTimer != null)
                $.callbacklogoutTimer(opts);
        });

       // $(window).keypress(function (e) {
       //     if (e.which === 13) { // Fire on Enter (Fire Spacebar 32)
       //         if (logoutTimerTimer != null)
        //            $.callbacklogoutTimer(opts);
        //    }
       // });


        if ($.cookie)
            $.logoutTimer.defaults.cookie = $.cookie('sid');

        var opts = $.extend({}, $.logoutTimer.defaults, options);
        $.showTimelogoutTimer(opts.timeout, opts);
        clearTimeout(logoutTimerTimer);
        logoutTimerTimer = setTimeout(function () {
            $.callbacklogoutTimer(opts);
        }, opts.timeout * 1000);
    };

    $.logoutTimer.defaults = {
        timeout: 1000,
        redirectTo: "index.php",
        url: "ajax_login.php",
        id: "#logoutTimer",
        show: 100,
        cookie: ''
    };

    $.showTimelogoutTimer = function (time, opts) {
        clearTimeout(logoutTimerTimer);
        if (time <= 0) {
            $.callbacklogoutTimer(opts);
            return;
        } else if (time > opts.show) {
            $(opts.id).fadeOut();
            if (logoutPrompt === true) {
                $.getScript("js/bootbox.min.js", function () {
                    logoutPrompt = false;
                    bootbox.hideAll();
                });
                document.title = oldTitel;
                blinkTitleStop();

            }

            logoutTimerTimer = setTimeout(function () {
                $.showTimelogoutTimer(time - 1, opts);
            }, 1000);

            if (time < opts.show + 30 && logoutTimerRefreshLogin === true) {
                $.breaklogoutTimer();
            }
        } else {
            if (logoutTimerRefreshLogin === true) {
                $.breaklogoutTimer();
            }

            //$(opts.id).fadeIn(); // alte Box
            //$(opts.id + '> #timer').html(time);
            if (logoutPrompt === true)
                $('#timer2').html(time);

            logoutTimerTimer = setTimeout(function () {
                $.showTimelogoutTimer(time - 1, opts);
            }, 1000);

            if (logoutPrompt === false) {
                logoutPrompt = true;

                $.getScript("js/bootbox.min.js", function () {
                    bootbox.dialog({
                        title: "<b>Automatischer Logout</b>",
                        message: "<center>Es konnte längere Zeit keine Aktion auf dieser Seite festgestellt werden. <br/>Der automatische Logout erfolgt daher in  <span id='timer2'>" + time + "</span> Sekunden.</b></center>",
                         closeButton: false,
                         onEscape: true,
                        buttons: {
                            confirm: {
                                label: 'Ich möchte weiterarbeiten, bitte nicht ausloggen',
                                className: 'btn-success'
                            }
                        },
                        callback: function () {
                            $.breaklogoutTimer();
                            logoutPrompt = false;
                            document.title = oldTitel;
                        }
                    });

                });
                $.getScript("js/titel.blink.min.js", function () {

                    blinkTitle(oldTitel, "Achtung Logout", 1000, false, 5000);

                });

            }

        }
    };

    $.callbacklogoutTimer = function (opts) {

        $.post(opts.url, {name: opts.cookie}, function (data) {
            if (data == "0" || data == "" || data <= 0 ) {
                url = opts.redirectTo;
                logoutPrompt = false;
                if ($('.nav').find('a[href="index.php?logout=1"]').length == 0) {
                    document.location.href = url;
                    return;
                }

                $('body').html('<div class="container"><div class="row clearfix"><div class="col-md-12 column"><div class="panel panel-danger"><div class="panel-heading"><h3 class="panel-title">Sitzung beendet</h3></div><div class="panel-body">Leider wurde die aktuelle Sitzung beendet! Daher ist keine Navigation auf dieser Seite mehr möglich! Falls bereits eine neue Sitzung aktiv ist, kann diese übernommen werden.</div><div class="panel-footer"><a href="' + url + '" class="btn btn-danger" data-wx="no">Weiter ...</a></div></div></div></div></div>');
                $('html head').find('title').text("Sitzung automatisch beendet!");
            } else {

                clearTimeout(logoutTimerTimer);
                logoutTimerTimer = setTimeout(function () {
                    $.callbacklogoutTimer(opts);
                }, data * 1000);
                $.showTimelogoutTimer(data, opts);
            }
        });
    };

    $.breaklogoutTimer = function (options) {
        logoutPrompt = false;
        document.title = oldTitel;
        var opts = $.extend({}, $.logoutTimer.defaults, options);
        $(opts.id).fadeOut();
        if (logoutPrompt === true) {
            $.getScript("js/bootbox.min.js", function () {
                bootbox.hideAll();
                logoutPrompt = false;
            });

            blinkTitleStop();

        }

        clearTimeout(logoutTimerTimer);
        $.post(opts.url, {name: opts.cookie, breakLogout: 1}).
                done(function () {

                    $.logoutTimer();
                    $.callbacklogoutTimer(opts);
                });
    };

    $.finishTimer = function () {
        logoutPrompt = false;
        clearTimeout(logoutTimerTimer);
        logoutTimerTimer = null;
    };
}(jQuery));


$(document).ready(function () {
    function rgb2hex(orig) {
        var rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+)/i);
        return (rgb && rgb.length === 4) ? "#" +
                ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
                ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
                ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2) : orig;
    }

    $('head').append('<meta name="theme-color" content="' + rgb2hex($('.navbar-custom').css('background-color')) + '">');

    oldTitel = document.title;
    $.logoutTimer({redirectTo: "index.php?i=" + $('#institutionsid').text()});
});
