//Matheretter benötigt einen eindeutigen Link aus dem SPH im Aufruf. Global eingebunden, da potentiell überall Matheretter Links verwendet werden könnten.
$(function () {
    $('a').click(function (e) {
        var href = $(this).attr('href');
        if (href !== undefined) {
            var matheretter = href.includes("matheretter.de");
            var ishsp  = href.includes("ishsp");
            if (matheretter && !ishsp) {
                var questionmark = href.includes("?");
                if (questionmark){
                    $(this).attr('href', href + '&ishsp');
                } else{
                    $(this).attr('href', href + '?ishsp');
                }
            }
        }
         return true;
    });
});