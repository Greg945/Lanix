$(function () {
    //Führt dazu, dass auch das Submenue auf dem Handy läuft
    $('body').append('<div id="desktopTest" class="hidden-xs"></div>');

    $.expr[":"].contains = $.expr.createPseudo(function (arg) {
        return function (elem) {
            return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
        };
    });

});

$().ready(function () {
    $('#topapps').one("click", function () {
        var obj = $(this).parents('li');

        $.get('startseite.php', {a: 'ajax', f: "apps"}, function (data) {
            data = JSON.parse(data);
            if (data.error == 0) {

                obj.data('data', data);

                obj.find('ul:first li').addClass('alwaysshow');

                html = '<li class="alwaysshow"><a href="#"><input type="text" placeholder="Suche ..." class="form-control" id="topappssearch"></a></li>';
                html += '<li class="alwaysshow divider" role="separator"></li>';

                html += topappsFolders(data);

                //Lösche alle weiteren Einträge
                obj.find('ul li').each(function (index, val) {
                    $(this).remove();
                });

                obj.find('ul').append(html);

                var input = obj.find('input');
                input.parents('a').click(function (e) {
                    if ($('#topapps').parents('li').find('ul li.seen:first a').length > 0)
                        $('#topapps').parents('li').find('ul li.seen:first a')[0].click();


                    return true;
                });
                input.on("click focus", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                })
                        .focus()
                        .on('keyup', function (e) {
                            var value = $(this).val();
                            if (value == '') {
                                obj.find('ul li').each(function (index, val) {
                                    if (index > 3)
                                        $(this).remove();
                                });
                                obj.find('ul').append(topappsFolders(data));
                                return;
                            }


                            data = obj.data('data');

                            if (obj.find('ul:first li ul').length > 0) {
                                var counter = {preview: 0, preadmin: 0};

                                $.each(data.entrys, function (key, entry) {
                                    sub += topappsCreateEntry(entry, counter);
                                });
                            }

                            obj.find('ul:first li:not(.alwaysshow)').remove();
                            obj.find('ul:first').append(sub);

                            obj.find('ul:first li:not(.alwaysshow):contains(' + value + ')').show().addClass('seen');
                            obj.find('ul:first li:not(.alwaysshow):not(:contains(' + value + '))').hide().removeClass('seen');
                        });


                obj.find('li > a').click(function (e) {
                    if ($('#desktopTest').is(':visible') == true)
                        return;

                    if ($(this).parent('li').find('li').length == 0)
                        return;

                    e.stopPropagation();
                    e.preventDefault();
                    var sub = $(this).parents('li:first').find('.dropdown-menu');
                    if (sub.length > 0) {
                        if (sub.is(':visible') == false)
                            sub.show();
                        else
                            sub.hide();

                    }
                    return false;
                });
            }
        });

    });
});

function topappsCreateEntry(entry, counter) {
    sub = '<li><a href="' + entry.link + '" data-wx="no"';
    if (typeof entry.target !== "undefined") {
        sub += ' target="' + entry.target + '"';
    }
    sub += '>';
    sub += '<i class="' + entry.Logo + '" style="color: #' + entry.Farbe + '"></i> ' + entry.Name;
    sub += '</a></li>';
    return sub;
}

function topappsFolders(data) {
    var html = '';
    //Ordner erstellen
    $.each(data.folders, function (key, folder) {
        var sub = '';
        var counter = {preview: 0, preadmin: 0};

        //Einträge
        $.each(data.entrys, function (key, entry) {
            if ($.inArray(folder.name, entry.Ordner) > -1) {
                sub += topappsCreateEntry(entry, counter);
            }
        });

        if (sub.length > 0) {
            html += '<li class="dropdown-submenu">';
        } else
            html += '<li>';

        html += '<a href="#" data-wx="no"><i class="' + folder.logo + ' fa-fw"  style="color: #' + folder.farbe + '"></i> ' + folder.name;
        html += '</a>';

        if (sub.length > 0) {
            html += '<ul class="dropdown-menu">' + sub + '</ul>';
        }

        html += '</li>';
    });
    return html;
}

function topappClick() {
    return false;
}