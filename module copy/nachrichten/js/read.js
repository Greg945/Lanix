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

    // --- START: Lokale Modifikation ---
    // Das ursprüngliche $.post zum Laden der Nachrichten wurde entfernt.
    // Stattdessen simulieren wir das Laden von lokalen Daten.

    console.log("Lokaler Modus: Server-Ladevorgang wird übersprungen.");
    $('#load').hide(); // Lade-Spinner ausblenden

    // Setze einen Standard-Titel
    $('h1').html("Lokale Test-Unterhaltung");
    $('h1').append('<br /><small>Dies ist eine lokale Test-Unterhaltung ohne Server.</small>');

    // Mock-Daten (Beispiel-Nachrichten)
    var initialMessages = [
        {
            Id: 1,
            own: false,
            Inhalt: "Dies ist eine erste Test-Nachricht, die lokal geladen wurde.<br>Du kannst neue Nachrichten über das Textfeld unten senden oder die Funktion <code>testeNachricht()</code> in der Konsole nutzen.",
            username: "System-Bot (Lokal)",
            Sender: "bot-123",
            SenderArt: "Betreuer", // 'Betreuer', 'Teilnehmer', 'Eltern'
            Datum: new Date().toLocaleString('de-DE'),
            ungelesen: false,
            private: 0,
            reply: [] // Wichtig, auch wenn leer
        },
        {
            Id: 2,
            own: true,
            Inhalt: "Das ist meine (lokale) Antwort darauf.",
            username: "Ich (Lokal)",
            Sender: "user-local",
            SenderArt: "Betreuer",
            Datum: new Date().toLocaleString('de-DE'),
            ungelesen: false,
            private: 0,
            reply: []
        }
    ];

    var userTyp = 'Betreuer'; // Setze einen Standard-UserTyp
    toolOptions = {}; // Leeres ToolOptions-Objekt

    // Rendere die Mock-Nachrichten
    renderMessages(initialMessages, userTyp);
    $('.chat-ul li').fadeIn(); // Nachrichten einblenden

    // Antwort-Formular hinzufügen (Code aus dem ursprünglichen .done()-Block)
    var answer = $($('#answer').html());
    answer.find('.sended, .saved').hide();
    $('.chat').append(answer);

    // Event-Listener für Senden-Button (war vorher im .done())
    answer.find('.send').click(function () {
        var form = $(this).parents('form');
        answer.find('.send').addClass('disabled');

        if ($('#MsgInput').val() == '') {
            bootbox.alert({
                title: 'Fehler: Der Inhalt der Antwort darf nicht leer sein. ',
                message: '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i>  Bitte Text in das Textfeld eingeben, bevor eine Antwort gesendet wird.</b></div>',
            });
            answer.find('.send').removeClass('disabled');
            return false; // Verhindert Aufruf von sendMessage
        }

        // Rufe die modifizierte sendMessage Funktion auf
        sendMessage(form);
        return false; // Verhindert echtes Form-Submit
    });

    // Andere Event-Listener, die im .done() waren
    $('#EmpfaengerListeBtn').click(function () {
        console.log("EmpfaengerListeBtn Klick (Funktion für lokal deaktiviert).");
        // Die ursprüngliche Funktion hing von Server-Daten (msg-Objekt) ab.
        // Wir blenden einfach eine lokale Info ein.
        if ($('#EmpfaengerListeBtn').hasClass('fa-chevron-circle-down')) {
            $('#EmpfaengerListe').html('<h4>Empfänger (Lokal)</h4><span>Lokaler Test-Modus</span>').show();
            $('#EmpfaengerListeBtn').removeClass('fa-chevron-circle-down').addClass('fa-chevron-circle-up');
        } else {
            $('#EmpfaengerListe').hide();
            $('#EmpfaengerListeBtn').removeClass('fa-chevron-circle-up').addClass('fa-chevron-circle-down');
        }
    });

    // Klick-Handler für "Nur an X antworten" (wird dynamisch zu Nachrichten hinzugefügt)
    // Wir müssen ihn an ein höheres Element binden, da .absender erst später existiert
    $('.chat-ul').on('click', '.absender', function () {
        $('#allBtn').show();
        $('#msgBoxHeader').show();
        $('#toId').val($(this).data('uid'));
        $('#msgBoxHeaderText').html('Antwort nur an ' + $(this).data('name'));
        $('html, body').animate({ scrollTop: ($('#msgBoxHeader').offset().top) }, 'slow');
        $('#MsgInput').focus();
    });

    $('#allBtn').click(function () {
        $('#allBtn').hide();
        $('#toId').val('all'); // 'all' ist der Standard
        $('#msgBoxHeaderText').html('<span class="fa fa-users"></span><b><font color="red"> Allen </b></font>antworten');
    });

    // Standard-Antwort-Modus setzen
    $('#allBtn').hide();
    $('#toId').val('all');
    $('#msgBoxHeaderText').html('<span class="fa fa-users"></span><b><font color="red"> Allen </b></font>antworten');

    // Scroll zum Ende
    $('html, body').animate({ scrollTop: $('#content').height() - 10 }, 100);

    // --- ENDE: Lokale Modifikation ---


    /* Der ursprüngliche $.post-Block wurde komplett entfernt.
       Die Event-Listener hier unten waren bereits außerhalb
       und können/sollten bleiben.
    */
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
                // --- START: Lokale Modifikation ---
                console.log("Lokal: 'deleteAll' simuliert.");
                bootbox.alert('Unterhaltung lokal ausgeblendet (simuliert).', function () {
                    location.href = "nachrichten.php"; // Simuliere Weiterleitung
                });
                // --- ENDE: Lokale Modifikation ---
            }
        }
    });
});

function showMessage(msg, showReplyArrow) {
    // Diese Funktion wird anscheinend von renderMessages() ersetzt,
    // aber wir lassen sie zur Sicherheit unverändert.
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

    template.find('.message').attr('id', 'msg' + msgid).html('<span>' + msg.Inhalt + '</span>').css({ 'border': color[2] + ' 1px solid', 'background': color[0], 'color': color[1] });

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
 * (Diese Funktion bleibt unverändert, sie ist perfekt für unsere Zwecke)
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
            .css({ 'border': color[2] + ' 1px solid', 'background': color[0], 'color': color[1] })
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
    // Diese Funktion bleibt unverändert
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
    // --- START: Lokale Modifikation ---
    // Die $.post-Anfrage wird entfernt.
    console.log("Lokaler Modus: sendMessage aufgerufen.");
    form.find('.sended').show();

    var data = {};
    data.message = form.find('textarea').val();
    data.to = $('#toId').val(); // Behalte die "an alle" / "an einen" Logik bei

    if (data.message.length < 1) {
        form.find('.sended').hide();
        $('.send').removeClass('disabled'); // Wichtig: Button wieder freigeben
        return false;
    }

    // Server-Request ($.post) entfernen. Stattdessen Nachricht lokal erstellen.
    
    var username = "Ich (Lokal)";
    var priv = 0;
    
    // Simuliere "private" Antwort
    if(data.to !== 'all') {
         var headerText = $('#msgBoxHeaderText').text();
         if(headerText.includes('Antwort nur an ')) {
             username = "Ich (an " + headerText.replace('Antwort nur an ', '') + ")";
             priv = 1; // 1 = privat, >1 = gruppen-privat
         }
    }

    var newMessage = {
        Id: new Date().getTime(), // Einzigartige ID für den Test
        own: true,
        Inhalt: data.message.replace(/\n/g, '<br>'), // Zeilenumbrüche umwandeln
        username: username,
        Sender: "user-local",
        SenderArt: "Betreuer",
        Datum: new Date().toLocaleString('de-DE'),
        ungelesen: false,
        private: priv, // Simuliere private Antwort
        reply: []
    };

    // Rendere die neue Nachricht
    renderMessages([newMessage], 'Betreuer');
    $('.chat-ul li:hidden').fadeIn(); // Neue Nachricht einblenden

    // Simuliere Server-Antwort (Erfolg)
    form.find('.sended').hide();
    form.find('.saved').show().delay(1000).fadeOut();
    form.find('textarea').val('');
    $('.send').removeClass('disabled'); // Button wieder freigeben

    // Setze Antwort-Modus zurück
    $('#allBtn').hide();
    $('#toId').val('all');
    $('#msgBoxHeaderText').html('<span class="fa fa-users"></span><b><font color="red"> Allen </b></font>antworten');

    // Zum Ende scrollen
    $('html, body').animate({ scrollTop: $('#content').height() - 10 }, 100);
    
    // --- ENDE: Lokale Modifikation ---

    return false; // Verhindert echtes Form-Submit
}

function refresh() {
    // --- START: Lokale Modifikation ---
    console.log("Lokaler Modus: Automatische Refresh-Funktion deaktiviert.");
    // Nichts tun. Server-Polling ist deaktiviert.
    window.clearTimeout(timer); // Sicherstellen, dass kein alter Timer läuft
    // --- ENDE: Lokale Modifikation ---
}

$('#revokeBtn').on('click', function () {
    bootbox.yesnoWithPasswordCheck({
        title: "Zurückziehen der Nachricht ",
        titleLoading: 'Diese Nachricht zurückziehen',
        message: "Innerhalb der ersten 10 Minuten nach Versand kann eine Nachricht zurückgezogen werden. [...]" +
            '</br></br><small>Die Nachricht selbst wird ausgeblendet und bleibt entsprechend gekennzeichnet bestehen. Es wird ein Protokolleintrag erstellt, der nach 30 Tagen gelöscht wird.</small>' +
            "</br></br>Wollen Sie die Nachricht zurückziehen?",
        loading: function (cryptPW, dialog) {
            
            // --- START: Lokale Modifikation ---
            console.log("Lokal: 'revokeMessage' simuliert.");
            // Simuliere Erfolg nach kurzer Zeit
            setTimeout(function() {
                bootbox.dialog({
                    message: '<div class="alert alert-info">Die Nachricht wurde erfolgreich zurückgezogen (simuliert).</div>',
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
            }, 1000);
            // --- ENDE: Lokale Modifikation ---
        }
    });
});


// --- START: Lokale Modifikation (Globale Test-Funktion) ---

/**
 * Fügt eine lokale Test-Nachricht zur Chat-Ansicht hinzu.
 * Aufrufbar über die Browser-Konsole (F12).
 * * Beispiel-Aufrufe:
 * testeNachricht("Hallo, das ist ein Test.", "Max Mustermann");
 * testeNachricht("Das ist meine eigene Nachricht.", "Ich (Test)", true);
 * testeNachricht("Nachricht von Eltern", "Fr. Dr. Müller", false, "Eltern");
 *
 * @param {string} inhalt Der Text der Nachricht.
 * @param {string} absenderName Der Name des Absenders.
 * @param {boolean} [istEigeneNachricht=false] Ob die Nachricht als "eigene" (rechts) oder "fremde" (links) angezeigt werden soll.
 * @param {string} [senderArt='Teilnehmer'] Der Typ des Absenders ('Teilnehmer', 'Betreuer', 'Eltern').
 */
function testeNachricht(inhalt, absenderName, istEigeneNachricht = false, senderArt = 'Teilnehmer') {
    console.log("Füge lokale Test-Nachricht hinzu...");

    if (!inhalt || !absenderName) {
        console.error("Fehler: 'inhalt' und 'absenderName' müssen angegeben werden.");
        console.log("Beispiel: testeNachricht('Hallo', 'Max Mustermann')");
        return;
    }

    var newMessage = {
        Id: new Date().getTime(), // Einzigartige ID
        own: istEigeneNachricht,
        Inhalt: inhalt.replace(/\n/g, '<br>'), // Zeilenumbrüche umwandeln
        username: absenderName,
        Sender: "local-" + absenderName.replace(/\s/g, '-'),
        SenderArt: senderArt, // 'Betreuer', 'Teilnehmer', 'Eltern'
        Datum: new Date().toLocaleString('de-DE'),
        ungelesen: !istEigeneNachricht, // Fremde Nachrichten als "neu" markieren
        private: 0,
        reply: []
    };

    // Rendere die neue Nachricht
    renderMessages([newMessage], 'Betreuer'); // UserTyp ist hier weniger wichtig
    $('.chat-ul li:hidden').fadeIn(); // Neue Nachricht einblenden

    // Zum Ende scrollen
    $('html, body').animate({ scrollTop: $('#content').height() - 10 }, 100);

    console.log("Test-Nachricht hinzugefügt.");
}
// Mache die Funktion global verfügbar, sodass du sie in der Konsole aufrufen kannst
window.testeNachricht = testeNachricht;

// --- ENDE: Lokale Modifikation ---


/**
 * Message entity definition.
 * (Unverändert)
... (der Rest der Datei bleibt wie er ist) ...
 */

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