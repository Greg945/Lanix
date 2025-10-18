var pinHint = false;
var pinRefresh = false;
var pinAblaufenLassen = checkLocalStorage();
var pinTimeout;

$(document).ready(function () {

    $('a.pinrefresh').click(function (e) {
        loadBootbox();

        if (pinRefresh === false) {
            pinRefresh = true;
            bootbox.prompt({inputType: 'password', title: "Bitte geben Sie Ihre PIN ein, um die Gültigkeitsdauer zu verlängern:", callback: function (result) {
                    if (result > 0 && result.match(/\d+$/) && result.length > 3) {
                        $.post('benutzerverwaltung.php', {a: 'userPinActions', b: 'refresh', pin: $.crypt(result)}).done(function (data) {
                            if (data == '1') {
                                bootbox.alert('Die PIN-Zeit wurde erfolgreich verlängert!');
                                getPinTime();
                                pinRefresh = false;
                                pinAblaufenLassen = false;
                                setLocalStorage("pinAblaufenLassen", 0);
                            } else {
                                bootbox.alert('Die PIN-Zeit konnte leider nicht verlängert werden!');
                                pinRefresh = false;
                                pinAblaufenLassen = false;
                                setLocalStorage("pinAblaufenLassen", 0);
                            }
                        });

                    }
                }});
        }
        return false;
    });

    $('a.pinremove').click(function (e) {
        loadBootbox();
        $.post('benutzerverwaltung.php', {a: 'userPinActions', b: 'remove'}).done(function (data) {
            if (data == '1') {
                pinAblaufenLassen = false;
                bootbox.alert('Die PIN wurde erfolgreich entfernt! Die Seite wird jetzt neu geladen.');
                setLocalStorage("pinAblaufenLassen", 0);
                deleteLocalStorage("pinAblaufenLassen");
                document.location.reload();
            } else {
                pinAblaufenLassen = false;
                setLocalStorage("pinAblaufenLassen", 0);
                bootbox.alert('Die PIN konnte leider nicht entfernt werden! Bitte die Seite neu laden!');
            }
        });
        return false;
    });

    /*
    Warum muss die Funktion erneut aufgerufen werden, wenn der Fokus des Windows da ist? Funktion läuft auch so durch. Führt zu redundanten Aufrufen...
    $(window).focus(function () {
       if ($('#pintime').length > 0) {
         getPinTime();
       }
    });
    */

    function getPinTime() {
        loadBootbox();
        clearTimeout(pinTimeout);
        $.post('benutzerverwaltung.php', {a: 'userPinActions', b: 'gettime'}).done(function (data) {
            var sec = parseInt(data);
            if (sec <= 0) {
                //Abfrage, ob die PIN serverseitig abgelaufen ist. Falls ja (data==='1'), wird der Cache der Seite zurückgesetzt und dann hier die Seite neu geladen
                //notwendig, da bei reiner get-Abfrage über document.location.reload() auf eine gecachte Seite zurückgegriffen wurde
                $.post('benutzerverwaltung.php', {a: 'userPinActions', b: 'pinstatus'}).done(function (data) {
                    if(data === '1'){
                        pinAblaufenLassen = false;
                        bootbox.alert('Die PIN-Zeit ist abgelaufen! Die Seite wird neu geladen!');
                        setLocalStorage("pinAblaufenLassen", 0);
                        deleteLocalStorage("pinAblaufenLassen");
                        document.location.reload();
                    //reicht das im else-Zweig aus? Der Fall sollte eigentlich nicht auftreten (Übernahme des Codes von voriger Version).
                    }else{
                        pinAblaufenLassen = false;
                        setLocalStorage("pinAblaufenLassen", 0);
                        deleteLocalStorage("pinAblaufenLassen");
                        $('#pin').remove();
                    }
                });
            } else {
                PinTimeRefresh(sec);
            }
        });
    }

    function PinTimeRefresh(sec) {
        if (sec > 0) {
            if (sec <= 120) {
                //Notwendigkeit des erneuten Aufrufs von getPinTime() ist mir nicht klar. Führt dazu, dass mehrere PinTimeRefresh nebeneinander herlaufen ab 15 Sekunden PIN-Gültigkeit
                // if (sec == 15) {
                //    getPinTime();
                //}
                pinAblaufenLassen = checkLocalStorage();
                if (sec <= 60 && pinHint === false && pinRefresh === false && pinAblaufenLassen === false) {
                    pinHint = true;

                    bootbox.confirm({
                        title: "PIN-Zeit läuft ab",
                        message: "Die PIN-Zeit läuft ab. Bitte - falls nötig - jetzt die Dauer der PIN-Gültigkeit verlängern.",
                        buttons: {
                            confirm: {
                                label: 'Zeit verlängern',
                                className: 'btn-success'
                            },
                            cancel: {
                                label: 'Zeit ablaufen lassen',
                                className: 'btn-danger'
                            }
                        },
                        callback: function (result) {
                            if (result) {
                                pinAblaufenLassen = false;
                                setLocalStorage("pinAblaufenLassen", 0);
                                $('a.pinrefresh').click();
                            } else {
                                pinAblaufenLassen = true;
                                setLocalStorage("pinAblaufenLassen", 1);
                            }
                        }
                    });
                }
                $('#pintime').html('<span class="badge badge-danger">' + sec + '</span> Sek.');
                pinTimeout = window.setTimeout(function () {
                    PinTimeRefresh(sec - 1);
                }, 1000);
            } else if (sec < 3600) {
                pinHint = false;
                var min = Math.floor(sec / 60);
                if (min < 3)
                    min = '<span class="badge badge-warning">' + min + '</span>';
                $('#pintime').html(min + ' Min.');
                pinTimeout = window.setTimeout(function () {
                    PinTimeRefresh(sec - 60);
                }, 60 * 1000);
            } else {
                pinHint = false;
                $('#pintime').text(Math.floor(sec / 60 / 60) + ' Std.');
                pinTimeout = window.setTimeout(function () {
                    PinTimeRefresh(sec - 60 * 30);
                }, 30 * 60 * 1000);
            }
        } else{
            getPinTime();
        }
    }

    if ($('#pintime').length > 0) {
        getPinTime();
    }
});

function loadBootbox() {
    if (typeof bootbox == "undefined") {
        $.getScript('js/bootbox.min.js');
    }
    if (typeof $.crypt == "undefined"  ) {
        $.getScript('js/jquery.storageapi.min.js');
        $.getScript('libs/jcryption/jquery.jcryption.3.1.0.js');
        $.getScript('js/createAEStoken.js');
    }
}

function checkLocalStorage() {
    var check = getLocalStorage("pinAblaufenLassen");
    if (check === undefined || check === "") {
        setLocalStorage("pinAblaufenLassen", 0);
    }
    var ret;
    if (getLocalStorage("pinAblaufenLassen") === "1") {
        this.pinAblaufenLassen = true;
        ret = true;
    } else {
        this.pinAblaufenLassen = false;
        ret = false;
    }
    return ret;
}

function getLocalStorage(cname) {
    return localStorage.getItem(cname);
}

function setLocalStorage(cname, cvalue) {
    localStorage.setItem(cname, cvalue);
}

function deleteLocalStorage(cname) {
    localStorage.removeItem(cname);
}