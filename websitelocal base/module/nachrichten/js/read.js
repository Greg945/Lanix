var startValue = null;
var msgId = null;
var msgLastRefresh = 0;
var absender = new Array();
var lastReply;
var uniqid;
var groupMsg = false;
var uniquid;
var timer;
var toolOptions;

$(document).ready(function () {
    uniqid = $('h1').attr('data-msg');

    $.post('nachrichten.php', {a: 'read', uniqid: $.crypt($('h1').attr('data-msg'))})
            .done(function (data) {

                data = JSON.parse(data);
                toolOptions = data.ToolOptions;
                var userTyp = data.UserTyp;

                if (data.back === false || data.error == -1) {
                    document.location.href = "nachrichten.php";
                } else {
                    $('#load').hide();
                    var msg = JSON.parse($.decrypt(data.message));

                    msgLastRefresh = data.time;
                    uniquid = msg.Uniquid;
                    //Button Zurückziehen
                    $('#revokeBtn').hide();
                    if(msg.own && msg.Datum.includes('heute')) {
                        var timeString = msg.Datum.slice(-5);

                       var msgTime = timeString.split(':');
                       let min = Number(msgTime[1])+10;
                       let std =Number(msgTime[0]);

                       if (min > 60) {
                            min = min - 60;
                            std++;
                        }
                        var revokeTime = new Date();
                        revokeTime.setHours(std, min, 0, 0);
                        var now = new Date();
/* Nach ISA-Entscheidung diesen Code aktivieren
                        if (revokeTime >= now) {
                            $('#revokeBtn').show();
                        }
                        */
                    }
                    if (msg.noAnswerAllowed == 'ja')
                        $('h1').attr('data-noAnswerAllowed', 'ja');

                    $('#allBtn').hide();
                    $('#toId').val('all');

                    $('h1').html(msg.Betreff);
                    if (msg.privateAnswerOnly == 'ja')
                        $('h1').attr('data-privateansweronly', 'ja');
                    var stat = '';
                    if (msg.statistik.betreuer > 0)
                        stat += '<span class="fa fa-user" title="' + lang.LehrerMehrzahl + '"> </span>'+' '+msg.statistik.betreuer + ' &nbsp ' ;

                    if (msg.statistik.teilnehmer > 0)
                        stat +=  '<span class="fa fa-child" title="Lernende"></span>' + ' ' + msg.statistik.teilnehmer  + ' &nbsp ';

                    if (msg.statistik.eltern > 0)
                        stat +=  '<span class="fa fa-user-circle" title="Eltern"></span>' + ' '+msg.statistik.eltern  ;


                    if (msg.WeitereEmpfaenger != null) {

                        $('h1').append('<br /><small>Unterhaltung mit ' + msg.WeitereEmpfaenger + '<span class="copyToClipboard" style="color: Dodgerblue;"> ' + stat + '</span> ' + ' <span id="EmpfaengerListeBtn" class="hidden-print btn info fa-lg fas fa-chevron-circle-down" style="margin:5px;color: Dodgerblue;"></span></small>');
                        $('h1').attr('data-onereply', false);
                        groupMsg = true;
                    } else {
                        if (msg.empf.length < 15) {
                            var empfList = "";


                            var user = $('h1').attr('data-user');
                            if (msg.Sender == user) {
                                for (let i = 0; i < msg.empf.length; i++) {
                                    if (i < msg.empf.length - 1) {
                                        empfList += msg.empf[i] + ', ';
                                    } else {
                                        empfList += msg.empf[i];
                                    }
                                }
                            } else {
                                empfList += msg.SenderName;
                            }

                            $('h1').append('<br /><small>Unterhaltung mit ' + empfList + ' ' + stat + ' </small> ');
                        }
                        $('h1').attr('data-onereply', true);
                    }

                    if (!msg.own){
                        $('#EmpfaengerListeBtn').hide();
                                           }
                    var entries = $.merge([msg], msg.reply);
                    renderMessages(entries, userTyp);
                    
                    if (msg.groupOnly == 'ja' || msg.privateAnswerOnly == 'ja')
                        $('.absender').hide();



                    $('.chat-ul li').fadeIn();

                    $('#copyEmpf').click(function () {
                        startCopyToClipboard();
                    });

                    $('.absender').click(function () {
                        $('#allBtn').show();
                        $('#msgBoxHeader').show();
                        $('#toId').val($(this).data('uid'));
                        $('#msgBoxHeaderText').html('Antwort nur an ' + $(this).data('name'));
                        $('html, body').animate({scrollTop: ($('#msgBoxHeader').offset().top)}, 'slow');
                        $('#MsgInput').focus();
                    });

                    $('#EmpfaengerListeBtn').click(function () {
                        if ($('#EmpfaengerListeBtn').hasClass('fa-chevron-circle-down')) {

                            $('#EmpfaengerListe').show();

                            var empfString = "";
                            if (msg.own) {
                                for (let i = 0; i < msg.empf.length; i++) {

                                    empfString += msg.empf[i] + ' ';
                                }
                                $('#EmpfaengerListe').html('<h4>Alle Empfänger:</h4><span class="copyToClipboard">' + empfString + ' </span>');

                            } else {

                                $('#EmpfaengerListe').html('<h4>Empfänger Statistik:</h4><span class="copyToClipboard">' + empfString + ' </span>');


                            }
                            $('#EmpfaengerListeBtn').removeClass('fa-chevron-circle-down');
                            $('#EmpfaengerListeBtn').addClass('fa-chevron-circle-up');

                        } else {
                            $('#EmpfaengerListe').hide();
                            $('#EmpfaengerListeBtn').removeClass('fa-chevron-circle-up');
                            $('#EmpfaengerListeBtn').addClass('fa-chevron-circle-down');


                        }
                    });

                    var answer = $($('#answer').html());

                    answer.find('.toone').html('<span class="fa fa-reply"></span> ' + msg.username + ' antworten')
                            .parents('button').addClass('active');

                    if ($('h1').attr('data-onereply') === false) {
                        answer.find('button').eq(1).remove();
                    }

                    answer.find('.sended, .saved').hide();


                    $('.chat').append(answer);

                    answer.find('.to button').click(function () {
                        var _this = $(this);
                        var _form = $(this).parents('form');

                        _this.parents('.to').find('button').removeClass('active');
                        _this.addClass('active');
                        _form.find('.send').html('<span class="fa fa-reply-all"></span> Antwort senden');
                        _form.data('to', 'all');
                    });

                    $('#allBtn').click(function () {
                        $('#allBtn').hide();
                        $('#toId').val($(this).data(''));
                        $('#msgBoxHeaderText').html('<span class="fa fa-users"></span><b><font color="red"> Allen </b></font>antworten');
                    });

                    answer.find('.send').click(function () {
                        answer.find('.send').addClass('disabled');
                        if($('#MsgInput').val() == ''){
                            bootbox.alert({
                                title: 'Fehler: Der Inhalt der Antwort darf nicht leer sein. ',
                                message: '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i>  Bitte Text in das Textfeld eingeben, bevor eine Antwort gesendet wird.</b></div>',
                            });
                            answer.find('.send').removeClass('disabled');
                        }
                            return sendMessage($(this).parents('form'));

                    });

                    //wenn die Nachricht nur einen Empfänger hat

                    if (!groupMsg) {
                        $('#allBtn').hide();
                        $('#toId').val('all');
                    }
                    else {
                        $('#allBtn').hide();
                        $('#toId').val('all');
                        $('#msgBoxHeaderText').html('<span class="fa fa-users"></span><b><font color="red"> Allen </b></font>antworten');
                    }

                }


                if (msg.privateAnswerOnly == 'ja') {
                    $('#allBtn').hide();
                    if (msg.Sender != data['userId']) {
                        $('#msgBoxHeaderText').html('Die Antwort wird nur für ' + msg.SenderName + ' sichtbar sein.');
                        $('#toId').val(msg.Sender);
                    } else {
                        $('#msgBoxHeaderText').html('Diese Antwort kann von allen Unterhaltungsteilnehmenden eingesehen werden! Antworten anderer Teilnehmenden sind nur von der absendenden Person einsehbar.');
                    }
                }
                //Antwortbereich verstecken.
                if (msg.noAnswerAllowed == 'ja' && $('h1').attr('data-user') != msg.Sender)
                    $('#answerForm').hide();

                if (msg.Papierkorb == 'ja' && $('h1').attr('data-user') != msg.Sender && msg.AntwortAufAusgeblendeteNachricht != 'on')
                    $('#answerForm').html('<div style="width:60%" class="alert alert-danger" role="alert">' + msg.SenderName + ' hat den Nachrichtenverlauf verborgen und somit zur Löschung vorgemerkt. Antworten auf diese Nachricht sind deshalb nicht mehr möglich. </div> ');

                //Scroll To new or bottom
                var neu = $('.message-new');
                if (neu.length > 0) {
                    $('html, body').animate({scrollTop: neu.first().offset().top - $('.navbar-collapse:visible').height() - 10}, 100);
                } else {
                    $('html, body').animate({scrollTop: $('#content').height() - 10}, 100);
                }
            });
});

$('#printBtn').click(function () {
    window.print();
});

$('.dropdown').on('click', '#deleteBtn', function () {

    bootbox.confirm({
            title: "<b>Soll diese Unterhaltung wirklich ausgeblendet werden?</b>",
            message: "Sollten noch neue Antworten geschrieben werden, so wird diese Unterhaltung wieder eingeblendet. Nachdem alle die Unterhaltung ausgeblendet haben, wird diese kurze Zeit später vollständig gelöscht.",
            buttons: {
                confirm: {
                    label: 'Ja',
                    className: 'btn-danger'
                },
                cancel: {
                    label: 'Nein',
                    className: 'btn-success'
                }
            },
      callback: function (result) {

        if (result) {

            $.post('nachrichten.php', {a: 'deleteAll', uniqid: uniquid})
                    .done(function (data) {
                        if (data === 'true') {
                            location.href = "nachrichten.php";
                        } else
                            bootbox.alert('Leider hat das Ausblenden nicht geklappt. Bitte später erneut versuchen!');

                    });
        }

    }
});



});

function showMessage(msg, showReplyArrow) {
    console.log("show Message called")

    if (startValue == null) {
        startValue = msg.Sender + Math.floor(Math.random() * 1000);
        msgid = 1;
    } else
        msgid++;

    if (msg.own == true) {
        var template = $($('#messageOwn').html());
        var color = ['#F8F8F8', '#000000', '#F8F8F8'];


    } else {
        var template = $($('#message').html());
        var color = ['#C6F46C', '#1a1f3e', '#C6F46C'];

    }

    if (msg.ungelesen === false) {
        template.find('.message-new').remove();
    }
    template.find('.fa-info').attr('data-id', msg.Id);

    if (msg.SenderArt == 'Betreuer')
        template.find('.usersymbol').addClass('fa-user');
    if (msg.SenderArt == 'Teilnehmer')
        template.find('.usersymbol').addClass('fa-child');
    if (msg.SenderArt == 'Eltern')
        template.find('.usersymbol').addClass('fa-user-circle');

    template.find('.absender').attr('title', "Nur " + msg.username + " antworten");
    template.find('.absender').attr('data-name', msg.username);
    template.find('.absender').attr('data-uid', msg.Sender);
    template.find('.btn-link').data('user', msg.Sender);
    template.find('li').attr('data-id', msg.Id);
    template.find('.message-data-name').html(msg.username).data('id', msg.Sender).data('art', msg.SenderArt);
    template.find('.message-data-time').text(msg.Datum);
    template.find('.fa-circle').css('color', color[0]);

    template.find('.message').attr('id', 'msg' + msgid).html('<span>' + msg.Inhalt + '</span>').css({'border': color[2] + ' 1px solid', 'background': color[0], 'color': color[1]});
   
     template.find('.message').attr('id', 'msg' + msgid).formatMarkup();
    //wenn Gruppennachricht dann Schatten
    if (msg.private > 1) {
        template.find('.privateAnswer').css('color', 'blue');
        template.find('.privateAnswer').addClass('fas fa-users');
    } else {
        if (groupMsg)
            template.find('.privateAnswer').text('Diese Antwort kann nur der aktuell angemeldete Account sehen!');
    }

    $('<style>#msg' + msgid + ':after{border-color: ' + color[2] + ' transparent;}</style>').appendTo('head');

    template.css('display', 'none');

    $('.chat-ul').append(template);
    //Sendebutton freigeben;
    $('.send').removeClass('disabled');

    if (!showReplyArrow)
        template.find('.absender').hide();

    console.log("show Message call finished")


}


/**
 * Renders all messages at once
 *
 * @param {Message[]} messages
 * @param {string} userType
 */
function renderMessages(messages, userType) {
    var styles = [];
    var templates = [];
    var templateOwnMsg = $('#messageOwn').html();
    var templateMsg = $('#message').html();

    messages.forEach(function (message) {
        var showReplyArrow = true;
        if (userType === 'Teilnehmer' && toolOptions?.AllowSuSToSuSMessages !== 'on' && message.SenderArt === 'Teilnehmer') {
            showReplyArrow = false;
        }

        if (startValue == null) {
            startValue = message.Sender + Math.floor(Math.random() * 1000);
            msgid = 1;
        } else {
            msgid++;
        }

        if (message.own == true) {
            var $template = $(templateOwnMsg);
            var color = ['#F8F8F8', '#000000', '#F8F8F8'];

        } else {
            var $template = $(templateMsg);
            var color = ['#C6F46C', '#1a1f3e', '#C6F46C'];
        }

        if (message.ungelesen === false) {
            $template.find('.message-new').remove();
        }
        $template.find('.fa-info').attr('data-id', message.Id);

        if (message.SenderArt === 'Betreuer') {
            $template.find('.usersymbol').addClass('fa-user');
        } else if (message.SenderArt === 'Teilnehmer') {
            $template.find('.usersymbol').addClass('fa-child');
        } else if (message.SenderArt === 'Eltern') {
            $template.find('.usersymbol').addClass('fa-user-circle');
        }

        var $sender = $template.find('.absender');
        $sender.attr('title', "Nur " + message.username + " antworten")
            .attr('data-name', message.username)
            .attr('data-uid', message.Sender);
        if (!showReplyArrow) {
            $sender.hide();
        }

        $template.find('.btn-link').data('user', message.Sender);
        $template.find('li').attr('data-id', message.Id);
        $template.find('.message-data-name').html(message.username).data('id', message.Sender).data('art', message.SenderArt);
        $template.find('.message-data-time').text(message.Datum);
        $template.find('.fa-circle').css('color', color[0]);

        var $message = $template.find('.message');
        $message.attr('id', 'msg' + msgid)
            .html('<span>' + message.Inhalt + '</span>')
            .css({'border': color[2] + ' 1px solid', 'background': color[0], 'color': color[1]})
            .formatMarkup();

        // Set answer status
        if (message.private > 1) {
            $template.find('.privateAnswer').css('color', 'blue')
                .addClass('fas fa-users');
        } else if (groupMsg) {
            $template.find('.privateAnswer')
                .text('Diese Antwort kann nur der aktuell angemeldete Account sehen!');
        }

        styles.push('#msg' + msgid + ':after{border-color: ' + color[2] + ' transparent;}');

        $template.css('display', 'none');
        templates.push($template);
    });

    if (styles) {
        $('<style>' + styles.join("\n") + '</style>').appendTo('head');
    }
    $('.chat-ul').append(templates);

    $('.send').removeClass('disabled');
}


function getColor(user) {

    var c = colors[((startValue + user) % 145) + 1];
    if (c[1] == 'b') {
        c[1] = '#000000';
        c[2] = c[0];
    } else if (c[1] == 'w' || c[1] == '') {
        c[1] = '#FFFFFF';
        c[2] = '#999999';
        c[2] = c[0];
    }
    return c;
}

function sendMessage(form) {

    form.find('.sended').show();
    var data = {};
    if ($('#msgBoxHeader').is(":hidden")) {
        data.to = "all";
    } else {
        data.to = $('#toId').val();

    }

    data.message = form.find('textarea').val();
    if (data.message.length < 1) {
        form.find('.sended').hide();
        return false;
    }
    data.replyToMsg = $('h1').attr('data-msg');


    $.post('nachrichten.php', {a: 'reply', c: $.crypt(JSON.stringify(data))})
            .done(function (data) {
                window.clearTimeout(timer);
                form.find('.sended').hide();

                data = JSON.parse(data);
                if (data.back === false) {
                    bootbox.dialog({
                        message: '<div class="alert alert-danger">Leider ist das Antworten auf diese Nachricht nicht oder nicht mehr möglich.</div>',
                        buttons: {
                            ok: {
                                label: "OK",
                                className: "btn-primary",
                                callback: function () {
                                    location.reload();
                                }
                            }
                        }
                    });

                } else {
                    form.find('.saved').show().delay(1000).fadeOut();
                    timer = window.setTimeout(refresh, 2000);
                    form.find('textarea').val('');
                }

            });


    return false;
}

function refresh() {
    $.post('nachrichten.php', {a: 'refresh', last: msgLastRefresh, uniqid: $.crypt($('h1').attr('data-msg'))})
            .done(function (data) {
                window.clearTimeout(timer);
                data = JSON.parse(data);
                msgLastRefresh = data.time;
                var messages = JSON.parse($.decrypt(data.reply));
                if (messages.length > 0) {
                    renderMessages(messages, '');
                    $('.chat-ul li:hidden').fadeIn();
                }

                timer = window.setTimeout(refresh, 30000);
            });

}
$('#revokeBtn').on('click',function (){
    bootbox.yesnoWithPasswordCheck({
        title: "Zurückziehen der Nachricht ",
        titleLoading: 'Diese Nachricht zurückziehen',
        message: "Innerhalb der ersten 10 Minuten nach Versand kann eine Nachricht zurückgezogen werden. Wenn eine Nachricht zurückgezogen wird, wird der Inhalt, der Betreff und der Empfängerkreis unkenntlich gemacht. Neue Antworten auf diese Nachricht sind dann auch nicht mehr möglich."+
            '</br></br><small>Die Nachricht selbst wird ausgeblendet und bleibt entsprechend gekennzeichnet bestehen. Es wird ein Protokolleintrag erstellt, der nach 30 Tagen gelöscht wird.</small>'+
            "</br></br>Wollen Sie die Nachricht zurückziehen?",
        loading: function (cryptPW, dialog) {
               $.post('nachrichten.php', {a: 'revokeMessage', uniquid: uniquid, pw: cryptPW})
                .done(function (data) {
                    if (data == '-1')
                        dialog.find('.bootbox-body').html('<div class="alert alert-danger">Das eingegebene Passwort war leider nicht korrekt!</div>');
                    else if (data == '-2')
                        dialog.find('.bootbox-body').html('<div class="alert alert-danger">Leider ist die Änderung fehlgeschlagen!</div>');
                    else if (data == '-4')
                        dialog.find('.bootbox-body').html('<div class="alert alert-danger">Der Zeitraum, in dem die Nachricht zurückgezogen werden kann, ist leider abgelaufen.</div>');
                    else if (data == '-5')
                        dialog.find('.bootbox-body').html('<div class="alert alert-danger">Es konnte keine Nachricht mit diesem Unique Identifier gefunden werden.</div>');
                    else if (data == '-6')
                        dialog.find('.bootbox-body').html('<div class="alert alert-warning"> Diese Nachricht wurde bereits zurückgezogen, sie kann nicht erneut zurückgezogen werden.</div>');
                    else if (data == '-6')
                        dialog.find('.bootbox-body').html('<div class="alert alert-warning"> Nur Betreuer haben die Berechtigung für das Zurückziehen von Nachrichten. </div>');
                    else
                     bootbox.dialog({
                        message: '<div class="alert alert-info">Die Nachricht wurde erfolgreich zurückgezogen.</div>',
                        buttons: {
                            ok: {
                                label: "OK",
                                className: "btn-primary",
                                callback: function () {
                                    location.reload();
                                }
                            }
                        }
                    });
                });
        }

    });
});

/**
 * Message entity definition.
 *
 * @typedef {Object} Message
 * @property {Number} Id
 * @property {Boolean} AntwortAufAusgeblendeteNachricht
 * @property {String} Betreff
 * @property {String} Datum
 * @property {String} Delete
 * @property {String} Inhalt
 * @property {String} Papierkorb
 * @property {String} Sender
 * @property {String} SenderArt
 * @property {String} SenderName
 * @property {String} Uniquid
 * @property {String} WeitereEmpfaenger
 * @property {String[]} empf
 * @property {String} groupOnly
 * @property {String} noAnswerAllowed
 * @property {Boolean} noanswer
 * @property {Boolean} own
 * @property {Number} private
 * @property {String} privateAnswerOnly
 * @property {Message[]} reply
 * @property {MessageStats} statistik
 * @property {Boolean} ungelesen
 * @property {String} username
 */

/**
 * MessageStats entity definition.
 *
 * @typedef {Object} MessageStats
 * @property {Number} betreuer
 * @property {Number} eltern
 * @property {Number} teilnehmer
 */
