(function ($) {
    $.decryptReady = false;

    $.cachedScript = function (url, options) {

        // Allow user to set any option except for dataType, cache, and url
        options = $.extend(options || {}, {
            dataType: "script",
            cache: true,
            url: url
        });

        // Use $.ajax() since it is more flexible than $.getScript
        // Return the jqXHR object so we can chain callbacks
        return $.ajax(options);
    };

    $.crypt = function (val) {
        if ($.localStorage.get('aespw') === null) {
            $.cachedScript('js/bootbox.min.js').done(function () {
                bootbox.alert('Leider können Sie hier nicht alle Daten sehen, da die Einstellungen Ihres Browsers dies nicht zulassen. <a href="{$knowledgebase}?article=1038" target="_blank">Weitere Informationen</a>');
            });
        } else {
            return $.jCryption.encrypt(val, $.localStorage.get('aespw'));
        }
    }

    $.decrypt = function (val) {
        if ($.localStorage.get('aespw') === null) {
            $.cachedScript('js/bootbox.min.js').done(function () {
                bootbox.alert('Leider können Sie hier nicht alle Daten sehen, da die Einstellungen Ihres Browsers dies nicht zulassen. <a href="{$knowledgebase}?article=1038" target="_blank">Weitere Informationen</a>');
            });
        } else {
            return $.jCryption.decrypt(val, $.localStorage.get('aespw'));
        }
    }

    $.decodeTags = function (val) {
        var enc = $('encoded');
        //enc.each(function (i, data) {
        //$(data).replaceWith($.decrypt($(data).text()));
        //}
        if (enc.length > 0) {
            var aes = false;

            $.getScript("js/cryptoJs/cryptojs-aes.min.js", function (data, textStatus, jqxhr) {
                $.getScript("js/cryptoJs/cryptojs-aes-format.js", function (data, textStatus, jqxhr) {
                    enc.each(function (i, data) {
                        var decr = CryptoJS.AES.decrypt($(data).text(), $.localStorage.get('aespw')).toString(CryptoJS.enc.Utf8);
                        $(data).replaceWith(decr);
                    });
                });
            });
        }

    }

    $.startAES = function (restart, afterwards) {

        $.cachedScript('js/jquery.storageapi.min.js')
            .done(function () {
                $.cachedScript('libs/jcryption/jquery.jcryption.3.1.0.js')
                    .done(function (script, textStatus) {
                        var password = $.localStorage.get('aespw');

                        if (password && restart === true) {
                            $.localStorage.remove('aespw');
                            password = false;
                        }

                        if (password) {

                        } else {
                            function generateUUID() {
                                var d = new Date().getTime();
                                if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
                                    d += performance.now();
                                }
                                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-xxxxxx3xx'.replace(/[xy]/g, function (c) {
                                    var r = (d + Math.random() * 16) % 16 | 0;
                                    d = Math.floor(d / 16);
                                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                                });
                            }

                            var password = $.jCryption.encrypt(generateUUID(), generateUUID());

                            $.jCryption.authenticate(password, "ajax.php?f=rsaPublicKey", "ajax.php?f=rsaHandshake&s=" + Math.floor(Math.random() * 2000), function (AESKey) {
                                $.localStorage.set('aespw', AESKey);

                                if (typeof afterwards === "function") {
                                    afterwards();
                                }

                            }, function () {
                                location.reload();
                            });
                        }
                        $.decryptReady = true;
                    });
            });
    };

    $(function() {
        $.decodeTags();
    });
}(jQuery));
