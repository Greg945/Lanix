function copyCode(Celem) {
    Celem.select();
    Celem.focus();
    if (document.all) {
        Celem.createTextRange().execCommand("Copy");
        alert("Daten wurden in die Zwischenablage kopiert.\nSie können jetzt an beliebiger Stelle mit Strg+V eingefügt werden.")
    } else {
        alert("Mittels Strg+C, um die markierten Daten in die Zwischenablage zu kopieren.\nAnschließend können die Daten an beliebiger Stelle mit Strg+V eingefügt werden.");
    }
    return false;
}

function copyToClipboard(elem, obj) {
    // create hidden text element, if it doesn't already exist
    var targetId = "_hiddenCopyText_";
    var isInput = elem.tagName === "INPUT" || elem.tagName === "TEXTAREA";
    var origSelectionStart, origSelectionEnd;
    if (isInput) {
        // can just use the original source element for the selection and copy
        target = elem;
        origSelectionStart = elem.selectionStart;
        origSelectionEnd = elem.selectionEnd;
    } else {
        // must use a temporary form element for the selection and copy
        target = document.getElementById(targetId);
        if (!target) {
            var target = document.createElement("textarea");
            target.style.position = "absolute";
            target.style.left = "-9999px";
            target.style.top = "0";
            target.style.zIndex = 100000;
            target.id = targetId;
            
            obj.append(target);            
        }
        target.textContent = elem.textContent;
    }
    
    // select the content
    var currentFocus = document.activeElement;
    target.focus();
    target.setSelectionRange(0, target.value.length);

    // copy the selection
    var succeed;
    try {
        succeed = document.execCommand("copy");
    } catch (e) {
        succeed = false;
    }
    // restore original focus
    if (currentFocus && typeof currentFocus.focus === "function") {
        currentFocus.focus();
    }

    if (isInput) {
        // restore prior selection
        elem.setSelectionRange(origSelectionStart, origSelectionEnd);
    } else {
        // clear temporary content
        target.textContent = "";
    }
    return succeed;
}



function startCopyToClipboard() {
    $('.copyToClipboard:not([data-changed])').append(' <button class="btn-sm btn-default btn btnCopyToClipboard" title="in Zwischenablage kopieren" data-new="1"><i class="fa fa-clipboard"></i></button>').attr('data-changed', '1');

    $('.btnCopyToClipboard[data-new="1"]').click(function () {
        var btn = $(this);
        var toCopy = $(this).closest('.copyToClipboard');
        var data = $(this).closest('.copyToClipboard').clone();
        data.find('.btnCopyToClipboard').remove();

        if (data[0].hasAttribute('data-copy') !== true)
            data.attr('data-copy', data.text().trim());

        data = $('<div/>').text(data.attr('data-copy'));

        if (copyToClipboard(data[0], toCopy) !== false) {
            var bg = toCopy.css('background-color');
            toCopy.animate({"background-color": "green"}, {duration: 200}).animate({"background-color": bg}, {duration: 100});

            btn.removeClass('btn-default').addClass('btn-success');
            window.setTimeout(function () {
                btn.removeClass('btn-success').addClass('btn-default');
            }, 300);
        } else {
            btn.removeClass('btn-default').addClass('btn-danger');
            bootbox.alert('Das Kopieren in die Zwischenablage klappt in diesem Browser leider nicht!');
        }
    }).attr('data-new', '0');
}

$(function () {
    startCopyToClipboard();
});